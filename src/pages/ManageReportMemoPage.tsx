import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Eye,
  ClipboardCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAllMemos } from '@/hooks/useAllMemos';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AnimatedProgress } from '@/components/ui/progress';
import { extractPdfUrl } from '@/utils/fileUpload';
import { railwayPDFQueue } from '@/utils/requestQueue';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { RejectionCard } from '@/components/OfficialDocuments/RejectionCard';
import Step3SignaturePositions from '@/components/DocumentManage/Step3SignaturePositions';
import Step4Review from '@/components/DocumentManage/Step4Review';

interface SignerInfo {
  order: number;
  user_id: string;
  name: string;
  position: string;
  job_position?: string;
  role: string;
  academic_rank?: string;
  org_structure_role?: string;
  prefix?: string;
  signature_url?: string;
}

interface SignaturePosition {
  signer: SignerInfo & { positionIndex?: number };
  x: number;
  y: number;
  page: number;
  comment?: string;
}

const ManageReportMemoPage: React.FC = () => {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getMemoById, updateMemoStatus, updateMemoSigners, refetch } = useAllMemos();
  const { profile } = useEmployeeAuth();

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reportMemo, setReportMemo] = useState<any>(null);
  const [originalDocument, setOriginalDocument] = useState<any>(null);
  const [taskAssignment, setTaskAssignment] = useState<any>(null);
  const [signers, setSigners] = useState<SignerInfo[]>([]);
  const [signaturePositions, setSignaturePositions] = useState<SignaturePosition[]>([]);
  const [selectedSignerIndex, setSelectedSignerIndex] = useState(0);
  const [documentSummary, setDocumentSummary] = useState('');
  const [comment, setComment] = useState('');

  // Document number state
  const [docNumberSuffix, setDocNumberSuffix] = useState('');
  const [isNumberAssigned, setIsNumberAssigned] = useState(false);
  const [isAssigningNumber, setIsAssigningNumber] = useState(false);
  const [suggestedDocNumber, setSuggestedDocNumber] = useState('');

  // Reject state (ใช้กับ RejectionCard)
  const [isRejecting, setIsRejecting] = useState(false);

  // Loading modal state
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState({
    title: 'กำลังดำเนินการ',
    description: 'กรุณารอสักครู่...'
  });

  // Calculate current year dynamically
  const currentBuddhistYear = new Date().getFullYear() + 543;
  const yearShort = currentBuddhistYear.toString().slice(-2);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [memoId]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!memoId) {
        toast({
          title: 'ไม่พบข้อมูล',
          description: 'ไม่พบรหัสเอกสารรายงาน',
          variant: 'destructive'
        });
        navigate('/documents');
        return;
      }

      setLoading(true);
      try {
        // 1. Fetch report memo
        const { data: memo, error: memoError } = await supabase
          .from('memos')
          .select('*')
          .eq('id', memoId)
          .single();

        if (memoError || !memo) {
          throw new Error('ไม่พบบันทึกข้อความรายงาน');
        }

        setReportMemo(memo);

        // Check if already has doc_number
        if (memo.doc_number) {
          setIsNumberAssigned(true);
          // Extract suffix from doc_number
          const match = memo.doc_number.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
          if (match) {
            setDocNumberSuffix(match[1]);
          } else {
            setDocNumberSuffix(memo.doc_number);
          }
        }

        // 2. Find task_assignment with this report_memo_id
        const { data: assignment, error: assignmentError } = await supabase
          .from('task_assignments')
          .select('*')
          .eq('report_memo_id', memoId)
          .single();

        if (assignmentError || !assignment) {
          throw new Error('ไม่พบข้อมูลการมอบหมายงาน');
        }

        setTaskAssignment(assignment);

        // 3. Get original document
        let originalDoc = null;
        if (assignment.document_type === 'memo' && assignment.memo_id) {
          const { data: origMemo, error: origError } = await supabase
            .from('memos')
            .select('*')
            .eq('id', assignment.memo_id)
            .single();

          if (!origError && origMemo) {
            originalDoc = { ...origMemo, type: 'memo' };
          }
        } else if (assignment.document_type === 'doc_receive' && assignment.doc_receive_id) {
          const { data: origDocReceive, error: origError } = await supabase
            .from('doc_receives')
            .select('*')
            .eq('id', assignment.doc_receive_id)
            .single();

          if (!origError && origDocReceive) {
            originalDoc = { ...origDocReceive, type: 'doc_receive' };
          }
        }

        if (!originalDoc) {
          throw new Error('ไม่พบเอกสารต้นเรื่อง');
        }

        setOriginalDocument(originalDoc);

        // 4. Get signers from original document's signature_positions
        if (originalDoc.signature_positions && Array.isArray(originalDoc.signature_positions)) {
          const extractedSigners: SignerInfo[] = originalDoc.signature_positions.map((pos: any) => ({
            order: pos.signer?.order || 1,
            user_id: pos.signer?.user_id || '',
            name: pos.signer?.name || '',
            position: pos.signer?.position || '',
            job_position: pos.signer?.job_position,
            role: pos.signer?.role || '',
            academic_rank: pos.signer?.academic_rank,
            org_structure_role: pos.signer?.org_structure_role,
            prefix: pos.signer?.prefix,
            signature_url: pos.signer?.signature_url
          }));

          // Remove duplicates by order
          const uniqueSigners = extractedSigners.filter(
            (signer, index, self) => index === self.findIndex(s => s.order === signer.order)
          );

          setSigners(uniqueSigners.sort((a, b) => a.order - b.order));
        }

        // 5. Get suggested doc number
        await getLatestDocNumber();

      } catch (error: any) {
        console.error('Error loading data:', error);
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: error.message || 'ไม่สามารถโหลดข้อมูลได้',
          variant: 'destructive'
        });
        navigate('/documents');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [memoId, navigate, toast]);

  // Get latest doc number for suggestion
  const getLatestDocNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('memos')
        .select('doc_number, doc_number_status')
        .not('doc_number_status', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data) return;

      let latestDoc = null;
      let latestTimestamp = null;

      for (const item of data) {
        const docData = item as any;
        if (docData.doc_number && docData.doc_number_status) {
          let timestamp = null;
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
        let docToProcess = latestDoc;
        if (latestDoc.includes('ศธ')) {
          const match = latestDoc.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
          if (match) docToProcess = match[1];
        }
        const match = docToProcess.match(/(\d+)\/(\d+)$/);
        if (match) {
          const lastNumber = parseInt(match[1]);
          const nextNumber = lastNumber + 1;
          setSuggestedDocNumber(`${nextNumber}/${yearShort}`);
        }
      }
    } catch (error) {
      console.error('Error getting latest doc number:', error);
    }
  };

  // Handle assign document number
  const handleAssignNumber = async () => {
    if (!docNumberSuffix.trim() || !memoId) return;

    setIsAssigningNumber(true);
    try {
      const fullDocNumber = `ศธ ๐๔๐๐๗.๖๐๐/${docNumberSuffix.trim()}`;
      const docNumberStatus = {
        status: 'ลงเลขหนังสือแล้ว',
        assigned_at: new Date().toISOString(),
        clerk_id: profile?.user_id || null
      };

      const { error } = await supabase
        .from('memos')
        .update({
          doc_number: fullDocNumber,
          doc_number_status: docNumberStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', memoId);

      if (error) throw error;

      setIsNumberAssigned(true);
      setReportMemo((prev: any) => ({
        ...prev,
        doc_number: fullDocNumber,
        doc_number_status: docNumberStatus
      }));

      toast({
        title: 'ลงเลขหนังสือสำเร็จ',
        description: `เลขหนังสือ: ${fullDocNumber}`
      });
    } catch (error: any) {
      console.error('Error assigning number:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถลงเลขหนังสือได้',
        variant: 'destructive'
      });
    } finally {
      setIsAssigningNumber(false);
    }
  };

  // Handle reject report - รับ reason จาก RejectionCard component
  const handleRejectFromCard = async (reason: string) => {
    if (!reason.trim() || !memoId || !taskAssignment) return;

    setIsRejecting(true);
    try {
      // 1. Update report memo status to rejected
      const { error: memoError } = await supabase
        .from('memos')
        .update({
          status: 'rejected',
          rejection_reason: reason.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', memoId);

      if (memoError) throw memoError;

      // 2. Update task assignment status back to in_progress
      const { error: taskError } = await supabase
        .from('task_assignments')
        .update({
          status: 'in_progress',
          completed_at: null,
          completion_note: null
        })
        .eq('id', taskAssignment.id);

      if (taskError) throw taskError;

      toast({
        title: 'ตีกลับรายงานสำเร็จ',
        description: 'ผู้รายงานจะได้รับแจ้งให้แก้ไขรายงาน'
      });
      navigate('/documents');
    } catch (error: any) {
      console.error('Error rejecting report:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถตีกลับรายงานได้',
        variant: 'destructive'
      });
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle signature position click
  const handlePositionClick = (x: number, y: number, page: number) => {
    if (selectedSignerIndex >= signers.length) return;

    const signer = signers[selectedSignerIndex];
    const existingPositionsCount = signaturePositions.filter(
      pos => pos.signer.order === signer.order
    ).length;

    const newPosition: SignaturePosition = {
      signer: {
        ...signer,
        positionIndex: existingPositionsCount + 1
      },
      x,
      y,
      page: page + 1,
      comment: comment
    };

    setSignaturePositions(prev => [...prev, newPosition]);
    setComment('');
  };

  // Handle position remove
  const handlePositionRemove = (index: number) => {
    setSignaturePositions(prev => prev.filter((_, i) => i !== index));
  };

  // Check if step is complete
  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1:
        return isNumberAssigned;
      case 2:
        return signaturePositions.length >= 1;
      case 3:
        return true;
      default:
        return false;
    }
  };

  // Handle submit report
  const handleSubmit = async () => {
    if (!reportMemo || !memoId || signaturePositions.length === 0) return;

    setShowLoadingModal(true);
    setLoadingMessage({
      title: 'กำลังเสนอรายงาน',
      description: 'กำลังบันทึกข้อมูลและเตรียมส่งต่อผู้ลงนาม...'
    });

    try {
      // 1. Update document summary if provided
      if (documentSummary.trim()) {
        const { error: summaryError } = await supabase
          .from('memos')
          .update({
            document_summary: documentSummary.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', memoId);

        if (summaryError) {
          console.error('Error updating document summary:', summaryError);
        }
      }

      // 2. Update signature_positions with renumbered orders
      const updatedSignaturePositions = signaturePositions.map(pos => ({
        ...pos,
        signer: {
          ...pos.signer,
          order: signers.findIndex(s => s.user_id === pos.signer.user_id) + 1
        }
      }));

      // 3. Get first signer order
      const firstOrder = Math.min(...updatedSignaturePositions.map(p => p.signer.order));

      // 4. Update report memo with signature positions and pending_sign status
      const { error: updateError } = await supabase
        .from('memos')
        .update({
          signature_positions: updatedSignaturePositions,
          status: 'pending_sign',
          current_signer_order: firstOrder,
          updated_at: new Date().toISOString()
        })
        .eq('id', memoId);

      if (updateError) throw updateError;

      // 5. Sign PDF with first signer (author/clerk)
      const firstSigner = signers.find(s => s.order === firstOrder);
      if (firstSigner && firstSigner.signature_url && reportMemo.pdf_draft_path) {
        setLoadingMessage({
          title: 'กำลังลงลายเซ็น',
          description: 'กำลังประทับลายเซ็นบนเอกสาร...'
        });

        const extractedPdfUrl = extractPdfUrl(reportMemo.pdf_draft_path);
        if (extractedPdfUrl) {
          try {
            // Fetch PDF and signature
            const pdfRes = await fetch(extractedPdfUrl);
            if (!pdfRes.ok) throw new Error('ไม่สามารถดาวน์โหลด PDF ได้');
            const pdfBlob = await pdfRes.blob();

            const sigRes = await fetch(firstSigner.signature_url);
            if (!sigRes.ok) throw new Error('ไม่สามารถดาวน์โหลดลายเซ็นได้');
            const sigBlob = await sigRes.blob();

            // Prepare signature data
            const lines = [
              { type: 'image', file_key: 'sig1' },
              { type: 'name', value: firstSigner.name },
              { type: 'academic_rank', value: `ตำแหน่ง ${firstSigner.job_position || firstSigner.position || ''}` }
            ];
            if (firstSigner.org_structure_role) {
              lines.push({ type: 'role', value: firstSigner.org_structure_role });
            }

            // Get positions for first signer
            const signerPositions = updatedSignaturePositions.filter(
              pos => pos.signer.order === firstOrder
            );

            const formData = new FormData();
            formData.append('pdf', pdfBlob, 'document.pdf');
            formData.append('sig1', sigBlob, 'signature.png');

            const signaturesPayload = signerPositions.map(pos => ({
              page: pos.page - 1,
              x: Math.round(pos.x),
              y: Math.round(pos.y),
              width: 120,
              height: 60,
              lines
            }));
            formData.append('signatures', JSON.stringify(signaturesPayload));

            // Call signature API
            const signedPdfBlob = await railwayPDFQueue.enqueueWithRetry(
              async () => {
                const res = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/add_signature_v2', {
                  method: 'POST',
                  body: formData
                });
                if (!res.ok) throw new Error(await res.text());
                return await res.blob();
              },
              'Add Signature V2',
              3,
              1000
            );

            // Upload signed PDF
            if (signedPdfBlob) {
              setLoadingMessage({
                title: 'กำลังบันทึกไฟล์',
                description: 'กำลังอัปโหลดเอกสารที่ลงนามแล้ว...'
              });

              const oldFilePath = extractedPdfUrl.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, '');
              const newFileName = `signed_${Date.now()}_${oldFilePath.split('/').pop()}`;
              const newFilePath = oldFilePath.replace(/[^/]+$/, newFileName);

              const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(newFilePath, signedPdfBlob, {
                  contentType: 'application/pdf',
                  upsert: false
                });

              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from('documents')
                  .getPublicUrl(newFilePath);

                if (urlData?.publicUrl) {
                  await supabase
                    .from('memos')
                    .update({
                      pdf_draft_path: urlData.publicUrl,
                      current_signer_order: firstOrder + 1
                    })
                    .eq('id', memoId);
                }
              }
            }
          } catch (signError) {
            console.error('Error signing PDF:', signError);
            // Continue even if signing fails - the document is still submitted
          }
        }
      }

      toast({
        title: 'เสนอรายงานสำเร็จ',
        description: 'รายงานถูกส่งต่อให้ผู้ลงนามเรียบร้อยแล้ว'
      });
      navigate('/documents');

    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถเสนอรายงานได้',
        variant: 'destructive'
      });
    } finally {
      setShowLoadingModal(false);
    }
  };

  // Get attached files
  const getAttachedFiles = (memo: any) => {
    if (!memo?.attached_files) return [];
    try {
      if (typeof memo.attached_files === 'string') {
        const parsed = JSON.parse(memo.attached_files);
        return Array.isArray(parsed) ? parsed : [];
      }
      return Array.isArray(memo.attached_files) ? memo.attached_files : [];
    } catch {
      return [];
    }
  };

  // Render loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-8 w-8 text-teal-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-lg font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Step indicator component
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-4 mb-6">
      {[1, 2, 3].map((step) => (
        <React.Fragment key={step}>
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium transition-colors ${
              currentStep === step
                ? 'bg-teal-600 border-teal-600 text-white'
                : currentStep > step
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'border-border text-muted-foreground'
            }`}
          >
            {currentStep > step ? <CheckCircle className="h-5 w-5" /> : step}
          </div>
          {step < 3 && (
            <div className={`w-16 h-1 rounded ${currentStep > step ? 'bg-green-600' : 'bg-border'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Loading Modal */}
      <Dialog open={showLoadingModal}>
        <DialogContent className="bg-card p-6 rounded-lg shadow-lg">
          <DialogTitle>{loadingMessage.title}</DialogTitle>
          <DialogDescription>{loadingMessage.description}</DialogDescription>
          <div className="flex flex-col items-center gap-4 mt-4">
            <svg className="animate-spin h-8 w-8 text-teal-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <AnimatedProgress />
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/documents')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">จัดการรายงาน</h1>
                <p className="text-sm text-muted-foreground">
                  {reportMemo?.subject || 'ไม่มีหัวข้อ'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <StepIndicator />

        {/* Step 1: ตรวจสอบเอกสาร */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* Original Document Card */}
            <Card>
              <CardHeader className="bg-blue-50 dark:bg-blue-950 border-b">
                <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <FileText className="h-5 w-5" />
                  เอกสารต้นเรื่อง (อ้างอิง)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label className="text-muted-foreground">เรื่อง</Label>
                  <p className="font-medium">{originalDocument?.subject || '-'}</p>
                </div>
                {originalDocument?.doc_number && (
                  <div>
                    <Label className="text-muted-foreground">เลขหนังสือ</Label>
                    <p className="font-medium">{originalDocument.doc_number}</p>
                  </div>
                )}
                {originalDocument?.pdf_draft_path && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(extractPdfUrl(originalDocument.pdf_draft_path), '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      ดูเอกสารต้นเรื่อง
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Report Memo Card */}
            <Card>
              <CardHeader className="bg-teal-50 dark:bg-teal-950 border-b">
                <CardTitle className="flex items-center gap-2 text-teal-800 dark:text-teal-200">
                  <ClipboardCheck className="h-5 w-5" />
                  เอกสารรายงาน (ตรวจสอบส่วนนี้)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label className="text-muted-foreground">เรื่อง</Label>
                  <p className="font-medium">{reportMemo?.subject || '-'}</p>
                </div>
                {reportMemo?.introduction && (
                  <div>
                    <Label className="text-muted-foreground">คำขึ้นต้น</Label>
                    <p>{reportMemo.introduction}</p>
                  </div>
                )}
                {reportMemo?.fact && (
                  <div>
                    <Label className="text-muted-foreground">ข้อเท็จจริง</Label>
                    <p className="whitespace-pre-wrap">{reportMemo.fact}</p>
                  </div>
                )}
                {reportMemo?.proposal && (
                  <div>
                    <Label className="text-muted-foreground">ข้อเสนอ</Label>
                    <p className="whitespace-pre-wrap">{reportMemo.proposal}</p>
                  </div>
                )}
                {reportMemo?.pdf_draft_path && (
                  <div className="pt-2">
                    <PDFViewer
                      fileUrl={extractPdfUrl(reportMemo.pdf_draft_path) || reportMemo.pdf_draft_path}
                      fileName="เอกสารรายงาน"
                      memo={reportMemo}
                    />
                  </div>
                )}
                {getAttachedFiles(reportMemo).length > 0 && (
                  <div className="pt-2">
                    <Accordion
                      attachments={getAttachedFiles(reportMemo)}
                      attachmentTitle={reportMemo?.attachment_title}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Document Number Card - ใช้ UI เดียวกับ Step1DocumentNumber */}
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
                  <div className="flex items-stretch">
                    <div className="text-lg font-medium text-muted-foreground bg-muted px-4 rounded-l-md border border-r-0 border-border flex items-center">
                      ศธ ๐๔๐๐๗.๖๐๐/
                    </div>
                    <Input
                      id="doc-number"
                      placeholder={suggestedDocNumber || 'xxxx/xx'}
                      value={docNumberSuffix}
                      onChange={(e) => setDocNumberSuffix(e.target.value)}
                      className={`text-lg rounded-l-none flex-1 ${isNumberAssigned
                        ? 'bg-muted dark:bg-card text-muted-foreground cursor-not-allowed border-border'
                        : 'bg-card text-foreground border-border'
                      }`}
                      disabled={isNumberAssigned}
                      readOnly={isNumberAssigned}
                    />
                  </div>

                  {isNumberAssigned && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      เลขหนังสือถูกลงแล้ว: ศธ ๐๔๐๐๗.๖๐๐/{docNumberSuffix}
                    </p>
                  )}
                </div>
                <div className="flex justify-between">
                  <div /> {/* Empty div for spacing */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAssignNumber}
                      disabled={(!docNumberSuffix.trim() && !suggestedDocNumber) || isNumberAssigned || isAssigningNumber}
                      className={isNumberAssigned
                        ? "bg-muted dark:bg-card text-muted-foreground border-border cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700 transition-colors"
                      }
                    >
                      {isAssigningNumber ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          กำลังลงเลข...
                        </>
                      ) : isNumberAssigned ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          ลงเลขแล้ว
                        </>
                      ) : (
                        "ลงเลข"
                      )}
                    </Button>
                    <Button
                      onClick={() => setCurrentStep(2)}
                      disabled={!isStepComplete(1)}
                      className="bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ถัดไป
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rejection Card - ใช้ RejectionCard component เหมือน Step1DocumentNumber */}
            <RejectionCard
              onReject={handleRejectFromCard}
              isLoading={isRejecting}
            />
          </div>
        )}

        {/* Step 2: กำหนดตำแหน่งลายเซ็น - ใช้ Step3SignaturePositions component */}
        {currentStep === 2 && (
          <Step3SignaturePositions
            signers={signers}
            signaturePositions={signaturePositions}
            comment={comment}
            documentSummary={documentSummary}
            selectedSignerIndex={selectedSignerIndex}
            memo={reportMemo}
            onCommentChange={setComment}
            onDocumentSummaryChange={setDocumentSummary}
            onSelectedSignerIndexChange={setSelectedSignerIndex}
            onPositionClick={handlePositionClick}
            onPositionRemove={handlePositionRemove}
            onPrevious={() => setCurrentStep(1)}
            onNext={() => setCurrentStep(3)}
            isStepComplete={isStepComplete(2)}
          />
        )}

        {/* Step 3: ยืนยัน - ใช้ Step4Review component */}
        {currentStep === 3 && (
          <Step4Review
            memo={reportMemo}
            documentNumber={reportMemo?.doc_number || '-'}
            signers={signers}
            signaturePositions={signaturePositions}
            onPositionRemove={handlePositionRemove}
            onPrevious={() => setCurrentStep(2)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
};

export default ManageReportMemoPage;
