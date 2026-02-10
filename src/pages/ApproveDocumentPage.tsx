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
import { railwayPDFQueue } from '@/utils/requestQueue';
import { extractPdfUrl } from '@/utils/fileUpload';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { RejectionCard } from '@/components/OfficialDocuments/RejectionCard';
import { calculateNextSignerOrder } from '@/services/approvalWorkflowService';

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
  const [hasShownPermissionToast, setHasShownPermissionToast] = useState(false); // ป้องกัน toast ซ้ำ
  const [docReceive, setDocReceive] = useState<any>(null); // สำหรับเอกสาร doc_receive
  const [isDocReceive, setIsDocReceive] = useState(false); // flag ว่าเป็น doc_receive หรือไม่

  // Try to get memo from memos table first
  let memoFromMemosTable = memoId ? getMemoById(memoId) : null;

  // If not found in memos table, try doc_receive table
  useEffect(() => {
    const fetchDocReceive = async () => {
      if (!memoId) return;
      if (memoFromMemosTable) {
        // Found in memos table, not doc_receive
        setIsDocReceive(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from('doc_receive')
          .select('*')
          .eq('id', memoId)
          .single();

        if (!error && data) {
          setDocReceive(data);
          setIsDocReceive(true);
        }
      } catch (err) {
        console.error('Error fetching doc_receive:', err);
      }
    };

    fetchDocReceive();
  }, [memoId, memoFromMemosTable]);

  // Use either memo or docReceive
  const memo = isDocReceive ? docReceive : memoFromMemosTable;

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
        const updates: any = {};

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
      return await updateMemoApproval(docId, action, rejectionReason);
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

    if (!currentUserSigner && !currentUserSignature) {
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
  const handleReject = async (rejectionReason: string) => {
    if (!memoId || !memo || !profile) return;

    setIsRejecting(true);
    try {
      console.log('🔄 ApproveDocumentPage: Calling updateDocumentApproval for rejection', {
        memoId,
        rejectionReason,
        isDocReceive,
        profile: { name: `${profile.first_name} ${profile.last_name}`, position: profile.position }
      });

      const result = await updateDocumentApproval(memoId, 'reject', rejectionReason);
      
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

    // ตรวจสอบสิทธิ์อีกครั้งก่อนเซ็น
    if (!userCanSign) {
      console.log('❌ User cannot sign - no permission');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    setAction(approvalAction);

    try {
      // Admin สามารถลงนามแทนได้โดยใช้ลายเซ็นของผู้ลงนามจริง
      const isAdminSigningOnBehalf = isAdminUser && !currentUserSigner && !currentUserSignature;
      const hasSignatureAccess = profile.signature_url || isAdminSigningOnBehalf;

      if (approvalAction === 'approve' && memo.pdf_draft_path && hasSignatureAccess) {
        // ตรวจสอบว่ามีลายเซ็นหรือไม่ (ข้ามสำหรับ admin ที่ลงนามแทน)
        if (!profile.signature_url && !isAdminSigningOnBehalf) {
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
        let signSuccess = false;
        let signedPdfBlob: Blob | null = null;

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
          let signerProfile: any = profile; // default ใช้ profile ของผู้ใช้ปัจจุบัน

          if (isAdminSigning && currentSignerInfo?.user_id) {
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
                { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || ""}` },
                { type: "org_structure_role", value: `ปฏิบัติหน้าที่${signerProfile.org_structure_role || ""}` }
              ];
              linesWithoutComment = [
                { type: "image", file_key: "sig1" },
                { type: "name", value: fullName },
                { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || ""}` },
                { type: "org_structure_role", value: `ปฏิบัติหน้าที่${signerProfile.org_structure_role || ""}` }
              ];
            } else {
              // ถ้าไม่มี comment แต่เป็น admin ให้แสดง [admin] เท่านั้น
              if (isAdminSigning) {
                linesWithComment = [
                  { type: "comment", value: `- ${commentPrefix.trim()}` },
                  { type: "image", file_key: "sig1" },
                  { type: "name", value: fullName },
                  { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || ""}` },
                  { type: "org_structure_role", value: `ปฏิบัติหน้าที่${signerProfile.org_structure_role || ""}` }
                ];
              } else {
                linesWithComment = [
                  { type: "image", file_key: "sig1" },
                  { type: "name", value: fullName },
                  { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || ""}` },
                  { type: "org_structure_role", value: `ปฏิบัติหน้าที่${signerProfile.org_structure_role || ""}` }
                ];
              }
              linesWithoutComment = [
                { type: "image", file_key: "sig1" },
                { type: "name", value: fullName },
                { type: "academic_rank", value: `ตำแหน่ง ${signerProfile.academic_rank || ""}` },
                { type: "org_structure_role", value: `ปฏิบัติหน้าที่${signerProfile.org_structure_role || ""}` }
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
          
          // ดาวน์โหลดลายเซ็น - ใช้ลายเซ็นของผู้ลงนามจริง (signerProfile) ไม่ใช่ของ admin
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
          console.log('📥 Fetching signature from:', signatureUrl, isAdminSigning ? '(actual signer)' : '(current user)');
          const sigRes = await fetch(signatureUrl);
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
          // ใช้ตำแหน่งของผู้ลงนาม - ใช้ข้อมูลจาก signer_list_progress หากมี
          // ถ้าเป็น admin ลงนามแทน ให้ใช้ current_signer_order
          const signerOrder = isAdminSigning
            ? memo.current_signer_order
            : (currentUserSigner?.order || currentUserSignature?.signer?.order);

          console.log('🔍 Signing with order:', signerOrder, 'isAdminSigning:', isAdminSigning);

          // ค้นหาตำแหน่งลายเซ็นทั้งหมดที่ตรงกับ order ของผู้ใช้ (เหมือน DocumentManagePage)
          let userSignaturePositions = signaturePositions.filter(pos => pos.signer?.order === signerOrder);
          
          // หากไม่เจอจาก order ให้ลองค้นหาจาก user_id (ข้ามถ้าเป็น admin ลงนามแทน)
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
          
          // สร้าง signatures payload สำหรับ /add_signature_v2 - comment เฉพาะตำแหน่งแรก
          const signaturesPayload = userSignaturePositions.map((pos, index) => ({
            page: pos.page - 1, // ปรับจาก 1-based เป็น 0-based
            x: Math.round(pos.x),
            y: Math.round(pos.y),
            width: 120,
            height: 60,
            lines: index === 0 ? linesWithComment : linesWithoutComment // comment เฉพาะตำแหน่งแรก
          }));
          
          formData.append('signatures', JSON.stringify(signaturesPayload));
          
          console.log(`📝 User signature positions (${userSignaturePositions.length} positions):`, userSignaturePositions.map(pos => ({ x: pos.x, y: pos.y, page: pos.page })));
          console.log(`📝 Signatures payload:`, JSON.stringify(signaturesPayload, null, 2));

          // Call Railway add_signature_v2 API with queue + retry logic
          signedPdfBlob = await railwayPDFQueue.enqueueWithRetry(
            async () => {
              const res = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/add_signature_v2', {
                method: 'POST',
                body: formData
              });
              if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText);
              }
              return await res.blob();
            },
            'Add Signature V2 (Approve)',
            3,
            1000
          );
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
          
          // หา nextSignerOrder - ใช้ centralized logic จาก approvalWorkflowService
          const currentOrder = currentUserSigner?.order || currentUserSignature?.signer?.order || memo.current_signer_order || 1;
          
          // calculateNextSignerOrder รองรับการข้ามผู้ลงนาม + Director shortcut
          const approvalResult = calculateNextSignerOrder(currentOrder, signaturePositions, signingPosition);
          const nextSignerOrder = approvalResult.nextSignerOrder;
          const newStatus = approvalResult.newStatus;
          
          const updateResult = await updateDocumentStatus(memoId, newStatus, undefined, undefined, nextSignerOrder, newPublicUrl);
          
          // ตรวจสอบว่า database update สำเร็จก่อนลบไฟล์เก่า
          if (!updateResult.success) {
            console.error('❌ Failed to update document status:', (updateResult as any).error);
            // ลบไฟล์ใหม่ที่อัปโหลดไปแล้วเพื่อ rollback
            await supabase.storage.from('documents').remove([newFilePath]);
            setShowLoadingModal(false);
            toast({ 
              title: 'เกิดข้อผิดพลาด', 
              description: 'ไม่สามารถอัปเดตสถานะเอกสารได้ กรุณาลองใหม่',
              variant: 'destructive'
            });
            return;
          }
          
          console.log('✅ Document status updated successfully, new PDF path:', newPublicUrl);
          
          // --- ลบไฟล์เก่า (หลังจาก database update สำเร็จแล้ว) ---
          const { error: removeError } = await supabase.storage
            .from('documents')
            .remove([oldFilePath]);
          if (removeError) {
            console.warn('⚠️ Failed to remove old PDF file:', removeError.message);
            // ไม่ต้อง return, แค่ log เพราะไฟล์ใหม่ถูกอัปโหลดและ database อัปเดตแล้ว
          } else {
            console.log('🗑️ Old PDF file removed successfully');
          }
          setShowLoadingModal(false);
          toast({ title: 'สำเร็จ', description: 'ส่งเสนอต่อผู้ลงนามลำดับถัดไปแล้ว' });
          navigate('/documents');
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
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 rounded-lg">
                        <p className="text-sm text-foreground leading-relaxed">{summaryText}</p>
                      </div>
                    ) : (
                      <div className="mt-2 p-3 bg-muted border border-border rounded-lg">
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