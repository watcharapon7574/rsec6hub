import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProfiles } from '@/hooks/useProfiles';
import { useAllMemos } from '@/hooks/useAllMemos';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AnimatedProgress } from '@/components/ui/progress';
import { extractPdfUrl } from '@/utils/fileUpload';
import { SignerProgress } from '@/types/memo';
import { railwayPDFQueue } from '@/utils/requestQueue';
import { railwayFetch } from '@/utils/railwayFetch';

// Import step components for doc_receive (3 steps)
import Step1DocReceive, { DepartmentOption, trimDepartmentPrefix } from '@/components/DocumentManage/Step1DocReceive';
import Step3SignaturePositions from '@/components/DocumentManage/Step3SignaturePositions';
import Step4Review from '@/components/DocumentManage/Step4Review';

const PDFDocumentManagePage: React.FC = () => {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profiles } = useProfiles();
  const { updateMemoStatus } = useAllMemos();

  // State
  const [documentNumber, setDocumentNumber] = useState('');
  const [selectedDeputy, setSelectedDeputy] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [signaturePositions, setSignaturePositions] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [documentSummary, setDocumentSummary] = useState('');
  const [selectedSignerIndex, setSelectedSignerIndex] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [isRejecting, setIsRejecting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState({
    title: "กำลังดำเนินการ",
    description: "กรุณารอสักครู่..."
  });

  // Get user profile for API calls
  const { profile } = useEmployeeAuth();

  // Scroll to top on mount - ทำทันทีเมื่อเปิดหน้า
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [memoId]);

  // Doc receive data
  const [docReceive, setDocReceive] = useState<any>(null);

  // Check if we should show loading modal from navigation
  const showInitialLoading = location.state?.showLoadingModal;
  const [showLoadingModal, setShowLoadingModal] = useState(showInitialLoading || false);

  // Fetch doc_receive data
  const fetchDocReceive = React.useCallback(async () => {
    if (!memoId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('doc_receive')
        .select('*')
        .eq('id', memoId)
        .single();

      if (error) throw error;
      setDocReceive(data);

      // Set document number from data
      if (data?.doc_number) {
        setDocumentNumber(data.doc_number);
      }

      // Hide loading modal when data is loaded
      if (showLoadingModal) {
        setShowLoadingModal(false);
      }
    } catch (error) {
      console.error('Error fetching doc_receive:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถดึงข้อมูลเอกสารได้",
        variant: "destructive",
      });
    }
  }, [memoId, toast, showLoadingModal]);

  // Fetch data when component mounts
  React.useEffect(() => {
    fetchDocReceive();
  }, [fetchDocReceive]);

  // Get profiles by position
  const assistantDirectors = profiles.filter(p => p.position === 'assistant_director');
  const deputyDirectors = profiles.filter(p => p.position === 'deputy_director');
  // ผอ. ต้องเป็น user_id นี้เท่านั้น
  const directors = profiles.filter(p => p.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b');

  // สร้าง departmentOptions จาก assistantDirectors
  const departmentOptions: DepartmentOption[] = React.useMemo(() => {
    return assistantDirectors
      .filter(p => p.org_structure_role) // เฉพาะคนที่มี org_structure_role
      .map(p => {
        const trimmedName = trimDepartmentPrefix(p.org_structure_role);
        return {
          value: trimmedName, // ชื่อตัดแล้ว เช่น "ฝ่ายบริหารงานบุคคล"
          label: trimmedName, // แสดงเหมือน value
          fullName: p.org_structure_role, // ชื่อเต็ม เช่น "หัวหน้าฝ่ายบริหารงานบุคคล"
          userId: p.user_id
        };
      });
  }, [assistantDirectors]);

  // Handle department change - เก็บฝ่ายที่เลือกเพื่อคัดกรองประเภทหนังสือรับ (ไม่เพิ่มในผู้ลงนาม)
  const handleDepartmentChange = (departmentValue: string) => {
    setSelectedDepartment(departmentValue);
  };

  // Find author profile - try both created_by and user_id fields
  const authorProfile = docReceive
    ? profiles.find(p => p.user_id === (docReceive.created_by || docReceive.user_id))
    : null;

  console.log('👤 Author profile lookup:', {
    docReceiveId: docReceive?.id,
    createdBy: docReceive?.created_by,
    userId: docReceive?.user_id,
    profilesCount: profiles.length,
    authorProfileFound: !!authorProfile,
    authorProfileName: authorProfile ? `${authorProfile.first_name} ${authorProfile.last_name}` : 'NOT FOUND'
  });

  // Build signers list - สำหรับหนังสือรับ ไม่มีหัวหน้าฝ่ายในบทบาทการลงนาม
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

    // 2. รองผู้อำนวยการที่เลือก (ถ้ามี)
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

    // 3. ผู้อำนวยการ (เสมอ) - user_id: 28ef1822-628a-4dfd-b7ea-2defa97d755b
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
  }, [authorProfile, selectedDeputy, deputyDirectors, directors]);

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1: return true; // ไม่บังคับให้เลือกฝ่าย/รองผอ. - สามารถข้ามได้
      case 2: return signaturePositions.length >= 1; // ต้องมีลายเซ็นอย่างน้อย 1 ตำแหน่ง
      default: return false;
    }
  };

  const handleNext = async () => {
    // If moving from step 1 to step 2, save signer_list_progress
    if (currentStep === 1 && docReceive && memoId) {
      try {
        const signerListProgress: SignerProgress[] = signers.map(signer => {
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

        const { error: updateError } = await (supabase as any)
          .from('doc_receive')
          .update({
            signer_list_progress: signerListProgress
          })
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

    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (signaturePositions.length < 1) {
      toast({
        title: "กรุณาวางตำแหน่งลายเซ็น",
        description: "กรุณาวางตำแหน่งลายเซ็นอย่างน้อย 1 ตำแหน่ง",
        variant: "destructive",
      });
      return;
    }

    if (memoId) {
      // Update signature positions with prefix
      const updatedSignaturePositions = signaturePositions.map(pos => {
        const signer = signers.find(s => s.user_id === pos.signer.user_id);
        if (signer && signer.prefix) {
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

      // Save document summary if provided
      console.log('🔍 Attempting to save document summary (doc_receive):', {
        hasComment: !!comment.trim(),
        commentLength: comment.trim().length,
        comment: comment.trim(),
        memoId
      });

      if (comment.trim()) {
        try {
          const { error: updateError } = await (supabase as any)
            .from('doc_receive')
            .update({
              document_summary: comment.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', memoId);

          if (updateError) {
            console.error('❌ Error updating document summary:', updateError);
            toast({
              title: "คำเตือน",
              description: `ไม่สามารถบันทึกความหมายโดยสรุปได้: ${updateError.message}`,
              variant: "destructive",
            });
          } else {
            console.log('✅ Document summary updated successfully:', comment.trim());
            toast({
              title: "บันทึกสำเร็จ",
              description: "บันทึกความหมายโดยสรุปของเอกสารเรียบร้อยแล้ว",
            });
          }
        } catch (err) {
          console.error('❌ Failed to update document summary:', err);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถบันทึกความหมายโดยสรุปได้",
            variant: "destructive",
          });
        }
      } else {
        console.log('⚠️ No document summary provided - skipping save');
      }

      // Update signers/positions in doc_receive table
      await (supabase as any)
        .from('doc_receive')
        .update({
          signature_positions: updatedSignaturePositions,
          current_signer_order: 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', memoId);

      // Sign document for author
      let signSuccess = false;
      let signedPdfBlob: Blob | null = null;

      console.log('🔍 Checking signature requirements:', {
        hasDocReceive: !!docReceive,
        hasPdfDraftPath: !!docReceive?.pdf_draft_path,
        hasAuthorProfile: !!authorProfile,
        hasSignatureUrl: !!authorProfile?.signature_url
      });

      if (docReceive && docReceive.pdf_draft_path && authorProfile && authorProfile.signature_url) {
        const extractedPdfUrl = extractPdfUrl(docReceive.pdf_draft_path);
        console.log('📄 Extracted PDF URL:', extractedPdfUrl);
        if (!extractedPdfUrl) {
          toast({
            title: "ข้อผิดพลาด",
            description: "ไม่สามารถดึง URL ไฟล์ PDF ได้",
            variant: "destructive",
          });
          return;
        }

        try {
          const authorSigner = signers.find(s => s.role === 'author');
          const authorNameWithPrefix = authorSigner?.name || `${authorProfile.first_name} ${authorProfile.last_name}`;

          const lines: { type: string; file_key?: string; value?: string }[] = [
            { type: "image", file_key: "sig1" },
            { type: "name", value: authorNameWithPrefix },
            { type: "academic_rank", value: `ตำแหน่ง ${authorProfile.job_position || authorProfile.academic_rank || authorProfile.position || ''}` }
          ];
          // เพิ่ม org_structure_role สำหรับหัวหน้าฝ่าย/หัวหน้างาน
          if (authorProfile.org_structure_role) {
            lines.push({ type: "role", value: authorProfile.org_structure_role });
          }

          // ดาวน์โหลด PDF + ลายเซ็น พร้อมกัน (parallel)
          console.log('📥 Fetching PDF and signature in parallel...');
          const [pdfRes, sigRes] = await Promise.all([
            fetch(extractedPdfUrl),
            fetch(authorProfile.signature_url)
          ]);

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

          const [pdfBlob, sigBlob] = await Promise.all([
            pdfRes.blob(),
            sigRes.blob()
          ]);
          console.log('✅ PDF fetched:', pdfBlob.size, 'bytes, Signature fetched:', sigBlob.size, 'bytes');

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

          const formData = new FormData();
          formData.append('pdf', pdfBlob, 'document.pdf');
          formData.append('sig1', sigBlob, 'signature.png');

          const authorPositions = updatedSignaturePositions.filter(pos => pos.signer.order === 1);
          console.log('✍️ Author positions found:', authorPositions.length);

          if (authorPositions.length > 0) {
            // จุดแรก: แสดงครบ (ลายเซ็น, ชื่อ, ตำแหน่ง) / จุดที่ 2+: แค่รูปลายเซ็น PNG
            const linesImageOnly = [{ type: "image", file_key: "sig1" }];
            const signaturesPayload = authorPositions.map((pos, index) => ({
              page: pos.page - 1,
              x: Math.round(pos.x),
              y: Math.round(pos.y),
              rotation: (pos as any).rotation || 0,
              width: 120,
              height: 60,
              lines: index === 0 ? lines : linesImageOnly
            }));

            console.log('📝 Signatures payload:', signaturesPayload);
            formData.append('signatures', JSON.stringify(signaturesPayload));

            console.log('🚀 Calling signature API...');
            // Call Railway add_signature_v2 API with queue + retry logic
            signedPdfBlob = await railwayPDFQueue.enqueueWithRetry(
              async () => {
                const res = await railwayFetch('/add_signature_v2', {
                  method: 'POST',
                  body: formData
                });

                console.log('📡 API response status:', res.status);
                if (!res.ok) {
                  const errorText = await res.text();
                  console.error('❌ API error:', errorText);
                  throw new Error(errorText);
                }

                const blob = await res.blob();
                console.log('✅ Signature successful, blob size:', blob.size);
                return blob;
              },
              'Add Signature V2 (PDF Document)',
              3,
              1000
            );
            signSuccess = true;
          } else {
            console.warn('⚠️ No author positions found - cannot sign document');
          }
        } catch (e) {
          console.error('❌ เกิดข้อผิดพลาดขณะส่ง API ลายเซ็นธุการ:', e);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: `ไม่สามารถลงลายเซ็นได้: ${e instanceof Error ? e.message : 'Unknown error'}`,
            variant: "destructive",
          });
          return;
        }
      } else {
        console.warn('⚠️ Cannot sign - missing requirements:', {
          docReceive: !!docReceive,
          pdfDraftPath: !!docReceive?.pdf_draft_path,
          authorProfile: !!authorProfile,
          signatureUrl: !!authorProfile?.signature_url
        });
      }

      // If signing successful, update status
      if (signSuccess && signedPdfBlob && docReceive?.pdf_draft_path) {
        setLoadingMessage({
          title: "กำลังส่งเสนอต่อผู้ลงนามลำดับถัดไป",
          description: "ระบบกำลังบันทึกไฟล์และอัพเดตสถานะเอกสาร กรุณารอสักครู่..."
        });
        setShowLoadingModal(true);

        try {
          const extractedPdfUrl = extractPdfUrl(docReceive.pdf_draft_path);
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

          const { error: uploadError } = await supabase.storage
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

          const { data: { publicUrl: newPublicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(newFilePath);

          const clerkId = profile?.user_id;
          // Update doc_receive table (not memos table)
          const { error: updateError } = await (supabase as any)
            .from('doc_receive')
            .update({
              status: 'pending_sign',
              doc_number: documentNumber,
              current_signer_order: 2,
              pdf_draft_path: newPublicUrl,
              clerk_id: clerkId,
              updated_at: new Date().toISOString()
            })
            .eq('id', memoId);

          if (updateError) {
            console.error('Error updating doc_receive:', updateError);
            toast({
              title: "เกิดข้อผิดพลาด",
              description: `ไม่สามารถอัปเดตข้อมูลได้: ${updateError.message}`,
              variant: "destructive",
            });
            return;
          }

          const authorPositions = updatedSignaturePositions.filter(pos => pos.signer.order === 1);
          toast({
            title: "ส่งเอกสารสำเร็จ",
            description: `ลงลายเซ็นเรียบร้อยแล้ว ${authorPositions.length} ตำแหน่ง และส่งให้ผู้อนุมัติถัดไป`,
          });

          // Remove old file
          const { error: removeError } = await supabase.storage
            .from('documents')
            .remove([oldFilePath]);
          if (removeError) {
            console.error('Remove old file error:', removeError);
          }
        } finally {
          setShowLoadingModal(false);
        }
        navigate('/documents');
      } else if (!signSuccess) {
        console.error('❌ Sign failed - signSuccess is false');
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถเซ็นเอกสารได้ กรุณาตรวจสอบ Console สำหรับรายละเอียด'
        });
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

    const existingPositionsCount = signaturePositions.filter(
      pos => pos.signer.order === signers[selectedSignerIndex].order
    ).length;

    const newPosition = {
      signer: {
        ...signers[selectedSignerIndex],
        positionIndex: existingPositionsCount + 1
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
  };

  const handlePositionRemove = (index: number) => {
    const removedPosition = signaturePositions[index];
    setSignaturePositions(signaturePositions.filter((_, i) => i !== index));

    const removedSignerIndex = signers.findIndex(s => s.order === removedPosition.signer.order);
    if (removedSignerIndex !== -1) {
      setSelectedSignerIndex(removedSignerIndex);
    }
  };

  const handleReject = async (reason: string, _annotatedPdfUrl?: string, _annotatedAttachments?: string[]) => {
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

  if (!docReceive) {
    return (
      <div className="min-h-screen bg-background p-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">กำลังโหลดข้อมูลเอกสาร...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/documents')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                กลับ
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">จัดการหนังสือรับ</h1>
                <p className="text-sm text-muted-foreground">{docReceive?.subject}</p>
              </div>
            </div>

            {/* Progress Steps - 3 steps for doc_receive */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors hover:scale-105 ${
                      currentStep === step
                        ? 'bg-blue-600 text-white'
                        : isStepComplete(step)
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {isStepComplete(step) && currentStep !== step ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      step
                    )}
                  </button>
                  {step < 3 && <div className="w-6 h-0.5 bg-muted mx-1" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="w-full">
          {/* Render appropriate step component - 3 steps for doc_receive */}
          {currentStep === 1 && (
            <Step1DocReceive
              memo={docReceive}
              departmentOptions={departmentOptions}
              selectedDepartment={selectedDepartment}
              onDepartmentChange={handleDepartmentChange}
              selectedDeputy={selectedDeputy}
              deputyDirectors={deputyDirectors}
              onSelectedDeputyChange={setSelectedDeputy}
              signers={signers}
              onNext={handleNext}
              onReject={handleReject}
              isRejecting={isRejecting}
              isStepComplete={isStepComplete(1)}
            />
          )}

          {currentStep === 2 && (
            <Step3SignaturePositions
              signers={signers}
              signaturePositions={signaturePositions}
              comment={comment}
              documentSummary={documentSummary}
              selectedSignerIndex={selectedSignerIndex}
              memo={docReceive}
              onCommentChange={setComment}
              onDocumentSummaryChange={setDocumentSummary}
              onSelectedSignerIndexChange={setSelectedSignerIndex}
              onPositionClick={handlePositionClick}
              onPositionRemove={handlePositionRemove}
              onPrevious={handlePrevious}
              onNext={handleNext}
              isStepComplete={isStepComplete(2)}
            />
          )}

          {currentStep === 3 && (
            <Step4Review
              memo={docReceive}
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

      {/* Navigation Loading Modal */}
      <Dialog open={showLoadingModal && !docReceive} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-center">กำลังโหลดข้อมูลเอกสาร</DialogTitle>
          <DialogDescription className="text-center">
            กรุณารอสักครู่...
          </DialogDescription>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            <div className="text-sm text-muted-foreground text-center">
              กำลังดึงข้อมูลเอกสารจากฐานข้อมูล<br />
              โปรดรอสักครู่
            </div>
            <AnimatedProgress className="w-full" />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoadingModal && !!docReceive}>
        <DialogContent>
          <DialogTitle>{loadingMessage.title}</DialogTitle>
          <DialogDescription>
            {loadingMessage.description}
          </DialogDescription>
          <div className="flex flex-col items-center gap-4 mt-4">
            <svg className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400 dark:text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="text-lg font-medium">กำลังบันทึกไฟล์...</div>
            <AnimatedProgress />
          </div>
        </DialogContent>
      </Dialog>
      {/* Spacer for FloatingNavbar */}
      <div className="h-32" />
    </div>
  );
};

export default PDFDocumentManagePage;
