import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Clock,
  Eye,
  ClipboardCheck,
  PenTool
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAllMemos } from '@/hooks/useAllMemos';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import { submitPDFSignature } from '@/services/pdfSignatureService';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AnimatedProgress } from '@/components/ui/progress';
import { extractPdfUrl } from '@/utils/fileUpload';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { RejectionCard } from '@/components/OfficialDocuments/RejectionCard';
import { calculateNextSignerOrder, calculateNextSignerOrderWithParallel, isInParallelGroup, isCurrentSignerWithParallel } from '@/services/approvalWorkflowService';
import { ParallelSignerConfig } from '@/types/memo';

const ApproveDocumentPage: React.FC = () => {
  const { memoId } = useParams<{ memoId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const signOnBehalfUserId = searchParams.get('signOnBehalf'); // admin ลงนามแทน
  const { toast } = useToast();
  const { getMemoById, updateMemoApproval, updateMemoStatus, refetch } = useAllMemos();
  const { profile } = useEmployeeAuth();

  // State
  const [comment, setComment] = useState(''); // สำหรับการอนุมัติ
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false); // สำหรับ RejectionCard
  const [hasShownPermissionToast, setHasShownPermissionToast] = useState(false); // ป้องกัน toast ซ้ำ
  const [docReceive, setDocReceive] = useState<any>(null); // สำหรับเอกสาร doc_receive
  const [isDocReceive, setIsDocReceive] = useState(false); // flag ว่าเป็น doc_receive หรือไม่
  const [originalDocument, setOriginalDocument] = useState<any>(null); // เอกสารต้นเรื่องสำหรับ report memo
  const [isReportMemo, setIsReportMemo] = useState(false); // flag ว่าเป็น report memo หรือไม่
  const [hasCompletedAnnotation, setHasCompletedAnnotation] = useState(false); // ขีดเขียนเสร็จแล้ว
  const [signingLockWaiting, setSigningLockWaiting] = useState(false); // กำลังรอ FIFO lock
  const [signOnBehalfProfile, setSignOnBehalfProfile] = useState<any>(null); // profile ของคนที่ลงนามแทน

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [memoId]);

  // โหลด profile ของคนที่ admin ลงนามแทน
  useEffect(() => {
    if (signOnBehalfUserId) {
      supabase.from('profiles')
        .select('*')
        .eq('user_id', signOnBehalfUserId)
        .single()
        .then(({ data }) => {
          if (data) setSignOnBehalfProfile(data);
        });
    }
  }, [signOnBehalfUserId]);

  // Try to get memo from memos table first (from cache)
  let memoFromMemosTable = memoId ? getMemoById(memoId) : null;
  const [memoFromDatabase, setMemoFromDatabase] = useState<any>(null);

  // If not found in cache, try fetching from memos table first, then doc_receive
  useEffect(() => {
    const fetchDocument = async () => {
      if (!memoId) return;

      // If found in cache, use it
      if (memoFromMemosTable) {
        setIsDocReceive(false);
        setMemoFromDatabase(null);
        return;
      }

      // Try memos table first (use maybeSingle to avoid 406 error when not found)
      try {
        const { data: memoData, error: memoError } = await supabase
          .from('memos')
          .select('*')
          .eq('id', memoId)
          .maybeSingle();

        if (!memoError && memoData) {
          console.log('Found memo in memos table:', memoId);
          setMemoFromDatabase(memoData);
          setIsDocReceive(false);
          return;
        }
      } catch (err) {
        // Not found in memos table, continue to try doc_receive
      }

      // Try doc_receive table (use maybeSingle to avoid 406 error when not found)
      try {
        const { data, error } = await (supabase as any)
          .from('doc_receive')
          .select('*')
          .eq('id', memoId)
          .maybeSingle();

        if (!error && data) {
          console.log('Found document in doc_receive table:', memoId);
          setDocReceive(data);
          setIsDocReceive(true);
        }
      } catch (err) {
        console.error('Error fetching document:', err);
      }
    };

    fetchDocument();
  }, [memoId, memoFromMemosTable]);

  // Check if this is a report memo and fetch original document
  // Report memo is identified by checking if this memo is linked as report_memo_id in task_assignments
  useEffect(() => {
    const fetchOriginalDocument = async () => {
      // Wait until we have memo data (from cache or database fetch)
      if (!memoId || (!memoFromMemosTable && !memoFromDatabase)) return;

      try {
        // Check if this memo is a report memo by finding task_assignment with this report_memo_id
        const { data: assignment, error: assignmentError } = await (supabase
          .from('task_assignments' as any)
          .select('*')
          .eq('report_memo_id', memoId)
          .is('deleted_at', null)
          .maybeSingle() as any);

        // If no assignment found with this report_memo_id, it's not a report memo
        if (assignmentError || !assignment) {
          console.log('Not a report memo (no task_assignment found):', memoId);
          setIsReportMemo(false);
          setOriginalDocument(null);
          return;
        }

        // This IS a report memo
        setIsReportMemo(true);
        console.log('📋 This is a report memo:', memoId);

        // Get original document based on document_type
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
          const { data: origDocReceive, error: origError } = await (supabase
            .from('doc_receives' as any)
            .select('*')
            .eq('id', assignment.doc_receive_id)
            .single() as any);

          if (!origError && origDocReceive) {
            originalDoc = { ...origDocReceive, type: 'doc_receive' };
          }
        }

        if (originalDoc) {
          console.log('📋 Original document found for report memo:', originalDoc.subject);
          setOriginalDocument(originalDoc);
        }
      } catch (error) {
        console.error('Error fetching original document:', error);
        setIsReportMemo(false);
        setOriginalDocument(null);
      }
    };

    fetchOriginalDocument();
  }, [memoId, memoFromMemosTable, memoFromDatabase]);

  // Use either memo or docReceive (prioritize cache, then database fetch, then doc_receive)
  const memo = isDocReceive ? docReceive : (memoFromMemosTable || memoFromDatabase);

  // Wrapper functions for updating either memos or doc_receive
  const updateDocumentStatus = async (docId: string, status: string, docNumber?: string, rejectionReason?: string, currentSignerOrder?: number, newPdfDraftPath?: string, clerkId?: string) => {
    if (isDocReceive) {
      // Update doc_receive table
      try {
        const updates: any = { status };
        if (docNumber) updates.doc_number = docNumber;
        if (typeof currentSignerOrder === 'number') updates.current_signer_order = currentSignerOrder;
        if (newPdfDraftPath) updates.pdf_draft_path = newPdfDraftPath;
        if (clerkId) updates.clerk_id = clerkId;

        if (rejectionReason && status === 'rejected' && profile) {
          const { data: currentDoc } = await (supabase as any)
            .from('doc_receive')
            .select('form_data')
            .eq('id', docId)
            .single();

          if (currentDoc) {
            const currentFormData = currentDoc.form_data as any || {};
            updates.form_data = {
              ...currentFormData,
              rejection_reason: rejectionReason,
              rejected_at: new Date().toISOString()
            };
          }

          const rejectedNameComment = {
            name: `${profile.first_name} ${profile.last_name}`,
            comment: rejectionReason,
            rejected_at: new Date().toISOString(),
            position: profile.current_position || profile.job_position || profile.position || ''
          };
          updates.rejected_name_comment = rejectedNameComment;
        }

        const { error } = await (supabase as any)
          .from('doc_receive')
          .update(updates)
          .eq('id', docId);

        if (error) throw error;
        return { success: true };
      } catch (error) {
        console.error('Error updating doc_receive:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    } else {
      // Use existing updateMemoStatus for memos table
      return await updateMemoStatus(docId, status, docNumber, rejectionReason, currentSignerOrder, newPdfDraftPath, clerkId);
    }
  };

  const updateDocumentApproval = async (docId: string, action: 'approve' | 'reject', rejectionReason?: string) => {
    if (isDocReceive) {
      // Handle doc_receive approval/rejection
      try {
        const updates: any = {
          updated_at: new Date().toISOString(),
        };

        if (action === 'reject') {
          updates.status = 'rejected';
          updates.current_signer_order = 0;

          if (rejectionReason && profile) {
            const rejectedNameComment = {
              name: `${profile.first_name} ${profile.last_name}`,
              comment: rejectionReason,
              rejected_at: new Date().toISOString(),
              position: profile.current_position || profile.job_position || profile.position || ''
            };
            updates.rejected_name_comment = rejectedNameComment;
          }
        }

        const { error } = await (supabase as any)
          .from('doc_receive')
          .update(updates)
          .eq('id', docId);

        if (error) throw error;
        return { success: true };
      } catch (error) {
        console.error('Error updating doc_receive approval:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    } else {
      // Use existing updateMemoApproval for memos table
      return await updateMemoApproval(docId, action, rejectionReason, signOnBehalfUserId || undefined);
    }
  };

  // Check if user can comment (assistant_director, deputy_director, director, or admin)
  const canComment = profile?.is_admin === true ||
                     profile?.position === 'assistant_director' ||
                     profile?.position === 'deputy_director' ||
                     profile?.position === 'director';

  // Debug: แสดงข้อมูลสำหรับการ debug (ลบออกได้หลังจากแก้ไขเสร็จ)
  useEffect(() => {
    if (memo && profile) {
      console.log('🔍 Debug ApproveDocumentPage data:', {
        memo: {
          id: memo.id,
          status: memo.status,
          current_signer_order: memo.current_signer_order,
          signature_positions: memo.signature_positions,
          signer_list_progress: (memo as any).signer_list_progress,
          document_summary: memo.document_summary,
          has_document_summary: !!memo.document_summary,
          isDocReceive
        },
        profile: {
          user_id: profile.user_id,
          position: profile.position,
          name: `${profile.first_name} ${profile.last_name}`
        }
      });
    }
  }, [memo, profile, isDocReceive]);

  // Get current user's signature info - ใช้ signer_list_progress แทน signature_positions
  const signerListProgress = Array.isArray((memo as any)?.signer_list_progress) 
    ? (memo as any).signer_list_progress 
    : [];
  const signaturePositions = Array.isArray(memo?.signature_positions) 
    ? memo.signature_positions 
    : [];
  
  // หาข้อมูลผู้ลงนามปัจจุบันจาก signer_list_progress ก่อน ถ้าไม่มีค่อยใช้ signature_positions
  const currentUserSigner = signerListProgress.find((signer: any) => 
    signer.user_id === profile?.user_id
  );
  const currentUserSignature = signaturePositions.find((pos: any) => 
    pos.signer?.user_id === profile?.user_id
  );

  // ใช้ข้อมูลจาก signer_list_progress หากมี ไม่งั้นใช้ signature_positions
  // Admin (is_admin = true) สามารถเข้าถึงและดูเอกสารได้ทุกเอกสาร
  const isAdminUser = profile?.is_admin === true;
  const userCanSign = currentUserSigner || currentUserSignature || isAdminUser;

  useEffect(() => {
    if (!memo || !profile || hasShownPermissionToast) return;

    // Check if this user should be able to approve this document
    // สำหรับผู้บริหาร ให้เข้าถึงได้ถ้ามีลายเซ็นใน signature_positions หรือ signer_list_progress
    // Admin (is_admin = true) สามารถเข้าถึงได้ทุกเอกสาร
    const isManagementRole = isAdminUser || ['assistant_director', 'deputy_director', 'director'].includes(profile.position || '');
    const hasSignatureInDocument = (currentUserSigner || currentUserSignature) && memo.status === 'pending_sign';

    // Admin bypass - allow access without showing permission error
    if (isAdminUser) {
      console.log('🔓 Admin user - bypassing permission checks');
      return;
    }

    // เช็ค parallel group — ถ้า user อยู่ใน parallel group และ current_signer_order ตรง → อนุญาตเข้าถึง
    const parallelConfig = (memo as any)?.parallel_signers as ParallelSignerConfig | null;
    const isParallelMember = parallelConfig && isInParallelGroup(profile.user_id, parallelConfig);
    const isParallelTurn = isParallelMember && memo.current_signer_order === parallelConfig?.order
      && !(parallelConfig?.completed_user_ids || []).includes(profile.user_id);

    if (isParallelTurn) {
      console.log('🔓 User is in parallel group and it is their turn');
      return; // อนุญาตเข้าถึง
    }

    if (!currentUserSigner && !currentUserSignature && !isParallelMember) {
      setHasShownPermissionToast(true);
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
      
      // ตรวจสอบลำดับจาก signer_list_progress ก่อน ถ้าไม่มีค่อยใช้ signature_positions
      const userOrder = currentUserSigner?.order || currentUserSignature?.signer?.order;
      const canApprove = userOrder === nextSignerOrder;
      
      if (!canApprove) {
        // แสดงข้อความแจ้งว่ายังไม่ถึงลำดับ แต่ให้เข้าถึงได้เพื่อดูเอกสาร
        console.log('🔍 Management user accessing document before their turn');
      }
    } else {
      // ตรวจสอบลำดับสำหรับผู้ใช้ทั่วไป
      const userOrder = currentUserSigner?.order || currentUserSignature?.signer?.order;
      console.log('🔍 Regular user check:', {
        isManagementRole,
        hasSignatureInDocument,
        userOrder,
        currentSignerOrder: memo.current_signer_order,
        userCanSign,
        userPosition: profile?.position
      });
      
      if (userOrder !== memo.current_signer_order) {
        // เพิ่มเงื่อนไขป้องกัน: ถ้าผู้ใช้สามารถลงนามได้แสดงว่าถึงลำดับแล้ว
        if (userCanSign) {
          console.log('⚠️ User can sign but order check failed - allowing access');
          return;
        }
        
        setHasShownPermissionToast(true);
        toast({
          title: "ไม่สามารถเข้าถึงได้", 
          description: "ยังไม่ถึงลำดับการอนุมัติของคุณ",
          variant: "destructive",
        });
        navigate('/documents');
      }
    }
  }, [memo, profile, userCanSign, currentUserSigner, currentUserSignature, navigate, toast, hasShownPermissionToast]);

  // Handle rejection from RejectionCard
  const handleReject = async (rejectionReason: string, annotatedPdfUrl?: string, annotatedAttachments?: string[]) => {
    if (!memoId || !memo || !profile) return;

    setIsRejecting(true);
    try {
      console.log('🔄 ApproveDocumentPage: Calling updateDocumentApproval for rejection', {
        memoId,
        rejectionReason,
        annotatedPdfUrl: annotatedPdfUrl ? 'yes' : 'no',
        isDocReceive,
        profile: { name: `${profile.first_name} ${profile.last_name}`, position: profile.position }
      });

      // Cleanup old annotated files before saving new ones
      const { cleanupAnnotatedFiles } = await import('@/utils/pdfAnnotationUtils');
      await cleanupAnnotatedFiles(memoId);

      const result = await updateDocumentApproval(memoId, 'reject', rejectionReason);

      if (result.success) {
        // Save annotated PDF URL if provided
        if (annotatedPdfUrl || (annotatedAttachments && annotatedAttachments.length > 0)) {
          const annotationUpdate: any = {};
          if (annotatedPdfUrl) annotationUpdate.annotated_pdf_path = annotatedPdfUrl;
          if (annotatedAttachments && annotatedAttachments.length > 0) {
            annotationUpdate.annotated_attachment_paths = JSON.stringify(annotatedAttachments);
          }
          const tableName = isDocReceive ? 'doc_receive' : 'memos';
          await (supabase as any)
            .from(tableName)
            .update(annotationUpdate)
            .eq('id', memoId);
        }

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

    // ตรวจสอบสิทธิ์อีกครั้งก่อนเซ็น — รองรับ parallel group
    const parallelConfig = (memo as any)?.parallel_signers as ParallelSignerConfig | null;
    const isParallelMember = isInParallelGroup(profile.user_id, parallelConfig);
    if (!userCanSign && !isParallelMember) {
      console.log('❌ User cannot sign - no permission');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    setAction(approvalAction);

    try {
      // FIFO Lock — acquire lock ก่อนเซ็น
      const { data: lockAcquired } = await supabase.rpc('acquire_signing_lock', {
        p_memo_id: memoId,
        p_user_id: profile.user_id
      });
      if (!lockAcquired) {
        setSigningLockWaiting(true);
        toast({
          title: "กรุณารอสักครู่",
          description: "มีผู้ลงนามท่านอื่นกำลังดำเนินการ ระบบจะลองใหม่ใน 3 วินาที",
        });
        setIsSubmitting(false);
        // Retry หลัง 3 วินาที
        setTimeout(() => {
          setSigningLockWaiting(false);
          handleSubmit(approvalAction);
        }, 3000);
        return;
      }
      setSigningLockWaiting(false);
      // Admin ลงนามแทน: ใช้ profile ของคนที่ลงนามแทน
      const effectiveProfile = signOnBehalfProfile || profile;
      const isAdminSigningOnBehalf = isAdminUser && (signOnBehalfProfile || (!currentUserSigner && !currentUserSignature));
      const hasSignatureAccess = effectiveProfile.signature_url || isAdminSigningOnBehalf;

      if (approvalAction === 'approve' && memo.pdf_draft_path && hasSignatureAccess) {
        // ตรวจสอบว่ามีลายเซ็นหรือไม่ (ข้ามสำหรับ admin ที่ลงนามแทน)
        if (!effectiveProfile.signature_url && !isAdminSigningOnBehalf) {
          toast({
            title: "ไม่มีลายเซ็น",
            description: "กรุณาอัปโหลดลายเซ็นในโปรไฟล์ของคุณก่อน",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

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
        // ป้องกัน SW reload ระหว่างลงนาม
        (window as any).__signingInProgress = true;

        // ถ้าเป็น admin ลงนามแทน ให้เพิ่ม "admin" นำหน้า comment
        const isAdminSigning = isAdminUser && !currentUserSigner && !currentUserSignature;
        const commentPrefix = isAdminSigning ? '[admin] ' : '';

        // หาผู้ลงนามปัจจุบันสำหรับ admin ที่ลงนามแทน
        let signingPosition = profile.position;
        let currentSignerInfo: any = null;
        if (isAdminSigning) {
          // หาผู้ลงนามที่มี order ตรงกับ current_signer_order
          currentSignerInfo = signerListProgress.find((s: any) => s.order === memo.current_signer_order) ||
                             signaturePositions.find((p: any) => p.signer?.order === memo.current_signer_order)?.signer;
          if (currentSignerInfo) {
            signingPosition = currentSignerInfo.role || currentSignerInfo.position || profile.position;
            console.log('🔓 Admin signing on behalf of:', currentSignerInfo);
          }
        }

        try {
          // --- เตรียม lines ตาม role สำหรับตำแหน่งแรก (มี comment) และตำแหน่งถัดไป (ไม่มี comment) ---
          let linesWithComment: any[] = [];
          let linesWithoutComment: any[] = [];

          // ถ้าเป็น admin ลงนามแทน ให้ใช้ข้อมูลของผู้ลงนามจริง ไม่ใช่ข้อมูล admin
          let signerProfile: any = signOnBehalfProfile || profile; // ใช้ signOnBehalf ก่อน

          if (isAdminSigning && !signOnBehalfProfile && currentSignerInfo?.user_id) {
            // ดึงข้อมูล profile ของผู้ลงนามจริงจาก database
            const { data: actualSignerProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', currentSignerInfo.user_id)
              .single();

            if (actualSignerProfile) {
              signerProfile = actualSignerProfile as any;
              console.log('🔓 Admin using actual signer profile:', actualSignerProfile);
            }
          }

          // สร้างชื่อเต็มพร้อม prefix ของผู้ลงนามจริง
          const fullName = `${signerProfile.prefix || ''}${signerProfile.first_name} ${signerProfile.last_name}`.trim();

          if (signingPosition === 'assistant_director') {
            // ถ้ามี comment ให้แสดง comment ในตำแหน่งแรก
            if (comment && comment.trim()) {
              linesWithComment = [
                { type: "comment", value: `- ${commentPrefix}${comment.trim()}` },
                { type: "image", file_key: "sig1" },
                { type: "name", value: fullName },
                { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || signerProfile.job_position || ""}` },
                { type: "org_structure_role", value: signerProfile.org_structure_role || "" }
              ];
              linesWithoutComment = [
                { type: "image", file_key: "sig1" },
                { type: "name", value: fullName },
                { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || signerProfile.job_position || ""}` },
                { type: "org_structure_role", value: signerProfile.org_structure_role || "" }
              ];
            } else {
              // ถ้าไม่มี comment แต่เป็น admin ให้แสดง [admin] เท่านั้น
              if (isAdminSigning) {
                linesWithComment = [
                  { type: "comment", value: `- ${commentPrefix.trim()}` },
                  { type: "image", file_key: "sig1" },
                  { type: "name", value: fullName },
                  { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || signerProfile.job_position || ""}` },
                  { type: "org_structure_role", value: signerProfile.org_structure_role || "" }
                ];
              } else {
                linesWithComment = [
                  { type: "image", file_key: "sig1" },
                  { type: "name", value: fullName },
                  { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || signerProfile.job_position || ""}` },
                  { type: "org_structure_role", value: signerProfile.org_structure_role || "" }
                ];
              }
              linesWithoutComment = [
                { type: "image", file_key: "sig1" },
                { type: "name", value: fullName },
                { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || signerProfile.job_position || ""}` },
                { type: "org_structure_role", value: signerProfile.org_structure_role || "" }
              ];
            }
          } else if (signingPosition === 'deputy_director') {
            const commentValue = comment ? `${commentPrefix}${comment}` : (isAdminSigning ? `${commentPrefix.trim()}` : "เห็นชอบ");
            linesWithComment = [
              { type: "comment", value: `- ${commentValue}` },
              { type: "image", file_key: "sig1" },
              { type: "name", value: fullName },
              { type: "position_rank", value: `ตำแหน่ง ${signerProfile.job_position || ""} วิทยฐานะ ${signerProfile.academic_rank || ""}` },
              { type: "org_structure_role", value: signerProfile.org_structure_role || "" },
              { type: "timestamp", value: new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) }
            ];
            linesWithoutComment = [
              { type: "image", file_key: "sig1" },
              { type: "name", value: fullName },
              { type: "position_rank", value: `ตำแหน่ง ${signerProfile.job_position || ""} วิทยฐานะ ${signerProfile.academic_rank || ""}` },
              { type: "org_structure_role", value: signerProfile.org_structure_role || "" },
              { type: "timestamp", value: new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) }
            ];
          } else if (signingPosition === 'director') {
            const commentValue = comment ? `${commentPrefix}${comment}` : (isAdminSigning ? `${commentPrefix.trim()}` : "เห็นชอบ");
            linesWithComment = [
              { type: "comment", value: `- ${commentValue}` },
              { type: "image", file_key: "sig1" },
              { type: "name", value: fullName },
              { type: "job_position", value: signerProfile.job_position || signerProfile.position || "" },
              { type: "org_structure_role", value: signerProfile.org_structure_role || "" }
            ];
            linesWithoutComment = [
              { type: "image", file_key: "sig1" },
              { type: "name", value: fullName },
              { type: "job_position", value: signerProfile.job_position || signerProfile.position || "" },
              { type: "org_structure_role", value: signerProfile.org_structure_role || "" }
            ];
          } else {
            // clerk/author - ใช้ข้อมูลจาก memo ที่อาจมี prefix แล้ว
            linesWithComment = [
              { type: "image", file_key: "sig1" },
              { type: "name", value: memo.author_name },
              { type: "academic_rank", value: `ตำแหน่ง ${memo.author_position || ""}` }
            ];
            linesWithoutComment = [...linesWithComment]; // ผู้เขียนไม่มี comment อยู่แล้ว
          }
          // --- เตรียม FormData และเรียก API ลายเซ็น ---
          // ตรวจสอบ signature URL ก่อนดาวน์โหลด
          const signatureUrl = signerProfile.signature_url;
          if (!signatureUrl) {
            console.error('❌ No signature URL for signer:', signerProfile);
            setShowLoadingModal(false);
            toast({
              title: 'ไม่พบลายเซ็น',
              description: isAdminSigning
                ? 'ผู้ลงนามที่ต้องการลงนามแทนยังไม่มีลายเซ็นในระบบ'
                : 'กรุณาอัปโหลดลายเซ็นในโปรไฟล์ของคุณก่อน',
              variant: 'destructive'
            });
            return;
          }

          // ใช้ตำแหน่งของผู้ลงนาม - ใช้ข้อมูลจาก signer_list_progress หากมี
          // ถ้าเป็น admin ลงนามแทน ให้ใช้ current_signer_order
          const signerOrder = isAdminSigning
            ? memo.current_signer_order
            : (currentUserSigner?.order || currentUserSignature?.signer?.order);

          console.log('🔍 Signing with order:', signerOrder, 'isAdminSigning:', isAdminSigning, 'signOnBehalf:', signOnBehalfUserId);

          // ค้นหาตำแหน่งลายเซ็น — signOnBehalf ใช้ user_id ของคนที่ลงนามแทน
          let userSignaturePositions = signOnBehalfUserId
            ? signaturePositions.filter(pos => pos.signer?.user_id === signOnBehalfUserId)
            : signaturePositions.filter(pos => pos.signer?.order === signerOrder);

          // หากไม่เจอจาก order/user_id ให้ลองค้นหาจาก user_id ของตัวเอง
          if (userSignaturePositions.length === 0 && profile?.user_id && !isAdminSigning) {
            userSignaturePositions = signaturePositions.filter(pos => pos.signer?.user_id === profile.user_id);
          }

          // หากไม่เจอจาก user_id ให้ลองค้นหาจาก position (ใช้ signingPosition สำหรับ admin)
          if (userSignaturePositions.length === 0) {
            const positionToMatch = isAdminSigning ? signingPosition : profile?.position;
            userSignaturePositions = signaturePositions.filter(pos =>
              pos.signer?.position === positionToMatch ||
              pos.signer?.role === positionToMatch
            );
          }

          // หากยังไม่เจอและเป็น director ให้สร้างตำแหน่ง default
          if (userSignaturePositions.length === 0 && signingPosition === 'director') {
            console.log('🔧 Creating default signature position for director');
            userSignaturePositions = [{
              signer: {
                user_id: profile.user_id,
                name: `${profile.first_name} ${profile.last_name}`,
                position: profile.position,
                order: signerOrder || 2
              },
              page: 1,
              x: 350, // ตำแหน่ง default สำหรับผู้อำนวยการ
              y: 200
            }];
          }
          
          if (userSignaturePositions.length === 0) {
            console.error('🚨 Cannot find signature positions for user:', {
              signerOrder,
              userId: profile?.user_id,
              userPosition: profile?.position,
              signaturePositions: signaturePositions,
              signaturePositionsDetails: signaturePositions.map(pos => ({
                signer: pos.signer,
                page: pos.page,
                x: pos.x,
                y: pos.y
              })),
              currentUserSigner,
              currentUserSignature
            });
            setShowLoadingModal(false);
            toast({ 
              title: 'ไม่พบตำแหน่งลายเซ็น', 
              description: 'ไม่พบตำแหน่งลายเซ็นของคุณในเอกสาร กรุณาติดต่อผู้ดูแลระบบ',
              variant: "destructive"
            });
            return;
          }
          
          // parallel_signer → override lines เป็นแค่ลายเซ็น PNG ทุกจุด
          const isParallelSigner = userSignaturePositions.some(pos => pos.signer?.role === 'parallel_signer');
          if (isParallelSigner) {
            linesWithComment = [{ type: "image", file_key: "sig1" }];
            linesWithoutComment = [{ type: "image", file_key: "sig1" }];
          }

          // สร้าง signatures payload สำหรับ Edge Function
          const linesImageOnly = [{ type: "image", file_key: "sig1" }];
          const signaturesPayload = userSignaturePositions.map((pos, index) => ({
            page: pos.page - 1,
            x: Math.round(pos.x),
            y: Math.round(pos.y),
            width: 120,
            height: 60,
            lines: index === 0 ? linesWithComment : linesImageOnly
          }));

          console.log(`📝 Signatures payload (${userSignaturePositions.length} positions)`);

          // คำนวณ next signer order และ status (รองรับ parallel group)
          const currentOrder = currentUserSigner?.order || currentUserSignature?.signer?.order || memo.current_signer_order || 1;
          const parallelConfig = (memo as any)?.parallel_signers || null;
          const effectiveUserId = signOnBehalfUserId || profile?.user_id || '';
          const approvalResult = calculateNextSignerOrderWithParallel(
            currentOrder, signaturePositions, signingPosition, parallelConfig, effectiveUserId
          );

          // คำนวณ file paths
          const oldFilePath = extractedPdfUrl.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, '');
          const newFileName = `signed_${Date.now()}_${oldFilePath.split('/').pop()}`;
          const newFilePath = oldFilePath.replace(/[^/]+$/, newFileName);

          // เรียก Edge Function (server-to-server ไม่ต้องดาวน์โหลด PDF ผ่านมือถือ)
          // ใช้ getSession แทน refreshSession เพื่อไม่ให้ trigger TOKEN_REFRESHED event
          // ซึ่งจะทำให้ onAuthStateChange ตรวจ 8-hour limit แล้วบังคับ signOut ระหว่างลงนาม
          const { data: { session: currentSession } } = await supabase.auth.getSession();

          let accessToken = currentSession?.access_token;

          if (!accessToken) {
            // Session หมดอายุจริง ให้ sign out แล้ว redirect ไป login
            await supabase.auth.signOut();
            navigate('/auth');
            throw new Error('Session หมดอายุ กรุณาล็อกอินใหม่');
          }

          console.log('🔑 Using access token from getSession');

          const edgeRes = await fetch(
            'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/sign-document',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                pdfUrl: extractedPdfUrl,
                signatureUrl,
                signatures: signaturesPayload,
                oldFilePath,
                newFilePath,
                documentId: memoId,
                tableName: isDocReceive ? 'doc_receive' : 'memos',
                newStatus: approvalResult.newStatus,
                nextSignerOrder: approvalResult.nextSignerOrder,
                ...('parallelUpdate' in approvalResult && approvalResult.parallelUpdate && parallelConfig && {
                  parallelSignersUpdate: {
                    ...parallelConfig,
                    completed_user_ids: approvalResult.parallelUpdate.completed_user_ids,
                  }
                }),
              }),
            }
          );

          const edgeResult = await edgeRes.json();
          if (!edgeRes.ok) {
            if (edgeRes.status === 401) {
              // Token ถูก reject - sign out แล้ว redirect
              await supabase.auth.signOut();
              navigate('/auth');
              throw new Error('Session หมดอายุ ระบบจะพาไปหน้า login');
            }
            throw new Error(edgeResult.error || edgeResult.msg || 'ไม่สามารถเซ็นเอกสารได้');
          }

          // อัปเดต parallel_signers.completed_user_ids หลัง edge function สำเร็จ
          if ('parallelUpdate' in approvalResult && approvalResult.parallelUpdate && parallelConfig) {
            await supabase.from('memos').update({
              parallel_signers: {
                ...parallelConfig,
                completed_user_ids: approvalResult.parallelUpdate.completed_user_ids,
              }
            } as any).eq('id', memoId);
            console.log('✅ Updated parallel_signers.completed_user_ids:', approvalResult.parallelUpdate.completed_user_ids);
          }

          setShowLoadingModal(false);
          toast({ title: 'สำเร็จ', description: 'ส่งเสนอต่อผู้ลงนามลำดับถัดไปแล้ว' });
          navigate('/documents');
          // Clear signing flag หลัง navigate แล้ว + apply pending SW update
          setTimeout(() => {
            (window as any).__signingInProgress = false;
            if ((window as any).__pendingSWReload) {
              (window as any).__pendingSWReload = false;
              window.location.reload();
            }
          }, 1500);
          return;
        } catch (e) {
          setShowLoadingModal(false);
          (window as any).__signingInProgress = false;
          toast({ title: 'เกิดข้อผิดพลาด', description: (e instanceof Error ? e.message : 'ไม่สามารถเซ็นเอกสารได้') });
          return;
        }
      }
      // ... กรณี approve แบบไม่มีลายเซ็น ...
      console.log('🔄 ApproveDocumentPage: Calling updateDocumentApproval for approval', {
        memoId,
        approvalAction,
        isDocReceive,
        comment: comment.trim(),
        profile: profile ? { name: `${profile.first_name} ${profile.last_name}`, position: profile.position } : null
      });

      const result = await updateDocumentApproval(
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
      // Release FIFO lock
      await supabase.from('memos')
        .update({ signing_lock: null } as any)
        .eq('id', memoId);
      setIsSubmitting(false);
      setAction(null);
    }
  };

  if (!memo || !profile) {
    return (
      <div className="min-h-screen bg-background p-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">ไม่พบเอกสารที่ต้องการพิจารณา</p>
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
                <h1 className="text-lg font-semibold text-foreground">พิจารณาอนุมัติเอกสาร</h1>
                <p className="text-sm text-muted-foreground">{memo.subject}</p>
              </div>
            </div>
            
            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 dark:text-amber-600 border-amber-600">
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
                    <span className="font-medium text-muted-foreground">เลขที่หนังสือ:</span>
                    <p className="font-semibold">{memo.doc_number}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">วันที่:</span>
                    <p>{new Date(memo.date || memo.created_at).toLocaleDateString('th-TH')}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">ผู้เขียน:</span>
                    <p>{memo.author_name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">ตำแหน่ง:</span>
                    <p>{memo.author_position}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <span className="font-medium text-muted-foreground">เรื่อง:</span>
                  <p className="mt-1">{memo.subject}</p>
                </div>

                {/* Document Summary Section - แสดงเสมอเพื่อ debug */}
                <Separator />
                <div>
                  <span className="font-medium text-muted-foreground">ความหมายโดยสรุปของเอกสารฉบับนี้:</span>
                  {(() => {
                    // สำหรับ doc_receive: ใช้ subject เป็นข้อมูลสรุป
                    // สำหรับ memos: ใช้ document_summary
                    const summaryText = isDocReceive ? memo.subject : memo.document_summary;

                    return summaryText ? (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-foreground leading-relaxed">{summaryText}</p>
                      </div>
                    ) : (
                      <div className="mt-2 p-3 bg-muted dark:bg-card/60 border border-border rounded-lg">
                        <p className="text-sm text-muted-foreground italic">
                          {isDocReceive
                            ? 'ยังไม่มีข้อมูลเรื่อง'
                            : 'ยังไม่มีข้อมูลสรุปจากธุรการ'}
                        </p>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground mt-1">
                    {isDocReceive
                      ? 'เรื่องของหนังสือรับจากภายนอก'
                      : 'ข้อมูลสรุปจากธุรการเพื่อช่วยให้เข้าใจเนื้อหาเอกสาร'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Original Document Card - Only for report memos */}
            {isReportMemo && originalDocument && (
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800">
                  <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                    <ClipboardCheck className="h-5 w-5" />
                    เอกสารต้นเรื่อง (อ้างอิง)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">เรื่อง:</span>
                      <p className="font-semibold">{originalDocument.subject}</p>
                    </div>
                    {originalDocument.doc_number && (
                      <div>
                        <span className="font-medium text-muted-foreground">เลขที่หนังสือ:</span>
                        <p className="font-semibold">{originalDocument.doc_number}</p>
                      </div>
                    )}
                    {originalDocument.sender_name && (
                      <div>
                        <span className="font-medium text-muted-foreground">จาก:</span>
                        <p>{originalDocument.sender_name}</p>
                      </div>
                    )}
                  </div>
                  {originalDocument.pdf_draft_path && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                        onClick={() => window.open(extractPdfUrl(originalDocument.pdf_draft_path) || originalDocument.pdf_draft_path, '_blank')}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        ดูเอกสารต้นเรื่อง
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                      showFullscreenButton={true}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
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
                  <p><span className="font-medium">ตำแหน่ง:</span> {profile.job_position || profile.current_position || profile.position}</p>
                  <p><span className="font-medium">ลำดับการลงนาม:</span> {currentUserSigner?.order || currentUserSignature?.signer?.order}</p>
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

            {/* Admin ลงนามแทน banner */}
            {signOnBehalfProfile && (
              <Card className="border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Badge className="bg-blue-600 text-white">Admin</Badge>
                    <span className="font-semibold">
                      ลงนามแทน: {signOnBehalfProfile.prefix || ''}{signOnBehalfProfile.first_name} {signOnBehalfProfile.last_name}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    ระบบจะใช้ลายเซ็นของ {signOnBehalfProfile.first_name} ในการลงนาม
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Annotation Requirement */}
            {(() => {
              const annotationRequired = (memo as any)?.annotation_required_for as string[] | null;
              const needsAnnotation = annotationRequired?.includes(profile?.user_id || '') && !hasCompletedAnnotation;

              return needsAnnotation ? (
                <Card className="border-orange-300 dark:border-orange-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <PenTool className="h-5 w-5" />
                      ต้องขีดเขียนก่อนลงนาม
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      คุณต้องเปิดเอกสารและขีดเขียนก่อนจึงจะสามารถลงนามได้
                    </p>
                    <Button
                      variant="outline"
                      className="w-full border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                      onClick={() => {
                        // TODO: เปิด PDFAnnotationEditor ใน mode "save as layer"
                        // สำหรับตอนนี้ให้ mark ว่าขีดเขียนแล้ว (จะ implement จริงใน Phase 5)
                        setHasCompletedAnnotation(true);
                        toast({
                          title: "พร้อมลงนาม",
                          description: "คุณสามารถลงนามได้แล้ว",
                        });
                      }}
                    >
                      <PenTool className="h-4 w-4 mr-2" />
                      เปิดโหมดขีดเขียน
                    </Button>
                  </CardContent>
                </Card>
              ) : null;
            })()}

            {/* Approval Action Button */}
            <Card>
              <CardHeader>
                <CardTitle>การอนุมัติ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {signingLockWaiting && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Clock className="h-4 w-4 animate-spin" />
                    กรุณารอสักครู่ มีผู้ลงนามท่านอื่นกำลังดำเนินการ...
                  </p>
                )}
                <Button
                  onClick={() => handleSubmit('approve')}
                  disabled={
                    isSubmitting || isRejecting || signingLockWaiting ||
                    ((memo as any)?.annotation_required_for?.includes(profile?.user_id || '') && !hasCompletedAnnotation)
                  }
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
              pdfUrl={memo?.pdf_draft_path ? (extractPdfUrl(memo.pdf_draft_path) || undefined) : undefined}
              attachedFiles={(() => {
                if (!memo?.attached_files) return [];
                try {
                  const parsed = typeof memo.attached_files === 'string' ? JSON.parse(memo.attached_files) : memo.attached_files;
                  return Array.isArray(parsed) ? parsed : [];
                } catch { return []; }
              })()}
              documentId={memoId}
              userId={profile?.user_id}
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

export default ApproveDocumentPage;