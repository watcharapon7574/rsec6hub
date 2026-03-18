import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProfiles } from '@/hooks/useProfiles';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { extractPdfUrl } from '@/utils/fileUpload';
import { railwayPDFQueue } from '@/utils/requestQueue';
import { railwayFetch } from '@/utils/railwayFetch';

// Import step components for doc_receive (3 steps)
import Step1DocReceive, { DepartmentOption } from '@/components/DocumentManage/Step1DocReceive';
import Step3SignaturePositions from '@/components/DocumentManage/Step3SignaturePositions';
import Step4Review from '@/components/DocumentManage/Step4Review';

const PDFReceiveManagePage: React.FC = () => {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profiles } = useProfiles();
  const { profile } = useEmployeeAuth();

  // State
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedDeputy, setSelectedDeputy] = useState<string>('');
  const [signaturePositions, setSignaturePositions] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [documentSummary, setDocumentSummary] = useState(''); // สำหรับสรุปเนื้อหาเอกสาร (doc_receive ไม่ต้องใช้แต่ต้อง pass เพื่อให้ component ทำงาน)
  const [selectedSignerIndex, setSelectedSignerIndex] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState(1); // Start at step 1 (which is actually step 2 - select signers)
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState({
    title: "กำลังดำเนินการ",
    description: "กรุณารอสักครู่..."
  });
  const [isRejecting, setIsRejecting] = useState(false);

  // Doc receive data
  const [docReceive, setDocReceive] = useState<any>(null);

  // Departments from database
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);

  // Fetch departments from database
  const fetchDepartments = React.useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('departments')
        .select('id, name, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Convert to DepartmentOption format
      const options: DepartmentOption[] = (data || []).map((dept: any) => ({
        value: dept.name,
        label: dept.name,
        fullName: dept.name,
        userId: dept.id // Use department id as userId for key purposes
      }));

      setDepartmentOptions(options);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  }, []);

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
      console.log('📄 Doc receive data loaded:', {
        id: data?.id,
        subject: data?.subject,
        pdf_draft_path: data?.pdf_draft_path,
        status: data?.status
      });
      setDocReceive(data);
    } catch (error) {
      console.error('Error fetching doc_receive:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถดึงข้อมูลเอกสารได้",
        variant: "destructive",
      });
    }
  }, [memoId, toast]);

  useEffect(() => {
    fetchDepartments();
    fetchDocReceive();
  }, [fetchDepartments, fetchDocReceive]);

  // Get profiles by position
  const deputyDirectors = profiles.filter(p => p.position === 'deputy_director');
  // ผอ. ต้องเป็น user_id นี้เท่านั้น
  const directors = profiles.filter(p => p.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b');

  // Get clerk profile (current user)
  const clerkProfile = profile;

  // Handle department change - เก็บฝ่ายที่เลือกเพื่อคัดกรองประเภทหนังสือรับ (ไม่เพิ่มในผู้ลงนาม)
  const handleDepartmentChange = (departmentValue: string) => {
    setSelectedDepartment(departmentValue);
  };

  // Build signers list - สำหรับหนังสือรับ ไม่มีหัวหน้าฝ่ายในบทบาทการลงนาม
  // ลำดับ: ธุรการ → รองผอ. (optional) → ผอ.
  const signers = React.useMemo(() => {
    const list = [];
    let currentOrder = 1;

    // 1. ธุรการ (clerk - current user) - เสมอ
    if (clerkProfile) {
      const fullName = `${clerkProfile.prefix || ''}${clerkProfile.first_name} ${clerkProfile.last_name}`.trim();
      list.push({
        order: currentOrder++,
        user_id: clerkProfile.user_id,
        name: fullName,
        position: clerkProfile.current_position || clerkProfile.position,
        job_position: clerkProfile.job_position || clerkProfile.current_position || clerkProfile.position,
        role: 'clerk',
        academic_rank: clerkProfile.academic_rank,
        org_structure_role: clerkProfile.org_structure_role,
        prefix: clerkProfile.prefix,
        signature_url: clerkProfile.signature_url
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
          job_position: deputy.job_position || deputy.current_position || deputy.position,
          role: 'deputy_director',
          academic_rank: deputy.academic_rank,
          org_structure_role: deputy.org_structure_role,
          prefix: deputy.prefix,
          signature_url: deputy.signature_url
        });
      }
    }

    // 3. ผู้อำนวยการ (เสมอ) - user_id: 28ef1822-628a-4dfd-b7ea-2defa97d755b
    if (directors.length > 0) {
      let director = directors.find(d =>
        d.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b'
      );

      if (!director) {
        director = directors[0];
      }

      const fullName = `${director.prefix || ''}${director.first_name} ${director.last_name}`.trim();
      list.push({
        order: currentOrder++,
        user_id: director.user_id,
        name: fullName,
        position: director.current_position || director.position,
        job_position: director.job_position || director.current_position || director.position,
        role: 'director',
        academic_rank: director.academic_rank,
        org_structure_role: director.org_structure_role,
        prefix: director.prefix,
        signature_url: director.signature_url
      });
    }

    return list;
  }, [clerkProfile, selectedDeputy, deputyDirectors, directors]);

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1:
        return signers.length >= 2; // At least clerk + director
      case 2:
        return signaturePositions.length >= signers.length; // All signers have positions
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!memoId || !docReceive || !docReceive.pdf_draft_path) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่พบข้อมูลเอกสาร",
        variant: "destructive",
      });
      return;
    }

    // ตรวจสอบว่ามีการวางตำแหน่งลายเซ็นครบทุกคน
    if (signaturePositions.length < signers.length) {
      toast({
        title: "กรุณาวางตำแหน่งลายเซ็น",
        description: `กรุณาวางตำแหน่งลายเซ็นให้ครบทุกคน (${signaturePositions.length}/${signers.length})`,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingMessage({
        title: "กำลังประทับตราและส่งเอกสาร",
        description: "ระบบกำลังประมวลผล กรุณารอสักครู่..."
      });
      setShowLoadingModal(true);

      // Extract PDF URL
      const extractedPdfUrl = extractPdfUrl(docReceive.pdf_draft_path);
      if (!extractedPdfUrl) {
        throw new Error("ไม่สามารถดึง URL ไฟล์ PDF ได้");
      }

      // Fetch PDF
      console.log('📄 Fetching PDF from:', extractedPdfUrl);
      const pdfRes = await fetch(extractedPdfUrl);
      const pdfBlob = await pdfRes.blob();

      // Prepare FormData for /stamp_summary API
      const formData = new FormData();
      formData.append('pdf', pdfBlob, 'document.pdf');

      // Get clerk signature
      if (!clerkProfile?.signature_url) {
        throw new Error("ไม่พบลายเซ็นของธุรการ กรุณาอัปโหลดลายเซ็นก่อน");
      }

      console.log('🖊️ Fetching clerk signature from:', clerkProfile.signature_url);
      const signRes = await fetch(clerkProfile.signature_url);
      const signBlob = await signRes.blob();
      formData.append('sign_png', signBlob, 'signature.png');

      // Get clerk stamp position from signaturePositions (clerk has order = 1)
      const clerkPosition = signaturePositions.find(pos => pos.signer.order === 1);

      if (!clerkPosition) {
        throw new Error("ไม่พบตำแหน่งตราประทับธุรการ กรุณาวางตำแหน่งตราประทับก่อน");
      }

      // Prepare summary_payload with position parameters
      const stampedInfo = docReceive.form_data?.stamped_info || {};
      const summaryPayload = {
        summary: docReceive.subject || "",
        group_name: selectedDepartment && selectedDepartment !== 'skip' ? selectedDepartment : "",
        receiver_name: stampedInfo.receiver || docReceive.author_name || "",
        date: stampedInfo.date || new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }),
        // Add position parameters from clerk stamp position
        page: clerkPosition.page - 1, // Convert to 0-based page index for API
        x: Math.round(clerkPosition.x),
        y: Math.round(clerkPosition.y),
        width: 200,  // Fixed width for stamp
        height: 150  // Fixed height for stamp
      };

      console.log('📦 Summary payload with position:', summaryPayload);
      formData.append('payload', JSON.stringify(summaryPayload));

      // Call Railway stamp_summary API with queue + retry logic
      console.log('🚀 Calling /stamp_summary API...');
      const stampedPdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const res = await railwayFetch('/stamp_summary', {
            method: 'POST',
            body: formData
          });

          if (!res.ok) {
            const errorText = await res.text();
            console.error('❌ API error:', errorText);
            throw new Error(`API Error: ${errorText}`);
          }

          return await res.blob();
        },
        'Stamp Summary',
        3,
        1000
      );
      console.log('✅ Stamp successful, blob size:', stampedPdfBlob.size);

      // Upload stamped PDF back to storage (ตัด query string ?t=xxx ออกก่อน)
      const oldFilePath = extractedPdfUrl.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, '').split('?')[0];
      const newFileName = `stamped_${Date.now()}_${oldFilePath.split('/').pop()}`;
      const newFilePath = oldFilePath.replace(/[^/]+$/, newFileName);

      console.log('📤 Uploading stamped PDF to:', newFilePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(newFilePath, stampedPdfBlob, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl: newPublicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(newFilePath);

      console.log('✅ New PDF URL:', newPublicUrl);

      // Prepare signer_list_progress (like memos table - stores all signers for tracking)
      const signerListProgress = signers.map(signer => ({
        user_id: signer.user_id,
        name: signer.name,
        first_name: signer.name.split(' ').shift() || signer.name, // Extract first name (first word)
        last_name: signer.name.split(' ').pop() || '', // Extract last name (last word)
        position: signer.position,
        job_position: signer.job_position,
        role: signer.role,
        order: signer.order,
        org_structure_role: signer.org_structure_role || ''
      }));

      // Find the next signer after clerk (order 1) - dynamically based on selected signers
      // Clerk is order 1, next signer could be assistant director (2), deputy (3), or director (4)
      const nextSignerOrder = signers.find(s => s.order > 1)?.order || 5; // Default to 5 (completed) if no signers

      console.log('📝 Signer list progress:', signerListProgress);
      console.log('🎯 Next signer order:', nextSignerOrder, 'Signers:', signers.map(s => ({ order: s.order, role: s.role })));

      // Update doc_receive table
      // เปลี่ยน status เป็น pending_sign และเริ่มต้นที่ผู้ลงนามคนแรกหลังธุรการ
      const { error: updateError } = await (supabase as any)
        .from('doc_receive')
        .update({
          status: 'pending_sign',
          current_signer_order: nextSignerOrder, // เริ่มจากผู้ลงนามคนแรกหลังธุรการ (ธุรการประทับตราเท่านั้น ไม่ลงนาม)
          pdf_draft_path: newPublicUrl, // อัปเดต PDF ที่มีตราธุรการแล้ว
          signature_positions: signaturePositions, // บันทึกตำแหน่งลายเซ็นไว้สำหรับผู้อนุมัติ
          signer_list_progress: signerListProgress, // บันทึกรายชื่อผู้ลงนามทั้งหมด (สำคัญ!)
          clerk_id: profile?.user_id,
          user_id: profile?.user_id, // บันทึก user_id เหมือน memos table
          updated_at: new Date().toISOString()
        })
        .eq('id', memoId);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw updateError;
      }

      console.log('✅ Doc receive updated successfully');

      // Remove old PDF file
      try {
        await supabase.storage.from('documents').remove([oldFilePath]);
        console.log('🗑️ Old PDF removed');
      } catch (removeError) {
        console.warn('⚠️ Failed to remove old PDF:', removeError);
        // ไม่ throw error เพราะไม่ critical
      }

      setShowLoadingModal(false);
      toast({
        title: "ส่งเอกสารสำเร็จ",
        description: `ประทับตราธุรการและส่งเอกสารให้ผู้อนุมัติเรียบร้อยแล้ว`,
      });
      navigate('/documents');

    } catch (error) {
      console.error('❌ Error submitting document:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      setShowLoadingModal(false);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถส่งเอกสารได้",
        variant: "destructive",
      });
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

    const signer = signers[selectedSignerIndex];
    const existingPositionsCount = signaturePositions.filter(
      pos => pos.signer.order === signer.order
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

            {/* Progress Steps */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step)}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all
                      ${currentStep === step
                        ? 'bg-blue-500 text-white shadow-lg'
                        : currentStep > step
                        ? 'bg-green-500 text-white'
                        : 'bg-muted dark:bg-background/80 text-muted-foreground'
                      }
                    `}
                  >
                    {step}
                  </button>
                  {step < 3 && (
                    <div className={`w-12 h-1 ${currentStep > step ? 'bg-green-500' : 'bg-muted'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
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
              onReject={async (reason: string, annotatedPdfUrl?: string, annotatedAttachments?: string[]) => {
                if (!memoId || !profile) return;
                setIsRejecting(true);
                try {
                  const updates: any = {
                    status: 'rejected',
                    current_signer_order: 0,
                  };

                  if (reason) {
                    updates.rejected_name_comment = {
                      name: `${profile.first_name} ${profile.last_name}`,
                      comment: reason,
                      rejected_at: new Date().toISOString(),
                      position: profile.current_position || profile.job_position || profile.position || '',
                      annotated_pdf_url: annotatedPdfUrl || null,
                      annotated_attachments: annotatedAttachments || null,
                    };
                  }

                  const { error } = await (supabase as any)
                    .from('doc_receive')
                    .update(updates)
                    .eq('id', memoId);

                  if (error) throw error;

                  toast({
                    title: "ตีกลับเรียบร้อย",
                    description: "หนังสือรับถูกตีกลับแล้ว",
                  });
                  navigate('/documents');
                } catch (error) {
                  console.error('Error rejecting doc_receive:', error);
                  toast({
                    title: "เกิดข้อผิดพลาด",
                    description: "ไม่สามารถตีกลับเอกสารได้",
                    variant: "destructive",
                  });
                } finally {
                  setIsRejecting(false);
                }
              }}
              isRejecting={isRejecting}
              isStepComplete={isStepComplete(1)}
              userId={profile?.user_id}
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
              documentNumber={docReceive.doc_number || ''}
              signers={signers}
              signaturePositions={signaturePositions}
              onPositionRemove={handlePositionRemove}
              onPrevious={handlePrevious}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>

      {/* Loading Modal */}
      <Dialog open={showLoadingModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-center">{loadingMessage.title}</DialogTitle>
          <DialogDescription className="text-center">
            {loadingMessage.description}
          </DialogDescription>
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PDFReceiveManagePage;
