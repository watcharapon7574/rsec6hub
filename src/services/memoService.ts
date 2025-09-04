import { supabase } from '@/integrations/supabase/client';
import { Memo, MemoFormData, SignaturePosition, MemoSignature } from '@/types/memo';
import { extractPdfUrl } from '@/utils/fileUpload';

export class MemoService {
  // Helper function to upload files to storage
  static async uploadAttachedFiles(files: File[], userId: string): Promise<string[]> {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      try {
        const fileExtension = file.name.split('.').pop();
        const fileName = `attachment_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
        const filePath = `memos/${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          continue;
        }

        // Get public URL
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

  static async createMemoDraft(formData: MemoFormData & { memo_id?: string; attachedFileObjects?: File[] }, userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
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
        // Get existing memo to check what changed
        const { data: existingMemo, error: fetchError } = await supabase
          .from('memos')
          .select('*')
          .eq('id', formData.memo_id)
          .single();

        if (fetchError) {
          console.warn('Could not fetch existing memo for comparison:', fetchError);
        } else {
          // Check if only attached files changed
          const contentFields = ['doc_number', 'subject', 'date', 'attachment_title', 'introduction', 'author_name', 'author_position', 'fact', 'proposal'];
          const hasContentChanges = contentFields.some(field => {
            const existingValue = existingMemo[field] || '';
            const newValue = formData[field] || '';
            return existingValue !== newValue;
          });

          // If only attached files changed and we have new files, skip PDF regeneration
          if (!hasContentChanges && attachedFileUrls.length > 0) {
            console.log('📎 Only attached files changed - skipping PDF regeneration');
            shouldGenerateNewPdf = false;
            publicUrl = existingMemo.pdf_draft_path; // Keep existing PDF
            
            // Delete old attached files if new files are uploaded
            if (existingMemo?.attached_files) {
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
      }

      // Generate new PDF only if content changed or it's a new memo
      if (shouldGenerateNewPdf) {
        console.log('📄 Generating new PDF...');
        // Call external API to generate PDF draft with CORS handling
        const response = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/pdf',
           
          },
          mode: 'cors',
          credentials: 'omit',
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const pdfBlob = await response.blob();
        if (pdfBlob.size === 0) {
          throw new Error('Received empty PDF response');
        }
        
        // Upload PDF to Supabase Storage
        const fileName = `memo_${Date.now()}_${formData.doc_number.replace(/[^\w]/g, '_')}.pdf`;
        const filePath = `memos/${userId}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          throw new Error(`Failed to upload PDF: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl: newPublicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        
        publicUrl = newPublicUrl;

        // Delete old PDF file if this is an update
        if (formData.memo_id) {
          const { data: existingMemo } = await supabase
            .from('memos')
            .select('pdf_draft_path')
            .eq('id', formData.memo_id)
            .single();

          if (existingMemo?.pdf_draft_path) {
            try {
              const extractedPdfUrl = extractPdfUrl(existingMemo.pdf_draft_path);
              if (extractedPdfUrl) {
                const oldPdfPath = extractedPdfUrl.split('/documents/')[1];
                if (oldPdfPath) {
                  await supabase.storage
                    .from('documents')
                    .remove([oldPdfPath]);
                }
              }
            } catch (error) {
              console.warn('Could not delete old PDF file:', error);
            }
          }
        }
      }

      // Check if this is an update (edit mode)
      if (formData.memo_id) {
        // Update existing memo and reset current_signer_order to 1
        const { data, error } = await supabase
          .from('memos')
          .update({
            doc_number: formData.doc_number,
            subject: formData.subject,
            date: formData.date,
            attachment_title: formData.attachment_title,
            introduction: formData.introduction,
            author_name: formData.author_name,
            author_position: formData.author_position,
            fact: formData.fact,
            proposal: formData.proposal,
            form_data: formData as any,
            pdf_draft_path: publicUrl,
            status: 'draft',
            attached_files: JSON.stringify(attachedFileUrls),
            current_signer_order: 1, // Reset to 1 after edit
            updated_at: new Date().toISOString()
          })
          .eq('id', formData.memo_id)
          .select()
          .single();

        if (error) throw error;
        return { success: true, data };
      } else {
        // Create new memo
        const { data, error } = await supabase
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
            form_data: formData as any,
            pdf_draft_path: publicUrl,
            status: 'draft',
            attached_files: JSON.stringify(attachedFileUrls),
            current_signer_order: 1 // Set to 1 for new memo
          })
          .select()
          .single();

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
      
      let newStatus = memo.status;
      let nextSignerOrder = memo.current_signer_order;

      if (action === 'reject') {
        newStatus = 'rejected';
        nextSignerOrder = 0; // Set to 0 for reject
      } else {
        // Check if this is the last signer
        const maxOrder = Math.max(...positions.map((p: SignaturePosition) => p.order));
        if (userPosition.order === maxOrder) {
          // Last signer approved - generate final PDF
          newStatus = 'approved';
          await this.generateFinalPDF(memo, updatedSignatures, positions);
          nextSignerOrder = 5; // Set to 5 for last approved
        } else {
          // Move to next signer
          nextSignerOrder = userPosition.order + 1;
          const nextSigner = positions.find((p: SignaturePosition) => p.order === nextSignerOrder);
          if (nextSigner) {
            await this.sendNotification(memoId, nextSigner.user_id, 'signature_request', 'คุณมีเอกสารรอการลงนาม');
          }
        }
      }

      // Update memo
      const { error: updateError } = await supabase
        .from('memos')
        .update({
          signatures: updatedSignatures as any,
          status: newStatus,
          current_signer_order: nextSignerOrder
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

      // Call add_signature API
      const response = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/add_signature', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const finalPdfBlob = await response.blob();
      
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

}