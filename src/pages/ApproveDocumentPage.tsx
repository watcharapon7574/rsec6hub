import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  XCircle,
  MessageSquare,
  User,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAllMemos } from '@/hooks/useAllMemos';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import { submitPDFSignature } from '@/services/pdfSignatureService';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { extractPdfUrl } from '@/utils/fileUpload';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { RejectionCard } from '@/components/OfficialDocuments/RejectionCard';

const ApproveDocumentPage: React.FC = () => {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getMemoById, updateMemoApproval, updateMemoStatus, refetch } = useAllMemos();
  const { profile } = useEmployeeAuth();

  // State
  const [comment, setComment] = useState(''); // สำหรับการอนุมัติ
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false); // สำหรับ RejectionCard

  // Get memo data
  const memo = memoId ? getMemoById(memoId) : null;

  // Check if user can comment (only deputy and director)
  const canComment = profile?.position === 'deputy_director' || profile?.position === 'director';

  // Get current user's signature info
  const signaturePositions = Array.isArray(memo?.signature_positions) 
    ? memo.signature_positions 
    : [];
  const currentUserSignature = signaturePositions.find((pos: any) => 
    pos.signer?.user_id === profile?.user_id
  );

  useEffect(() => {
    if (!memo || !profile) return;

    // Check if this user should be able to approve this document
    // สำหรับผู้บริหาร ให้เข้าถึงได้ถ้ามีลายเซ็นใน signature_positions
    const isManagementRole = ['assistant_director', 'deputy_director', 'director'].includes(profile.position || '');
    const hasSignatureInDocument = currentUserSignature && memo.status === 'pending_sign';
    
    if (!currentUserSignature) {
      toast({
        title: "ไม่สามารถเข้าถึงได้",
        description: "คุณไม่มีสิทธิ์อนุมัติเอกสารนี้",
        variant: "destructive",
      });
      navigate('/documents');
    } else if (isManagementRole && hasSignatureInDocument) {
      // ผู้บริหารที่มีลายเซ็นในเอกสารสามารถเข้าถึงได้
      // ถ้า current_signer_order = 1 (ผู้เขียน) ให้แสดงให้ order 2 เห็น
      const nextSignerOrder = memo.current_signer_order === 1 ? 2 : memo.current_signer_order;
      const canApprove = currentUserSignature.signer?.order === nextSignerOrder;
      
      if (!canApprove) {
        // แสดงข้อความแจ้งว่ายังไม่ถึงลำดับ แต่ให้เข้าถึงได้เพื่อดูเอกสาร
        console.log('🔍 Management user accessing document before their turn');
      }
    } else if (currentUserSignature.signer?.order !== memo.current_signer_order) {
      toast({
        title: "ไม่สามารถเข้าถึงได้", 
        description: "ยังไม่ถึงลำดับการอนุมัติของคุณ",
        variant: "destructive",
      });
      navigate('/documents');
    }
  }, [memo, profile, currentUserSignature, navigate, toast]);

  // Handle rejection from RejectionCard
  const handleReject = async (rejectionReason: string) => {
    if (!memoId || !memo || !profile) return;

    setIsRejecting(true);
    try {
      console.log('🔄 ApproveDocumentPage: Calling updateMemoApproval for rejection', {
        memoId,
        rejectionReason,
        profile: { name: `${profile.first_name} ${profile.last_name}`, position: profile.position }
      });
      
      const result = await updateMemoApproval(memoId, 'reject', rejectionReason);
      
      if (result.success) {
        toast({
          title: "ตีกลับเอกสารสำเร็จ",
          description: "เอกสารถูกตีกลับไปยังผู้เขียนเพื่อแก้ไข",
        });
        navigate('/documents');
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถตีกลับเอกสารได้",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถตีกลับเอกสารได้ กรุณาลองใหม่",
        variant: "destructive",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSubmit = async (approvalAction: 'approve') => {
    if (!memoId || !memo || !profile) return;

    setIsSubmitting(true);
    setAction(approvalAction);

    try {
      if (approvalAction === 'approve' && memo.pdf_draft_path && profile.signature_url) {
        const extractedPdfUrl = extractPdfUrl(memo.pdf_draft_path);
        if (!extractedPdfUrl) {
          toast({
            title: "ข้อผิดพลาด",
            description: "ไม่สามารถดึง URL ไฟล์ PDF ได้",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
        
        setShowLoadingModal(true);
        let signSuccess = false;
        let signedPdfBlob: Blob | null = null;
        try {
          // --- เตรียม lines ตาม role (เหมือนเดิม) ---
          let lines: any[] = [];
          if (profile.position === 'assistant_director') {
            lines = [
              { type: "image", file_key: "sig1" },
              { type: "name", value: `${profile.first_name} ${profile.last_name}` },
              { type: "academic_rank", value: `ตำแหน่ง ${profile.academic_rank || ""}` },
              { type: "org_structure_role", value: `ปฏิบัติหน้าที่${profile.org_structure_role || ""}` }
            ];
          } else if (profile.position === 'deputy_director') {
            lines = [
              { type: "comment", value: `- ${comment || "เห็นชอบ"}` },
              { type: "image", file_key: "sig1" },
              { type: "name", value: `${profile.first_name} ${profile.last_name}` },
              { type: "org_structure_role", value: `ตำแหน่ง ${profile.org_structure_role || ""}` },
              { type: "timestamp", value: new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) }
            ];
          } else if (profile.position === 'director') {
            lines = [
              { type: "comment", value: `- ${comment || "เห็นชอบ"}` },
              { type: "image", file_key: "sig1" },
              { type: "name", value: `${profile.first_name} ${profile.last_name}` },
              { type: "org_structure_role", value: profile.org_structure_role || "" }
            ];
          } else {
            // clerk/author
            lines = [
              { type: "image", file_key: "sig1" },
              { type: "name", value: memo.author_name },
              { type: "academic_rank", value: `ตำแหน่ง ${memo.author_position || ""}` }
            ];
          }
          // --- เตรียม FormData และเรียก API ลายเซ็น ---
          // ดาวน์โหลด PDF
          const pdfRes = await fetch(extractedPdfUrl);
          const pdfBlob = await pdfRes.blob();
          // ดาวน์โหลดลายเซ็น
          const sigRes = await fetch(profile.signature_url);
          const sigBlob = await sigRes.blob();
          const formData = new FormData();
          formData.append('pdf', pdfBlob, 'document.pdf');
          formData.append('sig1', sigBlob, 'signature.png');
          // ใช้ตำแหน่งของ currentUserSignature
          const signerOrder = currentUserSignature?.signer?.order;
          const signerPos = signaturePositions.find(pos => pos.signer.order === signerOrder);
          if (!signerPos) throw new Error('ไม่พบตำแหน่งลายเซ็นของผู้ใช้');
          formData.append('signatures', JSON.stringify([
            {
              page: signerPos.page - 1, // 0-based
              x: signerPos.x,
              y: signerPos.y,
              width: 120,
              height: 60,
              lines
            }
          ]));
          const res = await fetch('https://pdf-memo-docx-production.up.railway.app/add_signature_v2', {
            method: 'POST',
            body: formData
          });
          if (!res.ok) {
            const errorText = await res.text();
            setShowLoadingModal(false);
            toast({ title: 'API error', description: errorText });
            return;
          }
          signedPdfBlob = await res.blob();
          signSuccess = true;
        } catch (e) {
          setShowLoadingModal(false);
          toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถเซ็นเอกสารได้' });
          return;
        }
        if (signSuccess && signedPdfBlob) {
          // --- อัปโหลดไฟล์ใหม่ (ชื่อใหม่) ---
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
            toast({ title: 'Upload error', description: uploadError.message });
            return;
          }
          // --- อัปเดต path และ current_signer_order ใน database ---
          const { data: { publicUrl: newPublicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(newFilePath);
          
          // หา nextSignerOrder - ปรับ logic สำหรับกรณีที่ผอ.เซ็น
          const currentOrder = currentUserSignature?.signer?.order || memo.current_signer_order || 1;
          const signatureOrders = signaturePositions.map((pos: any) => pos.signer?.order).filter(Boolean);
          const maxOrder = Math.max(...signatureOrders);
          
          let nextSignerOrder: number;
          let newStatus: string;
          
          // ถ้าเป็นผอ. (director) ให้ set current_signer_order = 5 เพื่อบ่งบอกว่าเสร็จสิ้น
          if (profile.position === 'director') {
            nextSignerOrder = 5;
            newStatus = 'completed';
            console.log('🎯 Director approved: Setting current_signer_order = 5 (completed)');
          } else {
            // สำหรับตำแหน่งอื่นๆ ใช้ logic เดิม
            nextSignerOrder = currentOrder < maxOrder ? currentOrder + 1 : currentOrder;
            newStatus = nextSignerOrder > maxOrder ? 'completed' : 'pending_sign';
          }
          
          await updateMemoStatus(memoId, newStatus, undefined, undefined, nextSignerOrder, newPublicUrl);
          // --- ลบไฟล์เก่า ---
          const { error: removeError } = await supabase.storage
            .from('documents')
            .remove([oldFilePath]);
          if (removeError) {
            // ไม่ต้อง return, แค่ log
          }
          setShowLoadingModal(false);
          toast({ title: 'สำเร็จ', description: 'ส่งเสนอต่อผู้ลงนามลำดับถัดไปแล้ว' });
          navigate('/documents');
          return;
        }
      }
      // ... กรณี approve แบบไม่มีลายเซ็น ...
      console.log('🔄 ApproveDocumentPage: Calling updateMemoApproval for approval', {
        memoId,
        approvalAction,
        comment: comment.trim(),
        profile: profile ? { name: `${profile.first_name} ${profile.last_name}`, position: profile.position } : null
      });
      
      const result = await updateMemoApproval(
        memoId, 
        approvalAction, 
        comment.trim() || undefined
      );
      if (result.success) {
        toast({
          title: "อนุมัติเอกสารสำเร็จ",
          description: "เอกสารได้ถูกส่งต่อไปยังผู้ลงนามถัดไป",
        });
        navigate('/documents');
      } else {
        toast({
          title: "เกิดข้อผิดพลาด",
          description: result.error || "ไม่สามารถดำเนินการได้",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setAction(null);
    }
  };

  if (!memo || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">ไม่พบเอกสารที่ต้องการพิจารณา</p>
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
                <h1 className="text-xl font-semibold text-gray-900">พิจารณาอนุมัติเอกสาร</h1>
                <p className="text-sm text-gray-500">{memo.subject}</p>
              </div>
            </div>
            
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              <Clock className="h-3 w-3 mr-1" />
              รอการพิจารณา
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex flex-col space-y-6">
          
          {/* Document Information and Actions */}
          <div className="space-y-6">
            
            {/* Document Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  ข้อมูลเอกสาร
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">เลขที่หนังสือ:</span>
                    <p className="font-semibold">{memo.doc_number}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">วันที่:</span>
                    <p>{new Date(memo.date || memo.created_at).toLocaleDateString('th-TH')}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">ผู้เขียน:</span>
                    <p>{memo.author_name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">ตำแหน่ง:</span>
                    <p>{memo.author_position}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <span className="font-medium text-gray-600">เรื่อง:</span>
                  <p className="mt-1">{memo.subject}</p>
                </div>

                {/* Document Summary Section - แสดงเสมอเพื่อ debug */}
                <Separator />
                <div>
                  <span className="font-medium text-gray-600">ความหมายโดยสรุปของเอกสารฉบับนี้:</span>
                  {memo.document_summary ? (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-gray-800 leading-relaxed">{memo.document_summary}</p>
                    </div>
                  ) : (
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-500 italic">ยังไม่มีข้อมูลสรุปจากธุรการ</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">ข้อมูลสรุปจากธุรการเพื่อช่วยให้เข้าใจเนื้อหาเอกสาร</p>
                </div>
              </CardContent>
            </Card>

            {/* PDF Viewer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  เอกสาร PDF
                </CardTitle>
              </CardHeader>
              <CardContent>
                {memo.pdf_draft_path ? (
                  <div className="w-full">
                    <PDFViewer 
                      fileUrl={(extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path) + '?t=' + Date.now()} 
                      fileName={memo.subject}
                      showSignatureMode={false}
                      showZoomControls={true}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    ไม่มีไฟล์ PDF สำหรับแสดง
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Attached Files Accordion */}
            {(() => {
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
              
              return attachedFiles.length > 0 && (
                <Accordion 
                  attachments={attachedFiles}
                  attachmentTitle={memo.attachment_title}
                />
              );
            })()}

            {/* Current User Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  ข้อมูลผู้พิจารณา
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <p><span className="font-medium">ชื่อ:</span> {profile.first_name} {profile.last_name}</p>
                  <p><span className="font-medium">ตำแหน่ง:</span> {profile.current_position || profile.position}</p>
                  <p><span className="font-medium">ลำดับการลงนาม:</span> {currentUserSignature?.signer?.order}</p>
                </div>
              </CardContent>
            </Card>

            {/* Comment Section (for deputy and director only) */}
            {canComment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    ความเห็น
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="comment">ความเห็นเพิ่มเติม (ไม่บังคับ)</Label>
                    <Textarea
                      id="comment"
                      placeholder="ระบุความเห็นหรือข้อเสนอแนะ..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Approval Action Button */}
            <Card>
              <CardHeader>
                <CardTitle>การอนุมัติ</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleSubmit('approve')}
                  disabled={isSubmitting || isRejecting}
                  className="bg-green-600 hover:bg-green-700 text-white w-full py-3"
                >
                  {isSubmitting && action === 'approve' ? (
                    "กำลังดำเนินการ..."
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      อนุมัติ
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Rejection Card */}
            <RejectionCard 
              onReject={handleReject}
              isLoading={isRejecting}
            />
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

export default ApproveDocumentPage;