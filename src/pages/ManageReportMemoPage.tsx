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
  ClipboardCheck,
  Building2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAllMemos } from '@/hooks/useAllMemos';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AnimatedProgress } from '@/components/ui/progress';
import { extractPdfUrl } from '@/utils/fileUpload';
import { railwayPDFQueue } from '@/utils/requestQueue';
import { railwayFetch } from '@/utils/railwayFetch';
import { mergeMemoWithAttachments } from '@/services/memoManageAPIcall';
import PDFViewer from '@/components/OfficialDocuments/PDFViewer';
import Accordion from '@/components/OfficialDocuments/Accordion';
import { RejectionCard } from '@/components/OfficialDocuments/RejectionCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Step3SignaturePositions from '@/components/DocumentManage/Step3SignaturePositions';
import Step4Review from '@/components/DocumentManage/Step4Review';
import { DEPARTMENT_OPTIONS } from '@/components/DocumentManage/Step1DocumentNumber';

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

  const [selectedGroup, setSelectedGroup] = useState<string>('');

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
        // โหลดฝ่ายที่เลือกตอนลงเลขจาก DB
        if ((memo as any).stamp_department) {
          setSelectedGroup((memo as any).stamp_department);
        }

        // 2. Find task_assignment with this report_memo_id (use RPC to bypass RLS)
        const { data: assignments, error: assignmentError } = await (supabase as any)
          .rpc('get_task_assignment_by_report_memo', { p_report_memo_id: memoId });

        if (assignmentError || !assignments || assignments.length === 0) {
          console.error('Error fetching task assignment:', assignmentError);
          throw new Error('ไม่พบข้อมูลการมอบหมายงาน');
        }

        // RPC returns array, get first item
        const assignment = assignments[0];
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
            .from('doc_receive')
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

          // Replace order 1 (ผู้เขียน) with reporter's info
          if (memo.user_id) {
            const { data: reporterProfile } = await supabase
              .from('profiles')
              .select('user_id, first_name, last_name, prefix, position, job_position, academic_rank, org_structure_role, signature_url')
              .eq('user_id', memo.user_id)
              .single();

            if (reporterProfile) {
              const firstSignerIndex = uniqueSigners.findIndex(s => s.order === 1);
              if (firstSignerIndex !== -1) {
                uniqueSigners[firstSignerIndex] = {
                  ...uniqueSigners[firstSignerIndex],
                  user_id: reporterProfile.user_id,
                  name: `${reporterProfile.prefix || ''}${reporterProfile.first_name} ${reporterProfile.last_name}`.trim(),
                  position: reporterProfile.job_position || reporterProfile.position || uniqueSigners[firstSignerIndex].position,
                  job_position: reporterProfile.job_position,
                  academic_rank: reporterProfile.academic_rank,
                  org_structure_role: reporterProfile.org_structure_role,
                  prefix: reporterProfile.prefix,
                  signature_url: reporterProfile.signature_url
                };
              }
            }
          }

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

  // Get latest doc number for suggestion (ดูจาก memos + manual entries)
  const getLatestDocNumber = async () => {
    try {
      let maxNumber = 0;

      // 1. ดึงจาก memos ที่ลงเลขแล้ว
      const { data, error } = await supabase
        .from('memos')
        .select('doc_number, doc_number_status')
        .not('doc_number_status', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        for (const item of data) {
          const docData = item as any;
          if (docData.doc_number) {
            let docToProcess = docData.doc_number;
            if (docToProcess.includes('ศธ')) {
              const m = docToProcess.match(/ศธ\s*๐๔๐๐๗\.๖๐๐\/(.+)$/);
              if (m) docToProcess = m[1];
            }
            const m = docToProcess.match(/(\d+)\//);
            if (m) {
              const num = parseInt(m[1]);
              if (num > maxNumber) maxNumber = num;
            }
          }
        }
      }

      // 2. ดึงจาก manual entries (internal) เพื่อเลข running number ต่อเนื่อง
      const { data: manualData } = await supabase
        .from('document_register_manual')
        .select('register_number')
        .eq('register_type', 'internal')
        .eq('year', currentBuddhistYear)
        .order('register_number', { ascending: false })
        .limit(1);

      if (manualData && manualData.length > 0 && manualData[0].register_number > maxNumber) {
        maxNumber = manualData[0].register_number;
      }

      if (maxNumber > 0) {
        const nextNumber = maxNumber + 1;
        const paddedNumber = nextNumber.toString().padStart(4, '0');
        setSuggestedDocNumber(`${paddedNumber}/${yearShort}`);
      }
    } catch (error) {
      console.error('Error getting latest doc number:', error);
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
    if (!reportMemo || !profile?.user_id) return null;

    try {
      console.log('📄 Regenerating PDF with document suffix:', docSuffix);

      // Prepare form data for API call
      const formData = {
        doc_number: docSuffix, // ส่งแค่ส่วน 4568/68 เพราะใน template มี ศธ ๐๔๐๐๗.๖๐๐/ อยู่แล้ว
        date: formatThaiDate(reportMemo.date || new Date().toISOString().split('T')[0]),
        subject: reportMemo.subject || '',
        attachment_title: reportMemo.attachment_title || '',
        introduction: reportMemo.introduction || '',
        author_name: reportMemo.author_name || '',
        author_position: reportMemo.author_position || '',
        fact: reportMemo.fact || '',
        proposal: reportMemo.proposal || '',
        attached_files: reportMemo.attached_files || []
      };

      // Call Railway PDF API with queue + retry logic
      const pdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const response = await railwayFetch('/pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/pdf',
            },
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

      // Ensure valid auth session before upload
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        // No session - try to refresh
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          throw new Error('กรุณาเข้าสู่ระบบใหม่ (Session หมดอายุ)');
        }
      }

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

  // Handle assign document number
  const stampPdfWithDocNumber = async (docSuffix: string, groupName: string, pdfUrlOverride?: string) => {
    if (!reportMemo || !profile?.user_id) return null;
    try {
      const pdfUrl = pdfUrlOverride || extractPdfUrl(reportMemo.pdf_draft_path);
      if (!pdfUrl) throw new Error('ไม่พบไฟล์ PDF ของเอกสาร');

      const pdfRes = await fetch(pdfUrl);
      if (!pdfRes.ok) throw new Error('ไม่สามารถดาวน์โหลด PDF ต้นฉบับ');
      const pdfBlob = await pdfRes.blob();

      const now = new Date();
      const thaiDate = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

      const formData = new FormData();
      formData.append('pdf', pdfBlob, 'document.pdf');
      formData.append('payload', JSON.stringify({
        page: 0,
        color: [2, 53, 139],
        group_name: groupName,
        register_no: docSuffix,
        date: thaiDate
      }));

      const stampedBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const res = await railwayFetch('/receive_num2', {
            method: 'POST',
            body: formData
          });
          if (!res.ok) throw new Error(`Stamp API Error: ${res.status} - ${await res.text()}`);
          const blob = await res.blob();
          if (blob.size === 0) throw new Error('Received empty stamped PDF');
          return blob;
        },
        'Report Memo Stamp',
        3,
        1000
      );

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw new Error('กรุณาเข้าสู่ระบบใหม่ (Session หมดอายุ)');
      }

      const fileName = `memo_stamped_${Date.now()}_${docSuffix.replace(/[^\w]/g, '_')}.pdf`;
      const filePath = `memos/${profile.user_id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, stampedBlob, { contentType: 'application/pdf', upsert: true });
      if (uploadError) throw new Error(`Failed to upload: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);
      return `${publicUrl}?t=${Date.now()}`;
    } catch (error) {
      console.error('Error stamping PDF:', error);
      throw error;
    }
  };

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
        title: 'กรุณากรอกเลขหนังสือ',
        variant: 'destructive'
      });
      return;
    }

    if (!/^\d+\/\d{2}$/.test(finalDocSuffix)) {
      toast({
        title: 'รูปแบบเลขหนังสือไม่ถูกต้อง',
        description: 'กรุณากรอกในรูปแบบ เลขที่/ปี เช่น 0240/69',
        variant: 'destructive'
      });
      return;
    }

    if (!memoId) return;

    // ตรวจสอบเลขซ้ำ
    const { data: existingMemos } = await supabase
      .from('memos')
      .select('id, doc_number')
      .eq('doc_number', finalDocSuffix)
      .neq('id', memoId)
      .is('doc_del', null)
      .limit(1);

    if (existingMemos && existingMemos.length > 0) {
      toast({
        title: 'เลขหนังสือซ้ำ',
        description: `เลขหนังสือ ${finalDocSuffix} ถูกใช้แล้ว กรุณาใช้เลขอื่น`,
        variant: 'destructive'
      });
      return;
    }

    const fullDocNumber = `ศธ ๐๔๐๐๗.๖๐๐/${finalDocSuffix}`;
    setDocNumberSuffix(finalDocSuffix); // อัปเดตให้แสดงในช่องกรอก

    setIsAssigningNumber(true);
    try {
      const now = new Date().toISOString();
      const docNumberStatus = {
        status: 'ลงเลขหนังสือแล้ว',
        assigned_at: now,
        clerk_id: profile?.user_id || null
      };

      // Detect if uploaded or form-based
      const formDataType = (reportMemo?.form_data as any)?.type;
      const isUploadedMemo = formDataType === 'upload_report_memo';

      // ใช้ stamp API ปั๊มตราเลขหนังสือมุมขวาบนทุกกรณี (ไม่ต้อง regenerate PDF ใหม่)
      console.log('📌 Stamping doc number on existing PDF');
      const newPdfUrl = await stampPdfWithDocNumber(finalDocSuffix, selectedGroup);

      // Update memo with document number, status, clerk_id, department, and new PDF URL
      const updateData: any = {
        doc_number: finalDocSuffix, // บันทึกแค่ส่วน suffix เช่น 4571/68
        doc_number_status: docNumberStatus,
        clerk_id: profile?.user_id,
        stamp_department: selectedGroup, // บันทึกฝ่ายที่เลือกสำหรับตราปั๊ม
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

      if (error) throw error;

      // Refetch เพื่ออัปเดต memo state ให้เป็นค่าล่าสุดจาก database
      await refetch();

      setIsNumberAssigned(true);
      setReportMemo((prev: any) => ({
        ...prev,
        doc_number: finalDocSuffix,
        doc_number_status: docNumberStatus,
        pdf_draft_path: newPdfUrl || prev.pdf_draft_path
      }));

      toast({
        title: 'ลงเลขหนังสือสำเร็จ',
        description: `เลขหนังสือ ${fullDocNumber} ถูกบันทึกและสร้าง PDF ใหม่แล้ว`
      });
    } catch (error: any) {
      console.error('Error assigning number:', error);
      const errorMsg = error.message || 'ไม่สามารถลงเลขหนังสือได้';

      // If session is missing, redirect to login
      if (errorMsg.includes('Session หมดอายุ') || errorMsg.includes('Auth session missing')) {
        toast({
          title: 'Session หมดอายุ',
          description: 'กรุณาเข้าสู่ระบบใหม่',
          variant: 'destructive'
        });
        setTimeout(() => navigate('/login'), 1500);
        return;
      }

      toast({
        title: 'เกิดข้อผิดพลาด',
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setIsAssigningNumber(false);
    }
  };

  // Handle reject report - รับ reason จาก RejectionCard component
  const handleRejectFromCard = async (reason: string, annotatedPdfUrl?: string, annotatedAttachments?: string[]) => {
    // Debug: ตรวจสอบค่าที่จำเป็น
    console.log('🔴 handleRejectFromCard called:', { reason: reason?.trim(), memoId, taskAssignment: !!taskAssignment, profile: !!profile });

    if (!reason.trim()) {
      toast({ title: 'กรุณาระบุเหตุผล', description: 'กรุณาระบุเหตุผลการตีกลับ', variant: 'destructive' });
      return;
    }
    if (!memoId) {
      toast({ title: 'ไม่พบรหัสเอกสาร', description: 'กรุณาลองใหม่อีกครั้ง', variant: 'destructive' });
      return;
    }
    if (!taskAssignment) {
      toast({ title: 'ไม่พบข้อมูลการมอบหมายงาน', description: 'กรุณา refresh หน้าและลองใหม่', variant: 'destructive' });
      return;
    }
    if (!profile) {
      toast({ title: 'ไม่พบข้อมูลผู้ใช้', description: 'กรุณาเข้าสู่ระบบใหม่', variant: 'destructive' });
      return;
    }

    setIsRejecting(true);
    try {
      // Cleanup old annotated files before saving new ones
      const { cleanupAnnotatedFiles } = await import('@/utils/pdfAnnotationUtils');
      await cleanupAnnotatedFiles(memoId);

      // สร้าง rejected_name_comment สำหรับแสดงในรายการและหน้าแก้ไข
      const rejectedNameComment = {
        name: `${profile.first_name} ${profile.last_name}`,
        comment: reason.trim(),
        rejected_at: new Date().toISOString(),
        position: profile.current_position || profile.job_position || profile.position || ''
      };

      // 1. Update report memo status to rejected
      const updateData: any = {
        status: 'rejected',
        current_signer_order: 0,
        rejected_name_comment: rejectedNameComment,
        updated_at: new Date().toISOString()
      };
      if (annotatedPdfUrl) {
        updateData.annotated_pdf_path = annotatedPdfUrl;
      }
      if (annotatedAttachments && annotatedAttachments.length > 0) {
        updateData.annotated_attachment_paths = JSON.stringify(annotatedAttachments);
      }

      const { error: memoError } = await (supabase as any)
        .from('memos')
        .update(updateData)
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
    if (selectedSignerIndex >= signers.length) {
      toast({
        title: 'ไม่มีผู้ลงนามให้เลือก',
        description: 'กรุณาเลือกผู้ลงนามก่อน',
        variant: 'destructive'
      });
      return;
    }

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

    toast({
      title: 'วางตำแหน่งลายเซ็นสำเร็จ',
      description: `วางลายเซ็น ${signer.name} ตำแหน่งที่ ${existingPositionsCount + 1} ที่หน้า ${page + 1}`
    });
  };

  // Handle position remove
  const handlePositionRemove = (index: number) => {
    const removedPosition = signaturePositions[index];
    setSignaturePositions(prev => prev.filter((_, i) => i !== index));

    // Set selected signer back to the removed one
    const removedSignerIndex = signers.findIndex(s => s.order === removedPosition.signer.order);
    if (removedSignerIndex !== -1) {
      setSelectedSignerIndex(removedSignerIndex);
    }
  };

  // Handle step navigation with PDF merge and signer_list_progress
  const handleNext = async () => {
    // If moving from step 1 to step 2, call PDFmerge API if there are attachments
    if (currentStep === 1 && reportMemo) {
      // สำหรับ memo ที่ถูกตีกลับ → re-stamp PDF ใหม่ด้วยเลขหนังสือเดิมและฝ่ายเดิม
      // ดึง revision_count จาก DB โดยตรง เพราะ memo cache อาจยังไม่อัปเดต
      let currentPdfPath = reportMemo.pdf_draft_path; // track PDF ล่าสุด
      let revisionCount = (reportMemo as any).revision_count || 0;
      let freshStampDepartment = '';
      if (isNumberAssigned && docNumberSuffix) {
        const { data: freshMemo } = await supabase
          .from('memos')
          .select('revision_count, stamp_department, pdf_draft_path')
          .eq('id', reportMemo.id)
          .single();
        if (freshMemo) {
          revisionCount = (freshMemo as any).revision_count || 0;
          freshStampDepartment = (freshMemo as any).stamp_department || '';
          currentPdfPath = (freshMemo as any).pdf_draft_path || currentPdfPath;
        }
      }

      // ข้ามการปั้มตราถ้า PDF มีตราปั้มอยู่แล้ว
      const alreadyStamped = currentPdfPath?.includes('memo_stamped_');
      if (alreadyStamped) {
        console.log('ℹ️ PDF already stamped, skipping re-stamp');
      }

      if (isNumberAssigned && revisionCount > 0 && docNumberSuffix && !alreadyStamped) {
        setLoadingMessage({
          title: 'กำลังปั๊มตราเลขหนังสือใหม่',
          description: 'ระบบกำลังลงตราเลขหนังสือบน PDF ที่ส่งมาใหม่...'
        });
        setShowLoadingModal(true);

        try {
          const groupForStamp = selectedGroup || freshStampDepartment || (reportMemo as any).stamp_department || '';
          const stampedUrl = await stampPdfWithDocNumber(docNumberSuffix, groupForStamp);
          if (stampedUrl) {
            await supabase
              .from('memos')
              .update({ pdf_draft_path: stampedUrl, updated_at: new Date().toISOString() })
              .eq('id', reportMemo.id);
            setReportMemo((prev: any) => ({ ...prev, pdf_draft_path: stampedUrl }));
            currentPdfPath = stampedUrl; // อัปเดต path เพื่อให้ merge ใช้ PDF ที่ปั้มตราแล้ว
            await refetch();
            console.log('✅ Re-stamped report memo PDF saved:', stampedUrl);
          }
        } catch (error) {
          console.error('Error re-stamping report memo:', error);
          toast({
            title: 'เกิดข้อผิดพลาด',
            description: 'ไม่สามารถปั๊มตราเลขหนังสือใหม่ได้',
            variant: 'destructive'
          });
          setShowLoadingModal(false);
          return;
        } finally {
          setShowLoadingModal(false);
        }
      }

      const attachedFiles = getAttachedFiles(reportMemo);

      if (attachedFiles.length > 0) {
        setLoadingMessage({
          title: 'กำลังประมวลผลไฟล์เอกสาร',
          description: 'ระบบกำลังรวมไฟล์เอกสารหลักกับไฟล์แนบ กรุณารอสักครู่...'
        });
        setShowLoadingModal(true);

        try {
          console.log('🔄 Starting PDF merge with attached files:', attachedFiles);

          const mergeResult = await mergeMemoWithAttachments({
            memoId: reportMemo.id,
            mainPdfPath: currentPdfPath,
            attachedFiles: attachedFiles
          });

          if (mergeResult.success && mergeResult.mergedPdfUrl) {
            // Update the memo in database to remove attached files and update PDF path
            const { error: updateError } = await supabase
              .from('memos')
              .update({
                pdf_draft_path: mergeResult.mergedPdfUrl,
                attached_files: null,
                attachment_title: null
              })
              .eq('id', reportMemo.id);

            if (updateError) {
              console.error('Error updating memo after merge:', updateError);
              toast({
                title: 'เกิดข้อผิดพลาด',
                description: 'ไม่สามารถอัพเดตข้อมูลหลังจากรวมไฟล์ได้',
                variant: 'destructive'
              });
              setShowLoadingModal(false);
              return;
            }

            toast({
              title: 'รวมไฟล์สำเร็จ',
              description: 'รวมไฟล์เอกสารหลักกับไฟล์แนบเรียบร้อยแล้ว'
            });

            // Update local state
            setReportMemo((prev: any) => ({
              ...prev,
              pdf_draft_path: mergeResult.mergedPdfUrl,
              attached_files: null,
              attachment_title: null
            }));

            await refetch();
          } else {
            toast({
              title: 'เกิดข้อผิดพลาดในการรวมไฟล์',
              description: mergeResult.error || 'ไม่สามารถรวมไฟล์ได้',
              variant: 'destructive'
            });
            setShowLoadingModal(false);
            return;
          }
        } catch (error) {
          console.error('Error calling PDFmerge:', error);
          toast({
            title: 'เกิดข้อผิดพลาด',
            description: 'ไม่สามารถเรียกใช้งาน API รวมไฟล์ได้',
            variant: 'destructive'
          });
          setShowLoadingModal(false);
          return;
        } finally {
          setShowLoadingModal(false);
        }
      }
    }

    // If moving from step 2 to step 3, save signer_list_progress
    if (currentStep === 2 && memoId) {
      try {
        const signerListProgress = signers.map(signer => ({
          order: signer.order,
          position: signer.position || signer.role,
          name: signer.name,
          role: signer.role,
          user_id: signer.user_id,
          org_structure_role: signer.org_structure_role
        }));

        console.log('📊 Saving signer_list_progress:', signerListProgress);

        const { error: updateError } = await supabase
          .from('memos')
          .update({
            signer_list_progress: signerListProgress
          } as any)
          .eq('id', memoId);

        if (updateError) {
          console.error('Error updating signer_list_progress:', updateError);
          toast({
            title: 'เกิดข้อผิดพลาด',
            description: 'ไม่สามารถบันทึกข้อมูลผู้ลงนามได้',
            variant: 'destructive'
          });
          return;
        }

        console.log('✅ Signer list progress saved successfully');
        toast({
          title: 'บันทึกข้อมูลผู้ลงนามสำเร็จ',
          description: `บันทึกรายชื่อผู้ลงนาม ${signers.length} คน เรียบร้อยแล้ว`
        });
      } catch (error) {
        console.error('Error saving signer_list_progress:', error);
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถบันทึกข้อมูลผู้ลงนามได้',
          variant: 'destructive'
        });
        return;
      }
    }

    // Proceed to next step
    if (currentStep < 3) setCurrentStep(currentStep + 1);
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

      // 2. Update signature_positions with prefix in name
      const updatedSignaturePositions = signaturePositions.map(pos => {
        const signer = signers.find(s => s.user_id === pos.signer.user_id);
        if (signer && signer.prefix) {
          const nameWithoutPrefix = pos.signer.name.replace(new RegExp(`^${signer.prefix}`), '').trim();
          const nameWithPrefix = `${signer.prefix}${nameWithoutPrefix}`;

          return {
            ...pos,
            signer: {
              ...pos.signer,
              name: nameWithPrefix,
              order: signers.findIndex(s => s.user_id === pos.signer.user_id) + 1
            }
          };
        }
        return {
          ...pos,
          signer: {
            ...pos.signer,
            order: signers.findIndex(s => s.user_id === pos.signer.user_id) + 1
          }
        };
      });

      // 3. Get first signer order
      const firstOrder = Math.min(...updatedSignaturePositions.map(p => p.signer.order));

      // 4. Update signers via updateMemoSigners
      await updateMemoSigners(memoId, signers, updatedSignaturePositions);

      // 5. Update report memo with signature positions and pending_sign status (including clerk_id)
      const clerkId = profile?.user_id;
      console.log('📝 Recording clerk_id:', clerkId, 'for memo:', memoId);

      const { error: updateError } = await supabase
        .from('memos')
        .update({
          signature_positions: updatedSignaturePositions,
          status: 'pending_sign',
          current_signer_order: firstOrder + 1,
          clerk_id: clerkId,
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
            // Fetch PDF and signature in parallel
            const [pdfRes, sigRes] = await Promise.all([
              fetch(extractedPdfUrl),
              fetch(firstSigner.signature_url)
            ]);
            if (!pdfRes.ok) throw new Error('ไม่สามารถดาวน์โหลด PDF ได้');
            if (!sigRes.ok) throw new Error('ไม่สามารถดาวน์โหลดลายเซ็นได้');
            const [pdfBlob, sigBlob] = await Promise.all([
              pdfRes.blob(),
              sigRes.blob()
            ]);

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

            // จุดแรก: แสดงครบ (ลายเซ็น, ชื่อ, ตำแหน่ง) / จุดที่ 2+: แค่รูปลายเซ็น PNG
            const linesImageOnly = [{ type: "image", file_key: "sig1" }];
            const signaturesPayload = signerPositions.map((pos, index) => ({
              page: pos.page - 1,
              x: Math.round(pos.x),
              y: Math.round(pos.y),
              rotation: (pos as any).rotation || 0,
              width: 120,
              height: 60,
              lines: index === 0 ? lines : linesImageOnly
            }));
            formData.append('signatures', JSON.stringify(signaturesPayload));

            // Call signature API
            const signedPdfBlob = await railwayPDFQueue.enqueueWithRetry(
              async () => {
                const res = await railwayFetch('/add_signature_v2', {
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
                      pdf_draft_path: urlData.publicUrl
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

                {/* Department/Group Selection */}
                <div>
                  <Label className="flex items-center gap-2 mb-1">
                    <Building2 className="h-4 w-4" />
                    เลือกฝ่าย (สำหรับตราปั๊ม)
                  </Label>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup} disabled={isNumberAssigned}>
                    <SelectTrigger className={isNumberAssigned ? 'bg-muted cursor-not-allowed' : ''}>
                      <SelectValue placeholder="เลือกฝ่าย..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border z-50 shadow-lg">
                      {DEPARTMENT_OPTIONS.map((dept) => (
                        <SelectItem key={dept} value={dept} className="cursor-pointer">
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap justify-between gap-2">
                  <div /> {/* Empty div for spacing */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleAssignNumber}
                      disabled={(!docNumberSuffix.trim() && !suggestedDocNumber) || !selectedGroup || isNumberAssigned || isAssigningNumber}
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
                      onClick={handleNext}
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
              pdfUrl={reportMemo?.pdf_draft_path ? (extractPdfUrl(reportMemo.pdf_draft_path) || undefined) : undefined}
              attachedFiles={getAttachedFiles(reportMemo)}
              documentId={memoId}
              userId={profile?.user_id}
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
            onNext={handleNext}
            isStepComplete={isStepComplete(2)}
          />
        )}

        {/* Step 3: ยืนยัน - ใช้ Step4Review component */}
        {currentStep === 3 && (
          <Step4Review
            memo={reportMemo}
            documentNumber={reportMemo?.doc_number ? `ศธ ๐๔๐๐๗.๖๐๐/${reportMemo.doc_number}` : '-'}
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
