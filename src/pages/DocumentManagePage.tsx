import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProfiles } from '@/hooks/useProfiles';
import { useAllMemos } from '@/hooks/useAllMemos';
import { submitPDFSignature } from '@/services/pdfSignatureService';
import { mergeMemoWithAttachments } from '@/services/memoManageAPIcall';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { extractPdfUrl } from '@/utils/fileUpload';
import { SignerProgress } from '@/types/memo';
import { railwayPDFQueue } from '@/utils/requestQueue';

// Import step components
import Step1DocumentNumber from '@/components/DocumentManage/Step1DocumentNumber';
import Step2SelectSigners from '@/components/DocumentManage/Step2SelectSigners';
import Step3SignaturePositions from '@/components/DocumentManage/Step3SignaturePositions';
import Step4Review from '@/components/DocumentManage/Step4Review';

const DocumentManagePage: React.FC = () => {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profiles } = useProfiles();
  const { getMemoById, updateMemoStatus, updateMemoSigners, refetch } = useAllMemos();

  // State
  const [documentNumber, setDocumentNumber] = useState('');
  const [selectedAssistant, setSelectedAssistant] = useState<string>('');
  const [selectedDeputy, setSelectedDeputy] = useState<string>('');
  const [signaturePositions, setSignaturePositions] = useState<any[]>([]);
  const [comment, setComment] = useState(''); // สำหรับ comment ต่อตำแหน่งลายเซ็น
  const [documentSummary, setDocumentSummary] = useState(''); // สำหรับสรุปเนื้อหาเอกสาร (แยกออกจาก comment)
  const [selectedSignerIndex, setSelectedSignerIndex] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState({
    title: "กำลังดำเนินการ",
    description: "กรุณารอสักครู่..."
  });
  const [isAssigningNumber, setIsAssigningNumber] = useState(false);
  const [isNumberAssigned, setIsNumberAssigned] = useState(false);

  // Calculate current year dynamically
  const currentBuddhistYear = new Date().getFullYear() + 543;
  const yearShort = currentBuddhistYear.toString().slice(-2); // เอา 2 ตัวท้าย เช่น 69

  const [suggestedDocNumber, setSuggestedDocNumber] = useState(`xxx/${yearShort}`);
  const [docNumberSuffix, setDocNumberSuffix] = useState('');

  // Get user profile for API calls
  const { profile } = useEmployeeAuth();

  // Get memo data
  const memo = memoId ? getMemoById(memoId) : null;

  // Debug log for memo
  React.useEffect(() => {
    console.log('📄 DocumentManagePage memo:', {
      memoId,
      hasMemo: !!memo,
      id: memo?.id,
      subject: memo?.subject,
      pdf_draft_path: memo?.pdf_draft_path,
      hasPdf: !!memo?.pdf_draft_path
    });
  }, [memoId, memo]);

  // Get latest document number and generate suggestion
  const getLatestDocNumber = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('memos')
        .select('doc_number, doc_number_status')
        .not('doc_number_status', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10); // ดึงล่าสุด 10 รายการมาเรียง

      if (error) {
        console.error('Error fetching latest doc numbers:', error);
        return;
      }

      if (data && data.length > 0) {
        // หาเลขล่าสุดที่มี timestamp ใหม่ที่สุด
        let latestDoc = null;
        let latestTimestamp = null;

        for (const item of data) {
          const docData = item as any;
          if (docData.doc_number && docData.doc_number_status) {
            let timestamp = null;
            
            // ตรวจสอบ format ของ doc_number_status
            if (typeof docData.doc_number_status === 'object' && docData.doc_number_status.assigned_at) {
              timestamp = docData.doc_number_status.assigned_at;
            }
            
            if (timestamp && (!latestTimestamp || timestamp > latestTimestamp)) {
              latestTimestamp = timestamp;
              latestDoc = docData.doc_number;
            }
          }
        }

        if (latestDoc) {
          // ตรวจสอบและแยกเลขจากรูปแบบ
          let docToProcess = latestDoc;
          
          // ถ้าเป็น full format ให้แยก suffix ออกมา
          if (latestDoc.startsWith('ศธ ๐๔๐๐๗.๖๐๐/') || latestDoc.includes('ศธ')) {
            const match = latestDoc.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
            if (match) {
              docToProcess = match[1];
            }
          }
          
          // แยกเลขจากรูปแบบ เช่น "4567/68"
          const match = docToProcess.match(/(\d+)\/(\d+)$/);
          if (match) {
            const lastNumber = parseInt(match[1]);
            const nextNumber = lastNumber + 1;
            // ใช้ปีปัจจุบันแทนปีจากเอกสารเก่า
            setSuggestedDocNumber(`${nextNumber}/${yearShort}`);
          }
        }
      }
    } catch (error) {
      console.error('Error processing latest doc number:', error);
    }
  }, []);

  // Get suggestion when component mounts
  React.useEffect(() => {
    getLatestDocNumber();
  }, [getLatestDocNumber]);

  // Check document number status from database
  const checkDocumentNumberStatus = React.useCallback(async () => {
    if (!memoId) return;
    
    try {
      const { data, error } = await supabase
        .from('memos')
        .select('doc_number, doc_number_status')
        .eq('id', memoId)
        .single();

      if (error) {
        console.error('Error checking document number status:', error);
        return;
      }

      if (data) {
        // Check if doc_number_status is JSONB or string
        let statusAssigned = false;
        
        if ((data as any).doc_number_status) {
          const statusData = (data as any).doc_number_status;
          if (typeof statusData === 'object' && statusData.status) {
            // JSONB format
            statusAssigned = statusData.status === 'ลงเลขหนังสือแล้ว';
          } else if (typeof statusData === 'string') {
            // Old string format
            statusAssigned = statusData === 'ลงเลขหนังสือแล้ว';
          }
        }
        
        setIsNumberAssigned(statusAssigned);
        if ((data as any).doc_number) {
          const docNumber = (data as any).doc_number;

          // ตรวจสอบว่า doc_number เป็น full format หรือ suffix only
          if (docNumber.startsWith('ศธ ๐๔๐๐๗.๖๐๐/') || docNumber.includes('ศธ')) {
            // กรณีที่เป็น full format - extract suffix เท่านั้น
            const fullDocNumber = docNumber;
            setDocumentNumber(fullDocNumber);
            // ลอง extract suffix ด้วยหลายรูปแบบ regex
            const match = fullDocNumber.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
            if (match) {
              setDocNumberSuffix(match[1]);
            } else {
              // ถ้า regex ไม่ match ลองตัด prefix ออกโดยตรง
              const prefixPatterns = ['ศธ ๐๔๐๐๗.๖๐๐/', 'ศธ๐๔๐๐๗.๖๐๐/', 'ศธ ๐๔๐๐๗.๖๐๐ /'];
              let suffix = docNumber;
              for (const prefix of prefixPatterns) {
                if (docNumber.includes(prefix)) {
                  suffix = docNumber.split(prefix).pop() || docNumber;
                  break;
                }
              }
              setDocNumberSuffix(suffix);
            }
          } else {
            // กรณีที่เป็น suffix only (ใหม่)
            const suffix = docNumber;
            const fullDocNumber = `ศธ ๐๔๐๐๗.๖๐๐/${suffix}`;
            setDocumentNumber(fullDocNumber);
            setDocNumberSuffix(suffix);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching document status:', error);
    }
  }, [memoId]);

  // Check status when component mounts and when memoId changes
  React.useEffect(() => {
    checkDocumentNumberStatus();
  }, [checkDocumentNumberStatus]);

  // Also check from memo data as backup
  React.useEffect(() => {
    if (memo?.doc_number_status) {
      let isAssigned = false;
      const statusData = memo.doc_number_status;
      
      if (typeof statusData === 'object' && (statusData as any).status) {
        // JSONB format
        isAssigned = (statusData as any).status === 'ลงเลขหนังสือแล้ว';
      } else if (typeof statusData === 'string') {
        // Old string format
        isAssigned = statusData === 'ลงเลขหนังสือแล้ว';
      }
      
      if (isAssigned) {
        setIsNumberAssigned(true);
        if (memo.doc_number) {
          const docNumber = memo.doc_number;

          // ตรวจสอบว่า doc_number เป็น full format หรือ suffix only
          if (docNumber.startsWith('ศธ ๐๔๐๐๗.๖๐๐/') || docNumber.includes('ศธ')) {
            // กรณีที่เป็น full format - extract suffix เท่านั้น
            const fullDocNumber = docNumber;
            setDocumentNumber(fullDocNumber);
            // ลอง extract suffix ด้วยหลายรูปแบบ regex
            const match = fullDocNumber.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
            if (match) {
              setDocNumberSuffix(match[1]);
            } else {
              // ถ้า regex ไม่ match ลองตัด prefix ออกโดยตรง
              const prefixPatterns = ['ศธ ๐๔๐๐๗.๖๐๐/', 'ศธ๐๔๐๐๗.๖๐๐/', 'ศธ ๐๔๐๐๗.๖๐๐ /'];
              let suffix = docNumber;
              for (const prefix of prefixPatterns) {
                if (docNumber.includes(prefix)) {
                  suffix = docNumber.split(prefix).pop() || docNumber;
                  break;
                }
              }
              setDocNumberSuffix(suffix);
            }
          } else {
            // กรณีที่เป็น suffix only (ใหม่)
            const suffix = docNumber;
            const fullDocNumber = `ศธ ๐๔๐๐๗.๖๐๐/${suffix}`;
            setDocumentNumber(fullDocNumber);
            setDocNumberSuffix(suffix);
          }
        }
      }
    }
  }, [memo]);

  // Get profiles by position
  const assistantDirectors = profiles.filter(p => p.position === 'assistant_director');
  const deputyDirectors = profiles.filter(p => p.position === 'deputy_director');
  // ผอ. ต้องเป็น user_id นี้เท่านั้น
  const directors = profiles.filter(p => p.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b');
  const authorProfile = memo ? profiles.find(p => p.user_id === memo.user_id) : null;

  // Build signers list
  const signers = React.useMemo(() => {
    const list = [];
    let currentOrder = 1;
    
    // 1. ผู้เขียน (เสมอ)
    if (authorProfile) {
      const fullName = `${authorProfile.prefix || ''}${authorProfile.first_name} ${authorProfile.last_name}`.trim();
      list.push({
        order: currentOrder++,
        user_id: authorProfile.user_id,
        name: fullName,
        position: authorProfile.current_position || authorProfile.position,
        role: 'author',
        academic_rank: authorProfile.academic_rank,
        org_structure_role: authorProfile.org_structure_role,
        prefix: authorProfile.prefix,
        signature_url: authorProfile.signature_url
      });
    }

    // 2. ผู้ช่วยผู้อำนวยการที่เลือก (ถ้ามี)
    if (selectedAssistant && selectedAssistant !== 'skip') {
      const assistant = assistantDirectors.find(p => p.user_id === selectedAssistant);
      if (assistant) {
        const fullName = `${assistant.prefix || ''}${assistant.first_name} ${assistant.last_name}`.trim();
        list.push({
          order: currentOrder++,
          user_id: assistant.user_id,
          name: fullName,
          position: assistant.current_position || assistant.position,
          role: 'assistant_director',
          academic_rank: assistant.academic_rank,
          org_structure_role: assistant.org_structure_role,
          prefix: assistant.prefix,
          signature_url: assistant.signature_url
        });
      }
    }

    // 3. รองผู้อำนวยการที่เลือก (ถ้ามี)
    if (selectedDeputy && selectedDeputy !== 'skip') {
      const deputy = deputyDirectors.find(p => p.user_id === selectedDeputy);
      if (deputy) {
        const fullName = `${deputy.prefix || ''}${deputy.first_name} ${deputy.last_name}`.trim();
        list.push({
          order: currentOrder++,
          user_id: deputy.user_id,
          name: fullName,
          position: deputy.current_position || deputy.position,
          role: 'deputy_director',
          academic_rank: deputy.academic_rank,
          org_structure_role: deputy.org_structure_role,
          prefix: deputy.prefix,
          signature_url: deputy.signature_url
        });
      }
    }

    // 4. ผู้อำนวยการ (เสมอ) - user_id: 28ef1822-628a-4dfd-b7ea-2defa97d755b
    const director = directors.find(d => d.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b') || directors[0];
    if (director) {
      const fullName = `${director.prefix || ''}${director.first_name} ${director.last_name}`.trim();
      list.push({
        order: currentOrder++,
        user_id: director.user_id,
        name: fullName,
        position: director.current_position || director.position,
        role: 'director',
        academic_rank: director.academic_rank,
        org_structure_role: 'ผู้อำนวยการ', // บังคับให้เป็น ผู้อำนวยการ เสมอ
        prefix: director.prefix,
        signature_url: director.signature_url
      });
    }

    return list;
  }, [authorProfile, selectedAssistant, selectedDeputy, assistantDirectors, deputyDirectors, directors]);

  // Debug: Log signers with prefix information
  React.useEffect(() => {
    if (signers.length > 0) {
      console.log('📝 Signers data for signature pins:', signers.map(s => ({
        order: s.order,
        role: s.role,
        name: s.name,
        prefix: s.prefix,
        academic_rank: s.academic_rank,
        org_structure_role: s.org_structure_role,
        position: s.position
      })));
      
      console.log('📋 Final signer order after skip logic:', 
        signers.map(s => `${s.order}. ${s.name} (${s.role})`).join(', ')
      );
    }
  }, [signers]);

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1: return (docNumberSuffix.trim() !== '' || suggestedDocNumber !== '') && isNumberAssigned;
      case 2: return true; // ไม่บังคับให้เลือก - สามารถข้ามได้
      case 3: return signaturePositions.length >= 1; // เปลี่ยนเป็นมีลายเซ็นอย่างน้อย 1 ตำแหน่ง
      default: return false;
    }
  };

  // Function to convert date to Thai format
  const formatThaiDate = (dateString: string) => {
    const date = new Date(dateString);
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543; // Convert to Buddhist Era
    
    return `${day} ${month} ${year}`;
  };

  // Function to regenerate PDF with document number
  const regeneratePdfWithDocNumber = async (docSuffix: string) => {
    if (!memo || !profile?.user_id) return null;

    try {
      console.log('📄 Regenerating PDF with document suffix:', docSuffix);
      
      // Prepare form data for API call
      const formData = {
        doc_number: docSuffix, // ส่งแค่ส่วน 4568/68 เพราะใน template มี ศธ ๐๔๐๐๗.๖๐๐/ อยู่แล้ว
        date: formatThaiDate(memo.date || new Date().toISOString().split('T')[0]),
        subject: memo.subject || '',
        attachment_title: memo.attachment_title || '',
        introduction: memo.introduction || '',
        author_name: memo.author_name || '',
        author_position: memo.author_position || '',
        fact: memo.fact || '',
        proposal: memo.proposal || '',
        attached_files: memo.attached_files || []
      };

      // Call Railway PDF API with queue + retry logic
      const pdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
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

          const blob = await response.blob();
          if (blob.size === 0) {
            throw new Error('Received empty PDF response');
          }

          return blob;
        },
        'PDF Generation (Document Number)',
        3,
        1000
      );
      
      // Upload new PDF to Supabase Storage (overwrite existing)
      const fileName = `memo_${Date.now()}_${docSuffix.replace(/[^\w]/g, '_')}.pdf`;
      const filePath = `memos/${profile.user_id}/${fileName}`;

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
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error regenerating PDF:', error);
      throw error;
    }
  };

  // Function to assign document number
  const handleAssignNumber = async () => {
    // ใช้ค่าจาก input หรือใช้ค่า suggested ถ้าไม่ได้กรอกอะไร
    let finalDocSuffix = docNumberSuffix.trim() || suggestedDocNumber;
    
    // ตรวจสอบและแยกเอาเฉพาะ suffix ออกมา ถ้ามี prefix อยู่
    const match = finalDocSuffix.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
    if (match) {
      finalDocSuffix = match[1];
      console.log('Extracted suffix from full number:', finalDocSuffix);
    }
    
    if (!finalDocSuffix) {
      toast({
        title: "กรุณากรอกเลขหนังสือ",
        variant: "destructive",
      });
      return;
    }

    if (!memoId) return;

    const fullDocNumber = `ศธ ๐๔๐๐๗.๖๐๐/${finalDocSuffix}`;
    setDocumentNumber(fullDocNumber);
    setDocNumberSuffix(finalDocSuffix); // อัปเดตให้แสดงในช่องกรอก

    setIsAssigningNumber(true);
    try {
      const now = new Date().toISOString();
      const docNumberStatusData = {
        status: 'ลงเลขหนังสือแล้ว',
        assigned_at: now
      };

      // Regenerate PDF with document number
      const newPdfUrl = await regeneratePdfWithDocNumber(finalDocSuffix);

      // Update memo with document number, status, clerk_id, and new PDF URL
      const updateData: any = {
        doc_number: finalDocSuffix, // บันทึกแค่ส่วน suffix เช่น 4571/68
        doc_number_status: docNumberStatusData,
        clerk_id: profile?.user_id, // บันทึก user_id ของ clerk_teacher ที่ลงเลขหนังสือ
        updated_at: now
      };

      console.log('📝 Step 1 - Recording clerk_id:', profile?.user_id, 'for memo:', memoId);

      // Update PDF path if regeneration was successful
      if (newPdfUrl) {
        updateData.pdf_draft_path = newPdfUrl;
      }

      const { error } = await supabase
        .from('memos')
        .update(updateData)
        .eq('id', memoId);

      if (error) {
        throw error;
      }

      // Refetch เพื่ออัปเดต memo state ให้เป็นค่าล่าสุดจาก database
      await refetch();

      setIsNumberAssigned(true);
      toast({
        title: "ลงเลขหนังสือสำเร็จ",
        description: `เลขหนังสือ ${fullDocNumber} ถูกบันทึกและสร้าง PDF ใหม่แล้ว`,
      });
    } catch (error) {
      console.error('Error assigning document number:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถลงเลขหนังสือได้",
        variant: "destructive",
      });
    } finally {
      setIsAssigningNumber(false);
    }
  };

  const handleNext = async () => {
    // If moving from step 1 to step 2, call PDFmerge API
    if (currentStep === 1 && memo) {
      setLoadingMessage({
        title: "กำลังประมวลผลไฟล์เอกสาร",
        description: "ระบบกำลังรวมไฟล์เอกสารหลักกับไฟล์แนบ กรุณารอสักครู่..."
      });
      setShowLoadingModal(true); // เริ่มแสดง loading modal
      
      try {
        // Get attached files
        let attachedFiles = [];
        if (memo.attached_files) {
          try {
            if (typeof memo.attached_files === 'string') {
              const parsed = JSON.parse(memo.attached_files);
              attachedFiles = Array.isArray(parsed) ? parsed : [];
            } else if (Array.isArray(memo.attached_files)) {
              attachedFiles = memo.attached_files;
            }
          } catch {
            attachedFiles = [];
          }
        }

        // Only call merge API if there are attached files
        if (attachedFiles.length > 0) {
          console.log('🔄 Starting PDF merge with attached files:', attachedFiles);
          
          const mergeResult = await mergeMemoWithAttachments({
            memoId: memo.id,
            mainPdfPath: memo.pdf_draft_path,
            attachedFiles: attachedFiles
          });

          if (mergeResult.success && mergeResult.mergedPdfUrl) {
            // Update the memo in database to remove attached files and update PDF path
            try {
              const { error: updateError } = await supabase
                .from('memos')
                .update({
                  pdf_draft_path: mergeResult.mergedPdfUrl,
                  attached_files: null, // Remove attached files since they're now merged
                  attachment_title: null // Clear attachment title as well
                })
                .eq('id', memo.id);

              if (updateError) {
                console.error('Error updating memo after merge:', updateError);
                toast({
                  title: "เกิดข้อผิดพลาด",
                  description: "ไม่สามารถอัพเดตข้อมูลเมโมหลังจากรวมไฟล์ได้",
                  variant: "destructive"
                });
                setShowLoadingModal(false);
                return;
              }

              toast({
                title: "รวมไฟล์สำเร็จ",
                description: "รวมไฟล์เอกสารหลักกับไฟล์แนบเรียบร้อยแล้ว ไฟล์แนบถูกลบออกแล้ว",
              });

              console.log('✅ PDF merge completed and memo updated successfully');

              // Refresh memo data เพื่ออัปเดต UI
              await refetch();
              console.log('🔄 Memo data refreshed after merge');
            } catch (dbError) {
              console.error('Database update error after merge:', dbError);
              toast({
                title: "เกิดข้อผิดพลาด",
                description: "ไม่สามารถอัพเดตฐานข้อมูลหลังจากรวมไฟล์ได้",
                variant: "destructive"
              });
              setShowLoadingModal(false);
              return;
            }
          } else {
            toast({
              title: "เกิดข้อผิดพลาดในการรวมไฟล์",
              description: mergeResult.error || "ไม่สามารถรวมไฟล์ได้",
              variant: "destructive"
            });
            setShowLoadingModal(false);
            return; // Don't proceed to next step if merge fails
          }
        } else {
          console.log('ℹ️ No attached files found, skipping PDF merge');
        }
      } catch (error) {
        console.error('Error calling PDFmerge:', error);
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถเรียกใช้งาน API รวมไฟล์ได้",
          variant: "destructive"
        });
        setShowLoadingModal(false);
        return; // Don't proceed to next step if there's an error
      } finally {
        setShowLoadingModal(false); // ปิด loading modal เมื่อเสร็จสิ้น
      }
    }

    // If moving from step 2 to step 3, save signer_list_progress
    if (currentStep === 2 && memo && memoId) {
      try {
        // Create signer_list_progress data with order, position, name, first_name, last_name
        const signerListProgress: SignerProgress[] = signers.map(signer => {
          // Find profile for first_name and last_name
          const signerProfile = profiles.find(p => p.user_id === signer.user_id);

          return {
            order: signer.order,
            position: signer.position || signer.role,
            name: signer.name,
            role: signer.role,
            user_id: signer.user_id,
            first_name: signerProfile?.first_name || '',
            last_name: signerProfile?.last_name || '',
            org_structure_role: signerProfile?.org_structure_role || signer.org_structure_role
          };
        });

        console.log('📊 Saving signer_list_progress:', signerListProgress);

        // Update memo with signer_list_progress (using type assertion for database compatibility)
        const { error: updateError } = await supabase
          .from('memos')
          .update({
            signer_list_progress: signerListProgress
          } as any)
          .eq('id', memoId);

        if (updateError) {
          console.error('Error updating signer_list_progress:', updateError);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถบันทึกข้อมูลผู้ลงนามได้",
            variant: "destructive"
          });
          return;
        }

        console.log('✅ Signer list progress saved successfully');
        toast({
          title: "บันทึกข้อมูลผู้ลงนามสำเร็จ",
          description: `บันทึกรายชื่อผู้ลงนาม ${signers.length} คน เรียบร้อยแล้ว`,
        });

      } catch (error) {
        console.error('Error saving signer_list_progress:', error);
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถบันทึกข้อมูลผู้ลงนามได้",
          variant: "destructive"
        });
        return;
      }
    }

    // Proceed to next step
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!documentNumber.trim()) {
      toast({
        title: "กรุณากรอกเลขหนังสือ",
        variant: "destructive",
      });
      return;
    }

    // ลบการตรวจสอบบังคับให้เลือกผู้ช่วยและรองผู้อำนวยการ
    // เพราะสามารถข้ามได้

    if (signaturePositions.length < 1) {
      toast({
        title: "กรุณาวางตำแหน่งลายเซ็น",
        description: "กรุณาวางตำแหน่งลายเซ็นอย่างน้อย 1 ตำแหน่ง",
        variant: "destructive",
      });
      return;
    }

    // เปิด loading modal ทันทีที่เริ่มกระบวนการ
    setLoadingMessage({
      title: "กำลังดำเนินการส่งเสนอเอกสาร",
      description: "กรุณารอสักครู่..."
    });
    setShowLoadingModal(true);

    if (memoId) {
      // 1. อัปเดต signature positions ให้รวม prefix ในชื่อ
      const updatedSignaturePositions = signaturePositions.map(pos => {
        const signer = signers.find(s => s.user_id === pos.signer.user_id);
        if (signer && signer.prefix) {
          // ตรวจสอบว่าชื่อมี prefix อยู่แล้วหรือไม่
          const nameWithoutPrefix = pos.signer.name.replace(new RegExp(`^${signer.prefix}`), '').trim();
          const nameWithPrefix = `${signer.prefix}${nameWithoutPrefix}`;
          
          return {
            ...pos,
            signer: {
              ...pos.signer,
              name: nameWithPrefix
            }
          };
        }
        return pos;
      });

      console.log('📝 Updated signature positions with prefix:', updatedSignaturePositions.map((p, i) => ({
        original: signaturePositions[i].signer.name,
        updated: p.signer.name,
        prefix: signers.find(s => s.user_id === p.signer.user_id)?.prefix
      })));

      // 1.5. บันทึกสรุปเนื้อหาเอกสาร (ใช้ documentSummary แทน comment เพราะ comment จะถูก clear เมื่อวางตำแหน่ง)
      console.log('🔍 Attempting to save document summary:', {
        hasDocumentSummary: !!documentSummary.trim(),
        documentSummaryLength: documentSummary.trim().length,
        documentSummary: documentSummary.trim(),
        memoId
      });

      if (documentSummary.trim()) {
        try {
          const { error: updateError } = await supabase
            .from('memos')
            .update({
              document_summary: documentSummary.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', memoId);

          if (updateError) {
            console.error('❌ Error updating document summary:', updateError);
            setShowLoadingModal(false);
            toast({
              title: "คำเตือน",
              description: `ไม่สามารถบันทึกความหมายโดยสรุปได้: ${updateError.message}`,
              variant: "destructive",
            });
            return;
          } else {
            console.log('✅ Document summary updated successfully:', documentSummary.trim());
          }
        } catch (err) {
          console.error('❌ Failed to update document summary:', err);
          setShowLoadingModal(false);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถบันทึกความหมายโดยสรุปได้",
            variant: "destructive",
          });
          return;
        }
      } else {
        console.log('⚠️ No document summary provided - skipping save');
      }

      // 2. อัปเดต signers/ตำแหน่ง
      await updateMemoSigners(memoId, signers, updatedSignaturePositions);

      // 2. เรียก API ลายเซ็นสำหรับธุการ (author)
      let signSuccess = false;
      let signedPdfBlob: Blob | null = null;
      const shouldSign = memo && memo.pdf_draft_path && authorProfile && authorProfile.signature_url;

      if (shouldSign) {
        const extractedPdfUrl = extractPdfUrl(memo.pdf_draft_path);
        if (!extractedPdfUrl) {
          toast({
            title: "ข้อผิดพลาด",
            description: "ไม่สามารถดึง URL ไฟล์ PDF ได้",
            variant: "destructive",
          });
          return;
        }
        try {
          // เตรียม lines สำหรับธุการ/author
          const authorSigner = signers.find(s => s.role === 'author');
          const authorNameWithPrefix = authorSigner?.name || `${authorProfile.first_name} ${authorProfile.last_name}`;
          
          const lines = [
            { type: "image", file_key: "sig1" },
            { type: "name", value: authorNameWithPrefix },
            { type: "academic_rank", value: `ตำแหน่ง ${authorProfile.academic_rank || authorProfile.job_position || authorProfile.position || ''}` }
          ];
          // ดาวน์โหลด PDF
          console.log('📥 Fetching PDF from:', extractedPdfUrl);
          const pdfRes = await fetch(extractedPdfUrl);
          if (!pdfRes.ok) {
            console.error('❌ Failed to fetch PDF:', pdfRes.status, pdfRes.statusText);
            setShowLoadingModal(false);
            toast({
              title: 'ไม่พบไฟล์ PDF',
              description: `ไม่สามารถดาวน์โหลดไฟล์ PDF ได้ (${pdfRes.status}) กรุณารีเฟรชหน้าและลองใหม่`,
              variant: 'destructive'
            });
            return;
          }
          const pdfBlob = await pdfRes.blob();
          console.log('✅ PDF fetched successfully, size:', pdfBlob.size, 'bytes');
          
          // ตรวจสอบว่า blob เป็น PDF จริง
          if (pdfBlob.type !== 'application/pdf' && !pdfBlob.type.includes('pdf')) {
            console.error('❌ Invalid PDF blob type:', pdfBlob.type);
            setShowLoadingModal(false);
            toast({
              title: 'ไฟล์ไม่ถูกต้อง',
              description: 'ไฟล์ที่ได้รับไม่ใช่ PDF กรุณารีเฟรชหน้าและลองใหม่',
              variant: 'destructive'
            });
            return;
          }
          
          // ดาวน์โหลดลายเซ็น
          console.log('📥 Fetching signature from:', authorProfile.signature_url);
          const sigRes = await fetch(authorProfile.signature_url);
          if (!sigRes.ok) {
            console.error('❌ Failed to fetch signature:', sigRes.status, sigRes.statusText);
            setShowLoadingModal(false);
            toast({
              title: 'ไม่พบไฟล์ลายเซ็น',
              description: `ไม่สามารถดาวน์โหลดลายเซ็นได้ (${sigRes.status}) กรุณาตรวจสอบลายเซ็นในโปรไฟล์`,
              variant: 'destructive'
            });
            return;
          }
          const sigBlob = await sigRes.blob();
          console.log('✅ Signature fetched successfully, size:', sigBlob.size, 'bytes');
          const formData = new FormData();
          formData.append('pdf', pdfBlob, 'document.pdf');
          formData.append('sig1', sigBlob, 'signature.png');
          // ใช้ตำแหน่งทั้งหมดของ author (order 1) - อนุญาตให้เซ็นหลายที่
          const authorPositions = updatedSignaturePositions.filter(pos => pos.signer.order === 1);
          
          if (authorPositions.length > 0) {
            // สร้าง signatures payload สำหรับ /add_signature_v2 (format ใหม่)
            const signaturesPayload = authorPositions.map(pos => ({
              page: pos.page - 1, // ปรับจาก 1-based (frontend) เป็น 0-based (API)
              x: Math.round(pos.x), // ส่งพิกัด X โดยตรง
              y: Math.round(pos.y), // ส่งพิกัด Y โดยตรง
              width: 120,
              height: 60,
              lines
            }));
            
            formData.append('signatures', JSON.stringify(signaturesPayload));
            
            // --- LOG ข้อมูลก่อนส่ง ---
            console.log('📄 pdfBlob:', pdfBlob);
            console.log('🖊️ sigBlob:', sigBlob);
            console.log(`📝 Original positions (DOM pixels):`, authorPositions.map(pos => ({ x: pos.x, y: pos.y, page: pos.page })));
            console.log(`📝 Signatures payload for /add_signature_v2:`, signaturesPayload.map(sig => ({ x: sig.x, y: sig.y, page: sig.page, lines: sig.lines?.length })));
            console.log(`📝 signatures (${authorPositions.length} positions):`, JSON.stringify(signaturesPayload, null, 2));
            // ---

            // Call Railway add_signature_v2 API with queue + retry logic
            signedPdfBlob = await railwayPDFQueue.enqueueWithRetry(
              async () => {
                const res = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/add_signature_v2', {
                  method: 'POST',
                  body: formData
                });
                console.log('API response object:', res);
                console.log('API response type:', res.headers.get('content-type'));

                if (!res.ok) {
                  const errorText = await res.text();
                  console.error('API error:', errorText);
                  throw new Error(errorText);
                }

                return await res.blob();
              },
              'Add Signature V2',
              3,
              1000
            );
            signSuccess = true;
          }
        } catch (e) {
          console.error('เกิดข้อผิดพลาดขณะส่ง API ลายเซ็นธุการ', e);
          setShowLoadingModal(false);
          return;
        }
      }
      // 3. ถ้าเซ็นสำเร็จ → อัปเดตสถานะ/ลำดับ
      if (signSuccess && signedPdfBlob && memo?.pdf_draft_path) {
        // อัปเดตข้อความ loading
        setLoadingMessage({
          title: "กำลังส่งเสนอต่อผู้ลงนามลำดับถัดไป",
          description: "ระบบกำลังบันทึกไฟล์และอัพเดตสถานะเอกสาร กรุณารอสักครู่..."
        });
        try {
          // --- อัปโหลดไฟล์ใหม่ (ชื่อใหม่) ---
          const extractedPdfUrl = extractPdfUrl(memo.pdf_draft_path);
          if (!extractedPdfUrl) {
            toast({
              title: "ข้อผิดพลาด",
              description: "ไม่สามารถดึง URL ไฟล์ PDF ได้",
              variant: "destructive",
            });
            setShowLoadingModal(false);
            return;
          }
          const oldFilePath = extractedPdfUrl.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, '');
          const newFileName = `signed_${Date.now()}_${oldFilePath.split('/').pop()}`;
          const newFilePath = oldFilePath.replace(/[^/]+$/, newFileName);
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(newFilePath, signedPdfBlob, {
              contentType: 'application/pdf',
              upsert: false
            });
          if (uploadError) {
            setShowLoadingModal(false);
            console.error('Upload error:', uploadError);
            toast({ title: 'Upload error', description: uploadError.message });
            return;
          }
          // --- อัปเดต path ใน database พร้อม clerk_id ---
          const { data: { publicUrl: newPublicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(newFilePath);
          
          // บันทึก clerk_id (user_id ของธุรการที่จัดการเอกสาร)
          const clerkId = profile?.user_id;
          console.log('📝 Recording clerk_id:', clerkId, 'for memo:', memoId);
          
          await updateMemoStatus(memoId, 'pending_sign', documentNumber, undefined, 2, newPublicUrl, clerkId);

          // --- ลบไฟล์เก่า ---
          const { error: removeError } = await supabase.storage
            .from('documents')
            .remove([oldFilePath]);
          if (removeError) {
            console.error('Remove old file error:', removeError);
            // ไม่ต้อง return, แค่ log
          }
        } finally {
          setShowLoadingModal(false);
        }

        // แสดง toast หลังปิด modal
        const authorPositions = updatedSignaturePositions.filter(pos => pos.signer.order === 1);
        toast({
          title: "ส่งเอกสารสำเร็จ",
          description: `ลงลายเซ็นเรียบร้อยแล้ว ${authorPositions.length} ตำแหน่ง และส่งให้ผู้อนุมัติถัดไป`,
        });

        navigate('/documents');
      } else if (!shouldSign) {
        // กรณีเอกสารถูกตีกลับ (ไม่มี PDF) - อัปเดตข้อมูลและส่งต่อโดยไม่ต้องเซ็น
        setShowLoadingModal(false);

        // บันทึก clerk_id
        const clerkId = profile?.user_id;
        await updateMemoStatus(memoId, 'pending_sign', documentNumber, undefined, 2, undefined, clerkId);

        toast({
          title: "ส่งเอกสารสำเร็จ",
          description: "ส่งเสนอเอกสารให้ผู้อนุมัติถัดไปเรียบร้อยแล้ว",
        });

        navigate('/documents');
      } else if (!signSuccess) {
        setShowLoadingModal(false);
        toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถเซ็นเอกสารได้' });
      }
    }
  };

  const handlePositionClick = (x: number, y: number, page: number) => {
    if (selectedSignerIndex >= signers.length) {
      toast({
        title: "ไม่มีผู้ลงนามให้เลือก",
        description: "กรุณาเลือกผู้ลงนามก่อน",
        variant: "destructive",
      });
      return;
    }

    // นับจำนวนตำแหน่งที่มีอยู่แล้วสำหรับผู้ลงนามคนนี้
    const existingPositionsCount = signaturePositions.filter(
      pos => pos.signer.order === signers[selectedSignerIndex].order
    ).length;

    const newPosition = {
      signer: {
        ...signers[selectedSignerIndex],
        positionIndex: existingPositionsCount + 1 // เพิ่มหมายเลขตำแหน่ง
      },
      x,
      y,
      page: page + 1,
      comment: comment
    };

    setSignaturePositions([...signaturePositions, newPosition]);
    setComment('');

    toast({
      title: "วางตำแหน่งลายเซ็นสำเร็จ",
      description: `วางลายเซ็น ${signers[selectedSignerIndex].name} ตำแหน่งที่ ${existingPositionsCount + 1} ที่หน้า ${page + 1}`,
    });

    // ไม่เปลี่ยนไปคนถัดไปอัตโนมัติ - ให้ผู้ใช้เลือกเอง
  };

  const handlePositionRemove = (index: number) => {
    const removedPosition = signaturePositions[index];
    setSignaturePositions(signaturePositions.filter((_, i) => i !== index));
    
    // Set selected signer back to the removed one
    const removedSignerIndex = signers.findIndex(s => s.order === removedPosition.signer.order);
    if (removedSignerIndex !== -1) {
      setSelectedSignerIndex(removedSignerIndex);
    }
  };

  const handleReject = async (reason: string) => {
    if (!memoId) return;
    
    setIsRejecting(true);
    try {
      const updateResult = await updateMemoStatus(memoId, 'rejected', undefined, reason);
      if (updateResult.success) {
        toast({
          title: "ตีกลับเอกสารสำเร็จ",
          description: "เอกสารถูกตีกลับไปยังผู้เขียนเพื่อแก้ไข",
        });
        navigate('/documents');
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถตีกลับเอกสารได้",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถตีกลับเอกสารได้",
        variant: "destructive",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  if (!memo) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">ไม่พบเอกสารที่ต้องการจัดการ</p>
              <Button onClick={() => navigate('/documents')} className="mt-4">
                กลับไปรายการเอกสาร
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ตรวจสอบว่ามี PDF หรือไม่ (กรณี memo ถูกตีกลับและยังไม่ได้ส่งใหม่)
  if (!memo.pdf_draft_path) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">ไม่พบไฟล์ PDF</h2>
              <p className="text-gray-500 mb-4">
                เอกสารนี้ยังไม่มีไฟล์ PDF สำหรับจัดการ<br />
                {memo.status === 'draft' && 'กรุณาแก้ไขและกด "ส่ง" เอกสารใหม่อีกครั้ง'}
                {memo.status === 'rejected' && 'เอกสารถูกตีกลับ กรุณาแก้ไขและส่งใหม่'}
              </p>
              <Button onClick={() => navigate('/documents')} className="mt-2">
                กลับไปรายการเอกสาร
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/documents')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                กลับ
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">จัดการเอกสาร</h1>
                <p className="text-sm text-gray-500">{memo.subject}</p>
              </div>
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors hover:scale-105 ${
                      currentStep === step 
                        ? 'bg-blue-600 text-white' 
                        : isStepComplete(step) 
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {isStepComplete(step) && currentStep !== step ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      step
                    )}
                  </button>
                  {step < 4 && <div className="w-6 h-0.5 bg-gray-200 mx-1" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="w-full">
          {/* Render appropriate step component */}
          {currentStep === 1 && (
            <Step1DocumentNumber
              documentNumber={documentNumber}
              suggestedDocNumber={suggestedDocNumber}
              docNumberSuffix={docNumberSuffix}
              isNumberAssigned={isNumberAssigned}
              isAssigningNumber={isAssigningNumber}
              memo={memo}
              onDocNumberSuffixChange={setDocNumberSuffix}
              onAssignNumber={handleAssignNumber}
              onNext={handleNext}
              onReject={handleReject}
              isRejecting={isRejecting}
              isStepComplete={isStepComplete(1)}
            />
          )}

          {currentStep === 2 && (
            <Step2SelectSigners
              selectedAssistant={selectedAssistant}
              selectedDeputy={selectedDeputy}
              assistantDirectors={assistantDirectors}
              deputyDirectors={deputyDirectors}
              signers={signers}
              onSelectedAssistantChange={setSelectedAssistant}
              onSelectedDeputyChange={setSelectedDeputy}
              onPrevious={handlePrevious}
              onNext={handleNext}
              isStepComplete={isStepComplete(2)}
            />
          )}

          {currentStep === 3 && (
            <Step3SignaturePositions
              signers={signers}
              signaturePositions={signaturePositions}
              comment={comment}
              documentSummary={documentSummary}
              selectedSignerIndex={selectedSignerIndex}
              memo={memo}
              onCommentChange={setComment}
              onDocumentSummaryChange={setDocumentSummary}
              onSelectedSignerIndexChange={setSelectedSignerIndex}
              onPositionClick={handlePositionClick}
              onPositionRemove={handlePositionRemove}
              onPrevious={handlePrevious}
              onNext={handleNext}
              isStepComplete={isStepComplete(3)}
            />
          )}

          {currentStep === 4 && (
            <Step4Review
              memo={memo}
              documentNumber={documentNumber}
              signers={signers}
              signaturePositions={signaturePositions}
              onPositionRemove={handlePositionRemove}
              onPrevious={handlePrevious}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
      <Dialog open={showLoadingModal}>
        <DialogContent>
          <DialogTitle>{loadingMessage.title}</DialogTitle>
          <DialogDescription>
            {loadingMessage.description}
          </DialogDescription>
          <div className="flex flex-col items-center gap-4 mt-4">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="text-lg font-medium">กำลังบันทึกไฟล์...</div>
            <Progress value={100} />
          </div>
        </DialogContent>
      </Dialog>
      <div className="h-10" />
    </div>
  );
};

export default DocumentManagePage;