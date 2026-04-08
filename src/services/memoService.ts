import { supabase } from '@/integrations/supabase/client';
import { Memo, MemoFormData, SignaturePosition, MemoSignature } from '@/types/memo';
import { extractPdfUrl } from '@/utils/fileUpload';
import { getDeviceFingerprint } from '@/utils/deviceInfo';
import { requestQueue, railwayPDFQueue } from '@/utils/requestQueue';
import { railwayFetch } from '@/utils/railwayFetch';
import { formatThaiDateFull, convertToThaiNumerals } from '@/utils/dateUtils';
import { calculateNextSignerOrder, calculateRejection, SIGNER_ORDER } from '@/services/approvalWorkflowService';

export class MemoService {
  // Line-wrap text using Edge Function (Vertex AI)
  static async wrapTextWithLineWrap(text: string): Promise<string> {
    if (!text || text.trim().length === 0) return text;

    try {
      const { data, error } = await supabase.functions.invoke('line-wrap', {
        body: { text }
      });

      if (error) {
        return text; // Fallback
      }

      return data?.wrapped || text;
    } catch (err) {
      console.warn('Line-wrap failed, using original:', err);
      return text; // Fallback
    }
  }

  // Preprocess memo text fields (introduction, fact, proposal) with line-wrapping
  static async preprocessMemoText(formData: any): Promise<any> {
    const fieldsToWrap = ['introduction', 'fact', 'proposal'];
    const processed = { ...formData };

    for (const field of fieldsToWrap) {
      if (processed[field] && processed[field].trim()) {
        processed[field] = await this.wrapTextWithLineWrap(processed[field]);
      }
    }

    return processed;
  }

  // Helper function to upload files to storage
  static async uploadAttachedFiles(files: File[], userId: string): Promise<string[]> {
    const uploadedUrls: string[] = [];

    for (const file of files) {
      try {
        const fileExtension = file.name.split('.').pop();
        const fileName = `attachment_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        const filePath = `memos/${userId}/${fileName}`;

        // Use request queue + retry for storage upload
        const { error: uploadError } = await requestQueue.enqueueWithRetry(
          () =>
            supabase.storage
              .from('documents')
              .upload(filePath, file, {
                contentType: file.type,
                upsert: false
              }),
          'Storage Upload (Attachment)',
          2, // max 2 retries
          500 // initial delay 500ms
        );

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          continue;
        }

        // Get public URL (no queue needed - just reads metadata)
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }

    return uploadedUrls;
  }

  static async createMemoDraft(formData: MemoFormData & { memo_id?: string; attachedFileObjects?: File[] }, userId: string, preGeneratedPdfBlob?: Blob): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Handle file uploads for attached files
      let attachedFileUrls: string[] = [];
      if (formData.attachedFileObjects && formData.attachedFileObjects.length > 0) {
        attachedFileUrls = await this.uploadAttachedFiles(formData.attachedFileObjects, userId);
      }

      let publicUrl = '';
      let shouldGenerateNewPdf = true;

      // Check if this is an update (edit mode) and determine if we need to regenerate PDF
      if (formData.memo_id) {
        // Get existing memo to check what changed (use queue)
        const { data: existingMemo, error: fetchError } = await requestQueue.enqueue(async () =>
          await supabase
            .from('memos')
            .select('*')
            .eq('id', formData.memo_id as string)
            .single()
        ) as any;

        if (!fetchError) {
          // Check if only attached files changed
          const contentFields = ['doc_number', 'subject', 'date', 'attachment_title', 'introduction', 'author_name', 'author_position', 'fact', 'proposal'];
          const hasContentChanges = contentFields.some(field => {
            const existingValue = existingMemo[field] || '';
            const newValue = formData[field] || '';
            return existingValue !== newValue;
          });

          // If only attached files changed and we have new files, skip PDF regeneration
          // BUT only if existing PDF still exists (not deleted, e.g., after rejection)
          if (!hasContentChanges && attachedFileUrls.length > 0 && existingMemo.pdf_draft_path) {
            shouldGenerateNewPdf = false;
            publicUrl = existingMemo.pdf_draft_path; // Keep existing PDF
          }

          // Delete old attached files when new files are uploaded (regardless of content changes)
          if (attachedFileUrls.length > 0 && existingMemo?.attached_files) {
            try {
              let oldFiles: string[] = [];
              if (typeof existingMemo.attached_files === 'string') {
                try {
                  oldFiles = JSON.parse(existingMemo.attached_files);
                } catch {
                  oldFiles = existingMemo.attached_files ? [existingMemo.attached_files] : [];
                }
              } else if (Array.isArray(existingMemo.attached_files)) {
                oldFiles = existingMemo.attached_files;
              }

              const oldFilePaths = oldFiles
                .filter((fileUrl: string) => fileUrl && fileUrl.includes('/documents/'))
                .map((fileUrl: string) => fileUrl.split('/documents/')[1]);

              if (oldFilePaths.length > 0) {
                await supabase.storage
                  .from('documents')
                  .remove(oldFilePaths);
              }
            } catch (error) {
              console.warn('Could not delete old attached files:', error);
            }
          }
        }
      }

      // Generate new PDF only if content changed or it's a new memo
      if (shouldGenerateNewPdf) {

        let pdfBlob: Blob;

        // Use pre-generated blob if available (from preview), otherwise call API
        if (preGeneratedPdfBlob) {
          pdfBlob = preGeneratedPdfBlob;
        } else {
          // Call Railway PDF API with queue + retry logic (max 3 retries with exponential backoff)
          // This ensures high success rate even under load (Railway can only handle 2 concurrent)
          pdfBlob = await railwayPDFQueue.enqueueWithRetry(
            async () => {
              // Format date to Thai before sending to API
              const formDataWithThaiDate = {
                ...formData,
                date: formData.date ? formatThaiDateFull(formData.date) : formData.date,
                doc_number: formData.doc_number ? convertToThaiNumerals(formData.doc_number) : formData.doc_number
              };

              // Line-wrap disabled - users will manually add line breaks
              // const processedFormData = await MemoService.preprocessMemoText(formDataWithThaiDate);

              const response = await railwayFetch('/pdf', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/pdf',
                },
                body: JSON.stringify(formDataWithThaiDate),
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
              }

              const blob = await response.blob();
              if (blob.size === 0) {
                throw new Error('Received empty PDF response');
              }

              return blob;
            },
            'PDF Generation',
            3, // max retries
            1000 // initial delay (1s, 2s, 4s)
          );
        }
        
        // Ensure valid auth session before upload
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            throw new Error('กรุณาเข้าสู่ระบบใหม่ (Session หมดอายุ)');
          }
        }

        // Upload PDF to Supabase Storage (use queue + retry)
        const fileName = `memo_${Date.now()}_${formData.doc_number.replace(/[^\w]/g, '_')}.pdf`;
        const filePath = `memos/${userId}/${fileName}`;

        const { data: uploadData, error: uploadError } = await requestQueue.enqueueWithRetry(
          () =>
            supabase.storage
              .from('documents')
              .upload(filePath, pdfBlob, {
                contentType: 'application/pdf',
                upsert: true
              }),
          'Storage Upload (PDF)',
          2, // max 2 retries
          500 // initial delay 500ms
        );

        if (uploadError) {
          throw new Error(`Failed to upload PDF: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl: newPublicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        
        publicUrl = newPublicUrl;
      }

      // Check if this is an update (edit mode)
      if (formData.memo_id) {
        // เก็บ path เก่าไว้ก่อน เพื่อลบหลังจาก database update สำเร็จ
        let oldPdfPathToDelete: string | null = null;
        
        if (shouldGenerateNewPdf) {
          const { data: existingMemoForDelete } = await supabase
            .from('memos')
            .select('pdf_draft_path')
            .eq('id', formData.memo_id)
            .single();

          if (existingMemoForDelete?.pdf_draft_path) {
            const extractedOldUrl = extractPdfUrl(existingMemoForDelete.pdf_draft_path);
            if (extractedOldUrl) {
              oldPdfPathToDelete = extractedOldUrl.split('/documents/')[1] || null;
            }
          }
        }
        
        // Update existing memo and reset current_signer_order to 1 (use queue)
        const { data, error } = await requestQueue.enqueue(async () =>
          await supabase
            .from('memos')
            .update({
              doc_number: formData.doc_number || undefined,
              subject: formData.subject,
              date: formData.date,
              attachment_title: formData.attachment_title,
              introduction: formData.introduction,
              author_name: formData.author_name,
              author_position: formData.author_position,
              fact: formData.fact,
              proposal: formData.proposal,
              form_data: { ...formData as any, type: 'create_memo' },
              pdf_draft_path: publicUrl,
              status: 'draft',
              attached_files: JSON.stringify(attachedFileUrls),
              current_signer_order: 1, // Reset to 1 after edit
              updated_at: new Date().toISOString()
            })
            .eq('id', formData.memo_id as string)
            .select()
            .single()
        ) as any;

        if (error) throw error;
        
        // ลบไฟล์ PDF เก่าหลังจาก database update สำเร็จแล้วเท่านั้น
        if (oldPdfPathToDelete) {
          try {
            await supabase.storage
              .from('documents')
              .remove([oldPdfPathToDelete]);
          } catch (deleteError) {
            // ไม่ throw error เพราะ database update สำเร็จแล้ว
          }
        }
        
        return { success: true, data };
      } else {
        // Create new memo (use queue)
        const { data, error } = await requestQueue.enqueue(async () =>
          await supabase
            .from('memos')
            .insert({
              doc_number: formData.doc_number,
              subject: formData.subject,
              date: formData.date,
              attachment_title: formData.attachment_title,
              introduction: formData.introduction,
              author_name: formData.author_name,
              author_position: formData.author_position,
              fact: formData.fact,
              proposal: formData.proposal,
              user_id: userId,
              form_data: { ...formData as any, type: 'create_memo' },
              pdf_draft_path: publicUrl,
              status: 'draft',
              attached_files: JSON.stringify(attachedFileUrls),
              current_signer_order: 1, // Set to 1 for new memo
              is_report_memo: formData.is_report_memo || false // Flag for report memos
            })
            .select()
            .single()
        ) as any;

        if (error) throw error;
        return { success: true, data };
      }
    } catch (error) {
      console.error('Error creating memo draft:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async updateSignaturePositions(memoId: string, positions: SignaturePosition[]): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('memos')
        .update({
          signature_positions: positions as any,
          status: 'pending_sign'
        })
        .eq('id', memoId);

      if (error) throw error;

      // Send notification to first signer
      if (positions.length > 0) {
        const firstSigner = positions.find(p => p.order === 1);
        if (firstSigner) {
          await this.sendNotification(memoId, firstSigner.user_id, 'signature_request', 'คุณมีเอกสารรอการลงนาม');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating signature positions:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async signMemo(memoId: string, userId: string, comment: string, action: 'approve' | 'reject'): Promise<{ success: boolean; error?: string }> {
    try {
      // Capture device fingerprint when signing
      const deviceInfo = getDeviceFingerprint();

      // Get current memo
      const { data: memo, error: fetchError } = await supabase
        .from('memos')
        .select('*')
        .eq('id', memoId)
        .single();

      if (fetchError) throw fetchError;

      const currentSignatures = (memo.signatures as any) || [];
      const positions = (memo.signature_positions as any) as SignaturePosition[] || [];

      // Find current user's position
      const userPosition = positions.find((p: SignaturePosition) => p.user_id === userId);
      if (!userPosition) {
        throw new Error('User not found in signature positions');
      }

      // Add signature
      const newSignature: MemoSignature = {
        user_id: userId,
        name: userPosition.name,
        position: userPosition.position,
        comment,
        signed_at: new Date().toISOString(),
        signature_url: userPosition.signature_url || '',
        status: action === 'approve' ? 'approved' : 'rejected',
        order: userPosition.order
      };

      const updatedSignatures = [...currentSignatures, newSignature];
      
      // ใช้ centralized logic จาก approvalWorkflowService
      let newStatus: string;
      let nextSignerOrder: number;

      if (action === 'reject') {
        const rejectionResult = calculateRejection();
        newStatus = rejectionResult.newStatus;
        nextSignerOrder = rejectionResult.nextSignerOrder;
      } else {
        const approvalResult = calculateNextSignerOrder(userPosition.order, positions);
        newStatus = approvalResult.newStatus;
        nextSignerOrder = approvalResult.nextSignerOrder;

        if (nextSignerOrder === SIGNER_ORDER.COMPLETED) {
          // Last signer approved - generate final PDF
          await this.generateFinalPDF(memo, updatedSignatures, positions);
        } else {
          // Send notification to next signer
          const nextSigner = positions.find((p: SignaturePosition) => p.order === nextSignerOrder);
          if (nextSigner) {
            await this.sendNotification(memoId, nextSigner.user_id, 'signature_request', 'คุณมีเอกสารรอการลงนาม');
          }
        }
      }

      // Update memo with device info
      const { error: updateError } = await supabase
        .from('memos')
        .update({
          signatures: updatedSignatures as any,
          status: newStatus,
          current_signer_order: nextSignerOrder,
          device_info: deviceInfo as any // Store device fingerprint
        })
        .eq('id', memoId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      console.error('Error signing memo:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async generateFinalPDF(memo: any, signatures: MemoSignature[], positions: SignaturePosition[]): Promise<void> {
    try {
      // Prepare form data for final PDF generation
      const formData = new FormData();
      
      // Get PDF draft from Supabase Storage
      const extractedPdfUrl = extractPdfUrl(memo.pdf_draft_path);
      if (!extractedPdfUrl) {
        throw new Error('ไม่สามารถดึง URL ไฟล์ PDF ได้');
      }
      
      const pdfResponse = await fetch(extractedPdfUrl);
      const pdfBlob = await pdfResponse.blob();
      formData.append('pdf', pdfBlob, 'draft.pdf');

      // Prepare signatures array
      const signaturesArray = [];
      
      for (const signature of signatures) {
        const position = positions.find(p => p.user_id === signature.user_id);
        if (position && signature.signature_url) {
          // Add signature image
          signaturesArray.push({
            type: 'image',
            page: position.page,
            x: position.x,
            y: position.y,
            file_key: `sig${signature.order}`
          });

          // Add comment text
          signaturesArray.push({
            type: 'text',
            page: position.page,
            x: position.x + 100,
            y: position.y,
            text: signature.comment
          });

          // Add signature image file
          const sigResponse = await fetch(signature.signature_url);
          const sigBlob = await sigResponse.blob();
          formData.append(`sig${signature.order}`, sigBlob, `signature${signature.order}.png`);
        }
      }

      formData.append('signatures', JSON.stringify(signaturesArray));

      // Call Railway add_signature API with queue + retry logic
      const finalPdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const response = await railwayFetch('/add_signature', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
          }

          return await response.blob();
        },
        'Add Signature',
        3, // max retries
        1000 // initial delay
      );
      
      // Upload final PDF to Supabase Storage
      const finalFileName = `memo_final_${Date.now()}_${memo.doc_number.replace(/[^\w]/g, '_')}.pdf`;
      const finalFilePath = `memos/${memo.created_by}/${finalFileName}`;

      const { data: finalUploadData, error: finalUploadError } = await supabase.storage
        .from('documents')
        .upload(finalFilePath, finalPdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (finalUploadError) {
        throw new Error(`Failed to upload final PDF: ${finalUploadError.message}`);
      }

      // Get public URL for final PDF
      const { data: { publicUrl: finalPublicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(finalFilePath);

      // Update memo with final PDF
      await supabase
        .from('memos')
        .update({ pdf_final_path: finalPublicUrl })
        .eq('id', memo.id);

    } catch (error) {
      console.error('Error generating final PDF:', error);
    }
  }

  static async sendNotification(memoId: string, userId: string, type: string, message: string): Promise<void> {
    try {
      await supabase
        .from('memo_notifications')
        .insert({
          memo_id: memoId,
          user_id: userId,
          type,
          message
        });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  static async getMemo(memoId: string): Promise<{ success: boolean; data?: Memo; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('memos')
        .select('*')
        .eq('id', memoId)
        .single();

      if (error) throw error;

      return { success: true, data: data as unknown as Memo };
    } catch (error) {
      console.error('Error fetching memo:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static async getUserMemos(userId: string): Promise<{ success: boolean; data?: Memo[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('memos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data as unknown as Memo[] };
    } catch (error) {
      console.error('Error fetching user memos:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Soft delete a memo by marking it as deleted instead of removing from database
   * @param memoId - The ID of the memo to delete
   * @param userId - The ID of the user performing the delete action
   * @param userName - The name of the user performing the delete action
   * @returns Promise with success status and optional error message
   */
  static async softDeleteMemo(memoId: string, userId: string, userName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const deletionMetadata = {
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deleted_by_name: userName
      };

      const { error } = await supabase
        .from('memos')
        .update({
          doc_del: deletionMetadata
        } as any)
        .eq('id', memoId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error soft deleting memo:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Soft delete a doc_receive by marking it as deleted instead of removing from database
   * @param docReceiveId - The ID of the doc_receive to delete
   * @param userId - The ID of the user performing the delete action
   * @param userName - The name of the user performing the delete action
   * @returns Promise with success status and optional error message
   */
  static async softDeleteDocReceive(docReceiveId: string, userId: string, userName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const deletionMetadata = {
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deleted_by_name: userName
      };

      const { error } = await (supabase as any)
        .from('doc_receive')
        .update({
          doc_del: deletionMetadata
        })
        .eq('id', docReceiveId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error soft deleting doc_receive:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

}