import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  FileText,
  MapPin,
  Eye,
  ClipboardCheck,
  XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAllMemos } from '@/hooks/useAllMemos';
import { submitPDFSignature } from '@/services/pdfSignatureService';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AnimatedProgress } from '@/components/ui/progress';
import { extractPdfUrl } from '@/utils/fileUpload';
import { railwayPDFQueue } from '@/utils/requestQueue';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import Accordion from '@/components/OfficialDocuments/Accordion';

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

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
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

  // Handle reject report
  const handleReject = async () => {
    if (!rejectReason.trim() || !memoId || !taskAssignment) return;

    setIsRejecting(true);
    try {
      // 1. Update report memo status to rejected
      const { error: memoError } = await supabase
        .from('memos')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason.trim(),
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

      setShowRejectModal(false);
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

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="bg-card">
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            ตีกลับรายงาน
          </DialogTitle>
          <DialogDescription>
            กรุณาระบุเหตุผลในการตีกลับเพื่อให้ผู้รายงานทราบและแก้ไข
          </DialogDescription>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="reject-reason">เหตุผลในการตีกลับ *</Label>
              <Textarea
                id="reject-reason"
                placeholder="ระบุเหตุผล เช่น ข้อมูลไม่ครบถ้วน, ต้องการรายละเอียดเพิ่มเติม..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowRejectModal(false)} disabled={isRejecting}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || isRejecting}
            >
              {isRejecting ? 'กำลังดำเนินการ...' : 'ยืนยันตีกลับ'}
            </Button>
          </DialogFooter>
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

            {/* Document Number Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="outline" className="text-lg px-3 py-1">🔢</Badge>
                  ลงเลขหนังสือ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">ศธ ๐๔๐๐๗.๖๐๐/</span>
                  <Input
                    placeholder={suggestedDocNumber || 'xxxx/xx'}
                    value={docNumberSuffix}
                    onChange={(e) => setDocNumberSuffix(e.target.value)}
                    disabled={isNumberAssigned}
                    className="max-w-[200px]"
                  />
                  {!isNumberAssigned && (
                    <Button
                      onClick={handleAssignNumber}
                      disabled={!docNumberSuffix.trim() || isAssigningNumber}
                    >
                      {isAssigningNumber ? 'กำลังลงเลข...' : 'ลงเลข'}
                    </Button>
                  )}
                  {isNumberAssigned && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      ลงเลขแล้ว
                    </Badge>
                  )}
                </div>
                {suggestedDocNumber && !isNumberAssigned && (
                  <p className="text-sm text-muted-foreground">
                    แนะนำ: {suggestedDocNumber}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button
                variant="destructive"
                onClick={() => setShowRejectModal(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                ตีกลับ
              </Button>
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={!isStepComplete(1)}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: กำหนดตำแหน่งลายเซ็น */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                กำหนดตำแหน่งลายเซ็น
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Signers from original document */}
              <div>
                <Label className="text-base font-medium">
                  ผู้ลงนาม (จากเอกสารต้นเรื่อง - {signers.length} คน)
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {signers.map((signer, index) => {
                    const positionsCount = signaturePositions.filter(
                      pos => pos.signer.order === signer.order
                    ).length;
                    const isSelected = selectedSignerIndex === index;

                    return (
                      <div
                        key={signer.order}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-md'
                            : positionsCount > 0
                              ? 'border-green-500 bg-green-50 dark:bg-green-950'
                              : 'border-border hover:border-border hover:bg-muted'
                        }`}
                        onClick={() => setSelectedSignerIndex(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold">{signer.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {signer.job_position || signer.position}
                            </p>
                            {signer.org_structure_role && (
                              <p className="text-sm text-muted-foreground">
                                {signer.org_structure_role}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {positionsCount > 0 && (
                              <Badge variant="default" className="bg-green-600 text-white">
                                ✓ {positionsCount} ตำแหน่ง
                              </Badge>
                            )}
                            {isSelected && (
                              <Badge variant="outline" className="border-blue-500 text-blue-600">
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

              {/* Document Summary */}
              <div>
                <Label className="text-base font-medium">ความหมายโดยสรุปของเอกสาร</Label>
                <Textarea
                  placeholder="อธิบายเนื้อหาเอกสารโดยสรุป..."
                  value={documentSummary}
                  onChange={(e) => setDocumentSummary(e.target.value)}
                  rows={3}
                  className="mt-2"
                />
              </div>

              {/* Instructions */}
              <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <p className="font-medium mb-1">วิธีการใช้งาน:</p>
                <p>1. เลือกผู้ลงนามจากรายการข้างต้น</p>
                <p>2. คลิกบน PDF เพื่อวางตำแหน่งลายเซ็น</p>
                <p>3. สามารถวางได้หลายตำแหน่งต่อคน</p>
                <p>4. ผู้ลงนามที่เลือก: <strong>{signers[selectedSignerIndex]?.name || 'ไม่มี'}</strong></p>
              </div>

              {/* PDF Viewer */}
              {reportMemo?.pdf_draft_path ? (
                <PDFViewer
                  fileUrl={extractPdfUrl(reportMemo.pdf_draft_path) || reportMemo.pdf_draft_path}
                  fileName="เอกสารรายงาน"
                  memo={reportMemo}
                  onPositionClick={handlePositionClick}
                  onPositionRemove={handlePositionRemove}
                  signaturePositions={signaturePositions}
                  signers={signers}
                  showSignatureMode={true}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  ไม่มีไฟล์ PDF
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  ก่อนหน้า
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  disabled={!isStepComplete(2)}
                >
                  ตรวจสอบ
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: ยืนยัน */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                ตรวจสอบและยืนยัน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">สรุปข้อมูล</h3>
                  <div className="grid gap-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">เลขหนังสือรายงาน:</span>
                      <span className="font-medium">{reportMemo?.doc_number || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">จำนวนผู้ลงนาม:</span>
                      <span className="font-medium">{signers.length} คน</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">จำนวนตำแหน่งลายเซ็น:</span>
                      <span className="font-medium">{signaturePositions.length} ตำแหน่ง</span>
                    </div>
                  </div>
                </div>

                {/* Signers List */}
                <div>
                  <h3 className="font-semibold mb-2">ผู้ลงนาม</h3>
                  <div className="space-y-2">
                    {signers.map((signer) => {
                      const positions = signaturePositions.filter(
                        pos => pos.signer.order === signer.order
                      );
                      return (
                        <div key={signer.order} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{signer.name}</p>
                            <p className="text-sm text-muted-foreground">{signer.org_structure_role || signer.position}</p>
                          </div>
                          <Badge variant={positions.length > 0 ? 'default' : 'secondary'}>
                            {positions.length > 0 ? `${positions.length} ตำแหน่ง` : 'ยังไม่มีตำแหน่ง'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">หมายเหตุ</p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      เมื่อกด "เสนอรายงาน" ระบบจะส่งเอกสารไปยังผู้ลงนามตามลำดับ
                      และไม่สามารถแก้ไขได้จนกว่าจะมีการตีกลับ
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  ก่อนหน้า
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  เสนอรายงาน
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ManageReportMemoPage;
