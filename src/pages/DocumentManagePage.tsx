import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  MapPin,
  Send,
  User,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProfiles } from '@/hooks/useProfiles';
import { useAllMemos } from '@/hooks/useAllMemos';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import { RejectionCard } from '@/components/OfficialDocuments/RejectionCard';
import { submitPDFSignature } from '@/services/pdfSignatureService';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { extractPdfUrl } from '@/utils/fileUpload';
import Accordion from '@/components/OfficialDocuments/Accordion';

const DocumentManagePage: React.FC = () => {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profiles } = useProfiles();
  const { getMemoById, updateMemoStatus, updateMemoSigners } = useAllMemos();

  // State
  const [documentNumber, setDocumentNumber] = useState('');
  const [selectedAssistant, setSelectedAssistant] = useState<string>('');
  const [selectedDeputy, setSelectedDeputy] = useState<string>('');
  const [signaturePositions, setSignaturePositions] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [selectedSignerIndex, setSelectedSignerIndex] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);

  // Get memo data
  const memo = memoId ? getMemoById(memoId) : null;

  // Get profiles by position
  const assistantDirectors = profiles.filter(p => p.position === 'assistant_director');
  const deputyDirectors = profiles.filter(p => p.position === 'deputy_director');
  const directors = profiles.filter(p => p.position === 'director');
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

    // 4. ผู้อำนวยการ (เสมอ)
    const director = directors.find(d => d.first_name === 'อานนท์');
    if (director) {
      const fullName = `${director.prefix || ''}${director.first_name} ${director.last_name}`.trim();
      list.push({
        order: currentOrder++,
        user_id: director.user_id,
        name: fullName,
        position: director.current_position || director.position,
        role: 'director',
        academic_rank: director.academic_rank,
        org_structure_role: director.org_structure_role,
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
      case 1: return documentNumber.trim() !== '';
      case 2: return true; // ไม่บังคับให้เลือก - สามารถข้ามได้
      case 3: return signaturePositions.length >= 1; // เปลี่ยนเป็นมีลายเซ็นอย่างน้อย 1 ตำแหน่ง
      default: return false;
    }
  };

  const handleNext = () => {
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

      // 1.5. บันทึกสรุปเนื้อหาเอกสาร
      if (comment.trim()) {
        try {
          const { error: updateError } = await supabase
            .from('memos')
            .update({ 
              document_summary: comment.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('id', memoId);
          
          if (updateError) {
            console.error('Error updating document summary:', updateError);
            // ไม่หยุดการทำงาน แค่ log error
          } else {
            console.log('✅ Document summary updated successfully');
          }
        } catch (err) {
          console.error('Failed to update document summary:', err);
          // ไม่หยุดการทำงาน แค่ log error
        }
      }

      // 2. อัปเดต signers/ตำแหน่ง
      await updateMemoSigners(memoId, signers, updatedSignaturePositions);

      // 2. เรียก API ลายเซ็นสำหรับธุการ (author)
      let signSuccess = false;
      let signedPdfBlob: Blob | null = null;
      if (memo && memo.pdf_draft_path && authorProfile && authorProfile.signature_url) {
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
            { type: "academic_rank", value: `ตำแหน่ง ${authorProfile.academic_rank || authorProfile.position || ''}` }
          ];
          // ดาวน์โหลด PDF
          const pdfRes = await fetch(extractedPdfUrl);
          const pdfBlob = await pdfRes.blob();
          // ดาวน์โหลดลายเซ็น
          const sigRes = await fetch(authorProfile.signature_url);
          const sigBlob = await sigRes.blob();
          const formData = new FormData();
          formData.append('pdf', pdfBlob, 'document.pdf');
          formData.append('sig1', sigBlob, 'signature.png');
          // ใช้ตำแหน่งของ author (order 1)
          const authorPos = updatedSignaturePositions.find(pos => pos.signer.order === 1);
          if (authorPos) {
            const signaturesPayload = [
              {
                page: authorPos.page - 1, // ปรับจาก 1-based (frontend) เป็น 0-based (API)
                x: authorPos.x,
                y: authorPos.y,
                width: 120,
                height: 60,
                lines
              }
            ];
            formData.append('signatures', JSON.stringify(signaturesPayload));
            // --- LOG ข้อมูลก่อนส่ง ---
            console.log('📄 pdfBlob:', pdfBlob);
            console.log('🖊️ sigBlob:', sigBlob);
            console.log('📝 signatures:', JSON.stringify(signaturesPayload, null, 2));
            // ---
            const res = await fetch('https://pdf-memo-docx-production.up.railway.app/add_signature_v2', {
              method: 'POST',
              body: formData
            });
            console.log('API response object:', res);
            console.log('API response type:', res.headers.get('content-type'));
            if (!res.ok) {
              const errorText = await res.text();
              console.error('API error:', errorText);
              toast({ title: 'API error', description: errorText });
              setShowLoadingModal(false);
              return;
            }
            signedPdfBlob = await res.blob();
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
        setShowLoadingModal(true);
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
          // --- อัปเดต path ใน database ---
          const { data: { publicUrl: newPublicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(newFilePath);
          await updateMemoStatus(memoId, 'pending_sign', documentNumber, undefined, 2, newPublicUrl);
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
        navigate('/documents');
      } else if (!signSuccess) {
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
          {/* Main Content */}
          <div className="space-y-6">
            
            {/* Step 1: เลขหนังสือ */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    กำหนดเลขหนังสือราชการ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="doc-number">เลขหนังสือราชการ</Label>
                    <Input
                      id="doc-number"
                      placeholder="เช่น ศษ.6/001/2567"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      className="text-lg"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      รูปแบบ: หน่วยงาน/ลำดับ/ปี เช่น ศษ.6/001/2567
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleNext}
                      disabled={!isStepComplete(1)}
                      className="bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      ถัดไป
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* PDF Preview - Step 1 */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    ตัวอย่างเอกสาร
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {memo.pdf_draft_path ? (
                    <div className="w-full">
                      <PDFViewer 
                        fileUrl={extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path} 
                        fileName="เอกสาร"
                        memo={memo}
                        showSignatureMode={false}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      ไม่มีไฟล์ PDF สำหรับแสดงตัวอย่าง
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Attached Files Accordion - Step 1 */}
            {currentStep === 1 && (() => {
              let attachedFiles = [];
              if (memo?.attached_files) {
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
              
              return attachedFiles.length > 0 && (
                <Accordion 
                  attachments={attachedFiles}
                  attachmentTitle={memo?.attachment_title}
                />
              );
            })()}

            {/* Rejection Card - Step 1 */}
            {currentStep === 1 && (
              <RejectionCard 
                onReject={handleReject}
                isLoading={isRejecting}
              />
            )}

            {/* Step 2: เลือกผู้ลงนาม */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    เลือกผู้ลงนาม
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>ผู้ช่วยผู้อำนวยการ (เลือก 1 คน หรือไม่ระบุ)</Label>
                      <Select value={selectedAssistant} onValueChange={setSelectedAssistant}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกผู้ช่วยผู้อำนวยการ หรือไม่ระบุ" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-blue-200 z-50 shadow-lg">
                          <SelectItem value="skip" className="hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                            <span className="font-medium text-gray-600">ไม่ระบุ (ข้าม)</span>
                          </SelectItem>
                          {assistantDirectors.map((profile) => (
                            <SelectItem 
                              key={`assistant-${profile.id}`} 
                              value={profile.user_id || profile.id}
                              className="hover:bg-blue-50 focus:bg-blue-50 cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {profile.prefix || ''}{profile.first_name} {profile.last_name}
                                </span>
                                <span className="text-sm text-gray-500">
                                  ตำแหน่ง {profile.academic_rank || ''} {profile.org_structure_role || profile.current_position || ''}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>รองผู้อำนวยการ (เลือก 1 คน หรือไม่ระบุ)</Label>
                      <Select value={selectedDeputy} onValueChange={setSelectedDeputy}>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกรองผู้อำนวยการ หรือไม่ระบุ" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-blue-200 z-50 shadow-lg">
                          <SelectItem value="skip" className="hover:bg-gray-50 focus:bg-gray-50 cursor-pointer">
                            <span className="font-medium text-gray-600">ไม่ระบุ (ข้าม)</span>
                          </SelectItem>
                          {deputyDirectors.map((profile) => (
                            <SelectItem 
                              key={`deputy-${profile.id}`} 
                              value={profile.user_id || profile.id}
                              className="hover:bg-blue-50 focus:bg-blue-50 cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {profile.prefix || ''}{profile.first_name} {profile.last_name}
                                </span>
                                <span className="text-sm text-gray-500">
                                  ตำแหน่ง {profile.academic_rank || ''} {profile.org_structure_role || profile.current_position || ''}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* คำอธิบายการข้าม */}
                  <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    <p className="font-medium mb-1">หมายเหตุ:</p>
                    <p>• สามารถเลือก "ไม่ระบุ (ข้าม)" เพื่อข้ามผู้ช่วยหรือรองผู้อำนวยการได้</p>
                    <p>• หมายเลขลำดับจะปรับให้ต่อเนื่องตามคนที่เลือกจริง</p>
                    <p>• ตัวอย่าง: ข้ามทั้งคู่ → 1(ผู้เขียน), 2(ผอ.) หรือข้ามผู้ช่วย → 1(ผู้เขียน), 2(รองผอ.), 3(ผอ.)</p>
                    <p>• ผู้เขียนและผู้อำนวยการจะอยู่เสมอ</p>
                  </div>

                  <div>
                    <Label>ลำดับการลงนาม ({signers.length} คน)</Label>
                    <div className="mt-2 space-y-2">
                      {signers.map((signer, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <Badge variant="outline" className="min-w-[30px] text-center">{signer.order}</Badge>
                          <div className="flex-1">
                            <p className="font-medium">{signer.name}</p>
                            <p className="text-sm text-gray-500">
                              ตำแหน่ง {signer.academic_rank && `${signer.academic_rank} `}
                              {signer.org_structure_role || signer.position}
                            </p>
                          </div>
                          <Badge variant={
                            signer.role === 'author' ? 'default' :
                            signer.role === 'assistant_director' ? 'secondary' :
                            signer.role === 'deputy_director' ? 'secondary' :
                            'destructive'
                          }>
                            {signer.role === 'author' ? 'ผู้เขียน' :
                             signer.role === 'assistant_director' ? 'ผู้ช่วยผอ.' :
                             signer.role === 'deputy_director' ? 'รองผอ.' :
                             'ผอ.'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={handlePrevious}>
                      ก่อนหน้า
                    </Button>
                    <Button 
                      onClick={handleNext}
                      disabled={!isStepComplete(2)}
                      className="bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      ถัดไป
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: วางตำแหน่งลายเซ็น */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    วางตำแหน่งลายเซ็นและความเห็น
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">


                  {/* แสดงรายชื่อผู้ลงนามทั้งหมด */}
                  <div className="mb-4">
                    <Label className="text-base font-medium">ผู้ลงนามที่เลือก ({signers.length} คน)</Label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      {signers.map((signer, index) => {
                        const positionsCount = signaturePositions.filter(pos => pos.signer.order === signer.order).length;
                        const isSelected = selectedSignerIndex === index;
                        
                        return (
                          <div
                            key={signer.order}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50 shadow-md' 
                                : positionsCount > 0 
                                  ? 'border-green-500 bg-green-50' 
                                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedSignerIndex(index)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{signer.name}</p>
                                <p className="text-sm text-gray-600">{signer.academic_rank || signer.org_structure_role || signer.position}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {signer.role === 'author' && 'ผู้เขียน'}
                                  {signer.role === 'assistant_director' && 'ผู้ช่วยผู้อำนวยการ'}
                                  {signer.role === 'deputy_director' && 'รองผู้อำนวยการ'}
                                  {signer.role === 'director' && 'ผู้อำนวยการ'}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                {positionsCount > 0 && (
                                  <Badge variant="default" className="bg-green-600 text-white">
                                    ✓ {positionsCount} ตำแหน่ง
                                  </Badge>
                                )}
                                {isSelected && (
                                  <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                                    เลือกอยู่
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-xs">
                                  ลำดับ {signer.order}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-4">
                    <Label>ความหมายโดยสรุปของเอกสารฉบับนี้</Label>
                    <Textarea
                      placeholder="โปรดอธิบายโดยสรุปว่าเอกสารฉบับนี้มีเนื้อหาเกี่ยวกับอะไร เพื่อให้ผู้ลงนามเข้าใจเบื้องต้น"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      ข้อมูลนี้จะแสดงให้ผู้ลงนามอ่านเพื่อทำความเข้าใจเนื้อหาเอกสารก่อนลงนาม
                    </p>
                  </div>

                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                    <p className="font-medium mb-1">วิธีการใช้งาน:</p>
                    <p>1. เลือกผู้ลงนามจากรายการข้างต้น</p>
                    <p>2. กรอกสรุปเนื้อหาเอกสาร (เพื่อให้ผู้ลงนามเข้าใจ)</p>
                    <p>3. คลิกบน PDF เพื่อวางตำแหน่งลายเซ็น</p>
                    <p>4. <span className="font-medium text-blue-600">สามารถวางได้หลายตำแหน่งต่อคน</span> - เลือกคนเดียวกันแล้ววางใหม่ได้</p>
                    <p>5. คลิกปุ่ม X บนการ์ดเพื่อลบตำแหน่งที่วางผิด</p>
                    <p>6. ผู้ลงนามที่เลือก: <strong>{signers[selectedSignerIndex]?.name || 'ไม่มี'}</strong></p>
                  </div>

                  {memo.pdf_draft_path ? (
                    <div className="w-full">
                      <PDFViewer 
                        fileUrl={extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path} 
                        fileName="เอกสาร"
                        memo={memo}
                        onPositionClick={handlePositionClick}
                        onPositionRemove={handlePositionRemove}
                        signaturePositions={signaturePositions}
                        signers={signers}
                        showSignatureMode={true}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      ไม่มีไฟล์ PDF สำหรับวางตำแหน่งลายเซ็น
                    </div>
                  )}

                  {/* Attached Files Accordion - Step 2 */}
                  {(() => {
                    let attachedFiles = [];
                    if (memo?.attached_files) {
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
                    
                    return attachedFiles.length > 0 && (
                      <div className="mt-4">
                        <Accordion 
                          attachments={attachedFiles}
                          attachmentTitle={memo?.attachment_title}
                        />
                      </div>
                    );
                  })()}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={handlePrevious}>
                      ก่อนหน้า
                    </Button>
                    <Button 
                      onClick={handleNext}
                      disabled={!isStepComplete(3)}
                      className="bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      ตรวจสอบ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: ตรวจสอบและส่งเสนอ */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    ตรวจสอบและส่งเสนอ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium mb-3">ข้อมูลเอกสาร</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">เรื่อง:</span>
                          <span className="font-medium">{memo.subject}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">เลขหนังสือ:</span>
                          <span className="font-medium">{documentNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">ผู้เขียน:</span>
                          <span className="font-medium">{memo.author_name}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-3">ผู้ลงนาม</h3>
                      <div className="space-y-2">
                        {signers.map((signer, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">{signer.order}</Badge>
                            <span>{signer.name}</span>
                            <span className="text-gray-500">({signer.academic_rank || signer.org_structure_role || signer.position})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-medium mb-3">ตำแหน่งลายเซ็นที่กำหนด</h3>
                    <div className="space-y-2">
                      {signaturePositions.map((pos, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{pos.signer.name}</p>
                            <p className="text-sm text-gray-500">
                              หน้า {pos.page} ตำแหน่ง ({Math.round(pos.x)}, {Math.round(pos.y)})
                            </p>
                            {pos.comment && (
                              <p className="text-sm text-blue-600">ความเห็น: {pos.comment}</p>
                            )}
                          </div>
                          <Button
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePositionRemove(index)}
                          >
                            ลบ
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="outline" onClick={handlePrevious}>
                      ก่อนหน้า
                    </Button>
                    <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                      <Send className="h-4 w-4 mr-2" />
                      ส่งเสนอ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Dialog open={showLoadingModal}>
        <DialogContent>
          <DialogTitle>กำลังส่งเสนอต่อผู้ลงนามลำดับถัดไป กรุณารอสักครู่</DialogTitle>
          <DialogDescription>
            ระบบกำลังบันทึกไฟล์... กรุณาอย่าปิดหน้านี้จนกว่ากระบวนการจะเสร็จสมบูรณ์
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