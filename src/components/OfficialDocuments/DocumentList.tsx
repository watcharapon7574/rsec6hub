import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, Edit, Calendar, User, AlertCircle, Clock, CheckCircle, XCircle, FileText, Settings, Building, Paperclip, Search, Filter, ChevronLeft, ChevronRight, RotateCcw, Trash2, FileInput, ClipboardList } from 'lucide-react';
import ClerkDocumentActions from './ClerkDocumentActions';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { useSmartRealtime } from '@/hooks/useSmartRealtime';
import { supabase } from '@/integrations/supabase/client';
import { extractPdfUrl } from '@/utils/fileUpload';
import { getDocumentManageRoute, getDocumentEditRoute, isPDFUploadMemo } from '@/utils/memoUtils';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Accordion from './Accordion';
import { MemoService } from '@/services/memoService';

// ประเภทเอกสารจาก mock data
interface Document {
  id: number;
  title: string;
  description: string;
  requester: string;
  department: string;
  status: string;
  created_at: string;
  document_number: string | null;
  urgency: string;
}

interface DocumentListProps {
  documents: Document[];
  realMemos?: any[];
  docReceiveList?: any[];
  onReject?: (documentId: string, reason: string) => void;
  onAssignNumber?: (documentId: string, number: string) => void;
  onSetSigners?: (documentId: string, signers: any[]) => void;
  onRefresh?: () => void;
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  realMemos = [],
  docReceiveList = [],
  onReject,
  onAssignNumber,
  onSetSigners,
  onRefresh
}) => {
  const { getPermissions, profile } = useEmployeeAuth();
  const { profiles } = useProfiles();
  const permissions = getPermissions();
  const { updateSingleMemo } = useSmartRealtime();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State สำหรับ realtime updates
  const [localMemos, setLocalMemos] = useState(realMemos);
  const [localDocReceive, setLocalDocReceive] = useState(docReceiveList);

  // State สำหรับ delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  const [phoneVerification, setPhoneVerification] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // State สำหรับ modal ดูรายชื่อผู้รับมอบหมาย
  const [showAssigneesModal, setShowAssigneesModal] = useState(false);
  const [selectedMemoForAssignees, setSelectedMemoForAssignees] = useState<any>(null);
  const [assigneesList, setAssigneesList] = useState<any[]>([]);
  const [assigneesPage, setAssigneesPage] = useState(1);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const assigneesPerPage = 5;

  // อัพเดท localMemos เมื่อ realMemos เปลี่ยน
  useEffect(() => {
    setLocalMemos(realMemos);
  }, [realMemos]);

  // อัพเดท localDocReceive เมื่อ docReceiveList เปลี่ยน
  useEffect(() => {
    setLocalDocReceive(docReceiveList);
  }, [docReceiveList]);

  // Setup realtime listeners สำหรับผู้ช่วยผอและรองผอ
  useEffect(() => {
    // เฉพาะผู้ช่วยผอและรองผอเท่านั้นที่ต้อง realtime updates
    if (!["assistant_director", "deputy_director"].includes(permissions.position)) {
      return;
    }

    const handleMemoUpdated = (event: CustomEvent) => {
      const { memo, action } = event.detail;
      console.log('📋 DocumentList: Memo updated', { memo, action, position: permissions.position });
      
      if (action === 'INSERT' || action === 'UPDATE') {
        setLocalMemos(prevMemos => {
          const existingIndex = prevMemos.findIndex(m => m.id === memo.id);
          if (existingIndex >= 0) {
            // อัพเดท memo ที่มีอยู่
            const updated = [...prevMemos];
            updated[existingIndex] = memo;
            return updated;
          } else {
            // เพิ่ม memo ใหม่
            return [memo, ...prevMemos];
          }
        });
      }
    };

    const handleMemoDeleted = (event: CustomEvent) => {
      const { memoId } = event.detail;
      console.log('🗑️ DocumentList: Memo deleted', { memoId, position: permissions.position });
      
      setLocalMemos(prevMemos => 
        prevMemos.filter(memo => memo.id !== memoId)
      );
    };

    // เพิ่ม event listeners
    window.addEventListener('memo-updated', handleMemoUpdated as EventListener);
    window.addEventListener('memo-deleted', handleMemoDeleted as EventListener);

    // Setup Supabase realtime subscription สำหรับเอกสารที่ไม่ใช่ของตนเอง
    const subscription = supabase
      .channel('document-list-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memos',
          filter: profile?.user_id ? `user_id=neq.${profile.user_id}` : undefined, // เอกสารที่ไม่ใช่ของตนเอง
        },
        async (payload) => {
          console.log('🔵 DocumentList: Realtime memo change:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            await updateSingleMemo(payload.new.id, payload);
          } else if (payload.eventType === 'DELETE') {
            await updateSingleMemo(payload.old.id, payload);
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      window.removeEventListener('memo-updated', handleMemoUpdated as EventListener);
      window.removeEventListener('memo-deleted', handleMemoDeleted as EventListener);
      subscription.unsubscribe();
    };
  }, [permissions.position, profile?.user_id, updateSingleMemo]);

  // ฟังก์ชันสำหรับหาชื่อธุรการจาก clerk_id
  const getClerkName = (clerkId?: string): string => {
    if (!clerkId) return '-';
    const clerkProfile = profiles.find(p => p.user_id === clerkId);
    if (!clerkProfile) return '-';
    return `${clerkProfile.first_name} ${clerkProfile.last_name}`;
  };

  // ฟังก์ชันสำหรับลบเอกสาร
  const handleDeleteClick = (memo: any) => {
    setDocumentToDelete(memo);
    setPhoneVerification('');
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete || !profile?.phone || !profile?.user_id) {
      toast({
        title: "ข้อผิดพลาด",
        description: "ไม่สามารถลบเอกสารได้",
        variant: "destructive",
      });
      return;
    }

    // Get last 4 digits of user's phone
    const last4Digits = profile.phone.slice(-4);

    if (phoneVerification !== last4Digits) {
      toast({
        title: "เบอร์โทรศัพท์ไม่ถูกต้อง",
        description: `กรุณากรอก 4 ตัวท้ายของเบอร์โทรศัพท์ที่ลงทะเบียนไว้`,
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Check if this is from doc_receive table (marked with __source_table)
      const isDocReceive = documentToDelete?.__source_table === 'doc_receive';

      // Soft delete using appropriate service method
      const userName = `${profile.first_name} ${profile.last_name}`;
      const { success, error: deleteError } = isDocReceive
        ? await MemoService.softDeleteDocReceive(documentToDelete.id, profile.user_id, userName)
        : await MemoService.softDeleteMemo(documentToDelete.id, profile.user_id, userName);

      if (!success || deleteError) {
        throw new Error(`Failed to delete document: ${deleteError}`);
      }

      // Close modal first
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
      setPhoneVerification('');

      // Refresh data to remove soft-deleted document
      if (onRefresh) {
        await onRefresh();
      }

      // Show success toast after refresh
      toast({
        title: "ลบเอกสารสำเร็จ",
        description: `ลบเอกสาร "${documentToDelete.subject || documentToDelete.form_data?.to || 'ไม่ระบุ'}" เรียบร้อยแล้ว`,
      });
    } catch (error) {
      console.error('Error deleting memo:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถลบเอกสารได้",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ฟังก์ชันสำหรับดูรายชื่อผู้รับมอบหมาย
  const handleViewAssignees = async (memo: any) => {
    setSelectedMemoForAssignees(memo);
    setAssigneesPage(1);
    setIsLoadingAssignees(true);
    setShowAssigneesModal(true);

    try {
      const documentType = memo.__source_table === 'doc_receive' ? 'doc_receive' : 'memo';
      const idColumn = documentType === 'doc_receive' ? 'doc_receive_id' : 'memo_id';

      // Step 1: Fetch task assignments
      const { data: assignments, error: assignmentError } = await (supabase as any)
        .from('task_assignments')
        .select(`
          id,
          assigned_to,
          note,
          status,
          completion_note,
          assigned_at,
          completed_at
        `)
        .eq(idColumn, memo.id)
        .eq('document_type', documentType)
        .is('deleted_at', null)
        .order('assigned_at', { ascending: false });

      if (assignmentError) {
        console.error('Error fetching assignees:', assignmentError);
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถดึงรายชื่อผู้รับมอบหมายได้",
          variant: "destructive",
        });
        return;
      }

      if (!assignments || assignments.length === 0) {
        setAssigneesList([]);
        return;
      }

      // Step 2: Get unique user IDs and fetch their profiles
      const userIds = Array.from(new Set(assignments.map((a: any) => String(a.assigned_to)))).filter(Boolean) as string[];
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds as string[]);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      }

      // Create a map of user_id to full_name (combined first_name + last_name)
      const profileMap = new Map();
      (profiles || []).forEach((p: any) => {
        const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ');
        profileMap.set(p.user_id, fullName || 'ไม่ทราบชื่อ');
      });

      // Transform data to include assignee_name from profiles
      const transformedData = assignments.map((item: any) => ({
        ...item,
        assignee_name: profileMap.get(item.assigned_to) || 'ไม่ทราบชื่อ'
      }));

      setAssigneesList(transformedData);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoadingAssignees(false);
    }
  };

  // ฟังก์ชันสำหรับจัดการสีตามสถานะ (แปลสีตาม UI)
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'draft': return 'text-blue-600'; // ฟ้า
      case 'pending_sign': return 'text-orange-500'; // ส้ม
      case 'approved': return 'text-green-600'; // เขียว
      case 'rejected': return 'text-red-500'; // แดง
      default: return 'text-muted-foreground';
    }
  };

  // ฟังก์ชันสำหรับข้อความสถานะตาม current_signer_order
  const getStatusTextBySignerOrder = (signerOrder: number): string => {
    switch (signerOrder) {
      case 1: return 'ฉบับร่าง';
      case 2:
      case 3:
      case 4: return 'รอลงนาม';
      case 5: return 'เสร็จสิ้น';
      case 0: return 'ตีกลับ';
      default: return 'ไม่ระบุ';
    }
  };

  // ฟังก์ชันสำหรับสีสถานะตาม current_signer_order
  const getStatusColorBySignerOrder = (signerOrder: number): string => {
    switch (signerOrder) {
      case 1: return 'text-blue-600'; // ฉบับร่าง - น้ำเงิน
      case 2:
      case 3:
      case 4: return 'text-orange-500'; // รอลงนาม - ส้ม
      case 5: return 'text-green-600'; // เสร็จสิ้น - เขียว
      case 0: return 'text-red-500'; // ตีกลับ - แดง
      default: return 'text-muted-foreground';
    }
  };

  // ฟังก์ชันสำหรับไอคอนสถานะตาม current_signer_order
  const getStatusIconBySignerOrder = (signerOrder: number): JSX.Element => {
    switch (signerOrder) {
      case 1: return <FileText className="h-4 w-4" />; // ฉบับร่าง
      case 2:
      case 3:
      case 4: return <Clock className="h-4 w-4" />; // รอลงนาม
      case 5: return <CheckCircle className="h-4 w-4" />; // เสร็จสิ้น
      case 0: return <XCircle className="h-4 w-4" />; // ตีกลับ
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  // ฟังก์ชันสำหรับข้อความสถานะ (แปลไทย)
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'draft': return 'ฉบับร่าง';
      case 'pending_sign': return 'รอลงนาม';
      case 'approved': return 'เกษียนแล้ว';
      case 'rejected': return 'ตีกลับ';
      default: return status;
    }
  };

  // ฟังก์ชันสำหรับไอคอนสถานะ
  const getStatusIcon = (status: string): JSX.Element => {
    switch (status.toLowerCase()) {
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'in_progress': return <AlertCircle className="h-4 w-4" />;
      case 'draft': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // ฟังก์ชันสำหรับสีความเร่งด่วน
  const getUrgencyColor = (urgency: string): string => {
    switch (urgency.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-foreground';
    }
  };

  // ฟังก์ชันสำหรับข้อความความเร่งด่วน
  const getUrgencyText = (urgency: string): string => {
    switch (urgency.toLowerCase()) {
      case 'high': return 'เร่งด่วน';
      case 'medium': return 'ปานกลาง';
      case 'low': return 'ไม่เร่งด่วน';
      default: return urgency;
    }
  };

  // กรองเอกสารสำหรับแสดงใน DocumentList
  // สำหรับ clerk_teacher: แสดงเอกสารทุกฉบับ (เพราะต้องจัดการเอกสารทั้งหมดของสถานศึกษา)
  // สำหรับ ผู้ช่วยผอ, รองผอ: ไม่แสดงเอกสารส่วนตัวใน DocumentList
  // เพราะจะแสดงใน PersonalDocumentList แยกต่างหาก
  const shouldShowMemo = (memo: any) => {
    // Admin เห็นเอกสารทุกฉบับ
    if (permissions.isAdmin) {
      return true;
    }

    // สำหรับ clerk_teacher: แสดงเอกสารทุกฉบับ (รวมทั้งเอกสารของตัวเอง)
    // เพราะ DocumentList คือตารางจัดการเอกสารทั้งหมดของสถานศึกษา
    if (permissions.isClerk) {
      return true;
    }

    // สำหรับผู้ช่วยผอและรองผอ: แสดงเฉพาะเอกสารที่มีชื่อตัวเองใน signer_list_progress
    // หรือถ้าเป็น PDF Upload ให้แสดงทุกคน
    if (["assistant_director", "deputy_director"].includes(permissions.position)) {
      // ถ้าเป็น PDF Upload ให้แสดงได้เสมอ
      if (isPDFUploadMemo(memo)) {
        return true;
      }

      // ตรวจสอบว่ามีชื่อตัวเองใน signer_list_progress หรือไม่
      if (memo.signer_list_progress && Array.isArray(memo.signer_list_progress)) {
        const hasUserInSignerList = memo.signer_list_progress.some((signer: any) =>
          signer.user_id === profile?.user_id
        );
        return hasUserInSignerList;
      }
      // ถ้าไม่มี signer_list_progress ให้ fallback ไปดู signature_positions
      if (memo.signature_positions && Array.isArray(memo.signature_positions)) {
        const hasUserInSignatures = memo.signature_positions.some((pos: any) =>
          pos.signer?.user_id === profile?.user_id
        );
        return hasUserInSignatures;
      }
      // ถ้าไม่พบใน signer list ก็ไม่แสดง
      return false;
    }

    // ผอ เห็นเอกสารทุกชนิด (เหมือนเดิม)
    if (permissions.position === "director") {
      return true;
    }
    // คนอื่นดูได้เฉพาะเอกสารของตนเอง
    return memo.user_id === profile?.user_id;
  };

  // ฟังก์ชันกรองและจัดเรียงข้อมูล
  const filteredAndSortedMemos = useMemo(() => {
    // กรองตาม shouldShowMemo ก่อน
    let filtered = localMemos.filter(memo => {
      // กรองเอกสารที่ถูก soft delete ออก
      if (memo.doc_del) {
        return false;
      }

      // ตรวจสอบสิทธิ์การแสดงผลก่อน
      if (!shouldShowMemo(memo)) {
        return false;
      }

      // ค้นหาตามชื่อเรื่อง, ผู้เขียน, หรือเลขที่เอกสาร
      const searchMatch = searchTerm === '' || 
        memo.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.creator_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.doc_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.form_data?.to?.toLowerCase().includes(searchTerm.toLowerCase());

      // กรองตาม current_signer_order
      let statusMatch = true;
      if (statusFilter !== 'all') {
        const signerOrder = memo.current_signer_order;
        switch (statusFilter) {
          case 'draft':
            // ฉบับร่าง: current_signer_order = 1
            statusMatch = signerOrder === 1;
            break;
          case 'pending_sign':
            // รอลงนาม: current_signer_order = 2, 3, หรือ 4
            statusMatch = signerOrder >= 2 && signerOrder <= 4;
            break;
          case 'completed':
            // เสร็จสิ้น: current_signer_order = 5
            statusMatch = signerOrder === 5;
            break;
          case 'rejected':
            // ตีกลับ: current_signer_order = 0
            statusMatch = signerOrder === 0;
            break;
          default:
            statusMatch = true;
        }
      }

      // กรองตามประเภทเอกสาร
      let typeMatch = true;
      if (typeFilter !== 'all') {
        if (typeFilter === 'memo') {
          typeMatch = memo.__source_table !== 'doc_receive';
        } else if (typeFilter === 'doc_receive') {
          typeMatch = memo.__source_table === 'doc_receive';
        }
      }

      // กรองตามการมอบหมาย (เฉพาะเอกสารที่เสร็จสิ้นแล้ว)
      let assignmentMatch = true;
      if (assignmentFilter !== 'all') {
        if (assignmentFilter === 'assigned') {
          assignmentMatch = memo.is_assigned === true;
        } else if (assignmentFilter === 'not_assigned') {
          assignmentMatch = memo.current_signer_order === 5 && !memo.is_assigned;
        }
      }

      return searchMatch && statusMatch && typeMatch && assignmentMatch;
    });

    // จัดเรียงข้อมูล
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'subject':
          aValue = a.subject || '';
          bValue = b.subject || '';
          break;
        case 'status':
          // เรียงตาม current_signer_order แทน status
          aValue = a.current_signer_order || 0;
          bValue = b.current_signer_order || 0;
          break;
        case 'doc_number':
          aValue = a.doc_number || '';
          bValue = b.doc_number || '';
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        case 'updated_at':
        default:
          aValue = new Date(a.updated_at || a.created_at || 0).getTime();
          bValue = new Date(b.updated_at || b.created_at || 0).getTime();
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return filtered;
  }, [localMemos, searchTerm, statusFilter, typeFilter, assignmentFilter, sortBy, sortOrder, profile?.user_id, permissions.position]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedMemos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedMemos.slice(startIndex, endIndex);

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, assignmentFilter, sortBy, sortOrder]);

  // แสดง Card รายการเอกสารสำหรับทุกตำแหน่ง
  // if (["deputy_director", "director"].includes(permissions.position)) {
  //   return null;
  // }

  return (
    <Card>
      <CardHeader className="bg-purple-600 py-3 px-4 rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <FileText className="h-4 w-4 text-purple-100" />
          {permissions.position === "clerk_teacher" ? 
            "เอกสารภายในสถานศึกษา" : 
            (["assistant_director", "deputy_director"].includes(permissions.position) ? 
              "เอกสารของผู้อื่น" : 
              "รายการเอกสาร")
          }
          <Badge variant="secondary" className="ml-auto bg-purple-700 text-white font-semibold px-2 py-1 rounded-full">
            {filteredAndSortedMemos.length > 0 ? `${filteredAndSortedMemos.length} รายการ` : 'ไม่มีเอกสาร'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={!onRefresh}
            className="ml-2 p-1 h-8 w-8 text-white/70 hover:text-white disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </CardTitle>
        {permissions.position === "clerk_teacher" && (
          <div className="text-sm text-purple-100 font-normal mt-1">
            จัดการเอกสารภายในสถานศึกษา ตรวจสอบความถูกต้อง กำหนดเลขที่ และจัดเส้นทางการอนุมัติ
          </div>
        )}
        {["assistant_director", "deputy_director"].includes(permissions.position) && (
          <div className="text-sm text-purple-100 font-normal mt-1">
            เอกสารที่สร้างโดยผู้อื่น (เอกสารของคุณแสดงในส่วนข้างบน)
          </div>
        )}
      </CardHeader>

      {/* ส่วนค้นหาและกรอง - แถวเดียวแนวนอน */}
      <div className="bg-card border-b border-border px-3 py-2">
        <div className="flex gap-2 items-center">
          {/* ช่องค้นหา */}
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเอกสาร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs h-8 border-gray-200 focus:border-purple-400 focus:ring-purple-400 focus:ring-1"
            />
          </div>

          {/* ตัวกรองตามสถานะ */}
          <div className="w-28">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-purple-400">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="draft">ฉบับร่าง</SelectItem>
                <SelectItem value="pending_sign">รอลงนาม</SelectItem>
                <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                <SelectItem value="rejected">ตีกลับ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ตัวกรองตามประเภท */}
          <div className="w-28">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-purple-400">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="memo">บันทึกข้อความ</SelectItem>
                <SelectItem value="doc_receive">หนังสือรับ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ตัวกรองตามการมอบหมาย */}
          <div className="w-32">
            <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-purple-400">
                <SelectValue placeholder="มอบหมาย" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="assigned">มอบหมายแล้ว</SelectItem>
                <SelectItem value="not_assigned">ยังไม่มอบหมาย</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* การจัดเรียง */}
          <div className="w-20">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-purple-400">
                <SelectValue placeholder="เรียง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">ล่าสุด</SelectItem>
                <SelectItem value="created_at">วันที่สร้าง</SelectItem>
                <SelectItem value="subject">ชื่อ</SelectItem>
                <SelectItem value="status">สถานะ</SelectItem>
                <SelectItem value="doc_number">เลขที่</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ปุ่มเปลี่ยนทิศทางการเรียง */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-8 w-8 p-0 border-gray-200 hover:border-purple-400 hover:text-purple-600"
            title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
          >
            <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          </Button>

          {/* ปุ่มล้างตัวกรอง */}
          {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || assignmentFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
                setAssignmentFilter('all');
              }}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-purple-600 hover:bg-purple-50"
              title="ล้างตัวกรอง"
            >
              <span className="text-sm">×</span>
            </Button>
          )}
        </div>

        {/* แสดงจำนวนผลลัพธ์ */}
        {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || assignmentFilter !== 'all') && (
          <div className="text-[10px] text-muted-foreground mt-1 text-center">
            แสดง {filteredAndSortedMemos.length} จาก {realMemos.filter(shouldShowMemo).length} รายการ
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {currentPageData.length > 0 ? (
            currentPageData.map((memo) => {
              // ตรวจสอบว่าเอกสารเสร็จสิ้นแล้วหรือไม่ (current_signer_order === 5)
              const isCompleted = memo.current_signer_order === 5;
              const baseClasses = "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border rounded-lg px-2 sm:px-3 py-2 shadow-sm transition group min-w-0";
              const completedClasses = isCompleted 
                ? "bg-gray-50 border-gray-200 hover:bg-gray-100" 
                : "bg-card border-border hover:bg-muted/50";
              
              return (
              <div key={memo.id} className={`${baseClasses} ${completedClasses}`}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {memo.__source_table === 'doc_receive' ? (
                    <FileInput className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-green-500'}`} />
                  ) : (
                    <FileText className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-purple-500'}`} />
                  )}
                  <span className={`font-medium truncate max-w-[120px] sm:max-w-[160px] sm:text-base text-sm ${isCompleted ? 'text-muted-foreground group-hover:text-foreground' : 'text-foreground group-hover:text-purple-700'}`} title={memo.subject}>{memo.subject}</span>
                  {(() => {
                    let attachedFileCount = 0;
                    if (memo.attached_files) {
                      try {
                        if (typeof memo.attached_files === 'string') {
                          const parsed = JSON.parse(memo.attached_files);
                          attachedFileCount = Array.isArray(parsed) ? parsed.length : 0;
                        } else if (Array.isArray(memo.attached_files)) {
                          attachedFileCount = memo.attached_files.length;
                        }
                      } catch {
                        attachedFileCount = 0;
                      }
                    }
                    
                    return attachedFileCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Paperclip className="h-3 w-3 text-purple-600" />
                      </div>
                    );
                  })()}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{(memo.author_name || '-').split(' ')[0]}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(memo.created_at).toLocaleDateString('th-TH')}</span>
                  <span
                    style={{
                      background: memo.current_signer_order === 1 ? '#2563eb' : // ฉบับร่าง - น้ำเงิน
                                  memo.current_signer_order >= 2 && memo.current_signer_order <= 4 ? '#f59e42' : // รอลงนาม - ส้ม  
                                  memo.current_signer_order === 5 ? '#16a34a' : // เสร็จสิ้น - เขียว
                                  memo.current_signer_order === 0 ? '#ef4444' : '#6b7280', // ตีกลับ - แดง
                      color: '#fff',
                      borderRadius: '9999px',
                      padding: '2px 8px',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      lineHeight: 1
                    }}
                  >
                    {getStatusTextBySignerOrder(memo.current_signer_order)}
                  </span>
                </div>
                {/* Progress Stepper: stepper เต็มทุกขนาดจอ (responsive size) */}
                <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-1 overflow-x-auto">
                  {/* ถ้าเป็นฉบับร่าง แสดงแค่ step รอตรวจทาน step เดียว */}
                  {memo.status === 'draft' ? (
                    <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                      <span className="font-semibold sm:text-[10px] text-[9px] text-purple-700">รอตรวจทาน</span>
                      <div className="w-2 h-2 rounded-full mt-1 bg-purple-500"></div>
                    </div>
                  ) : memo.status === 'rejected' ? (
                    /* ถ้าถูกตีกลับ แสดงชื่อผู้ตีกลับจาก rejected_name_comment */
                    <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                      <span className="font-semibold sm:text-[10px] text-[9px] text-red-700">ตีกลับ</span>
                      <span className="sm:text-[10px] text-[9px] text-red-600 font-medium">
                        {(() => {
                          // อ่านชื่อผู้ตีกลับจาก rejected_name_comment JSONB column
                          try {
                            if (memo.rejected_name_comment) {
                              let rejectedData;
                              if (typeof memo.rejected_name_comment === 'string') {
                                rejectedData = JSON.parse(memo.rejected_name_comment);
                              } else {
                                rejectedData = memo.rejected_name_comment;
                              }
                              return rejectedData?.name || 'ไม่ระบุ';
                            }
                            return 'ไม่ระบุ';
                          } catch (error) {
                            console.error('Error parsing rejected_name_comment:', error);
                            return 'ไม่ระบุ';
                          }
                        })()}
                      </span>
                      <div className="w-2 h-2 rounded-full mt-1 bg-red-500"></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                        <span className={`font-semibold sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5
                            ? 'text-muted-foreground'
                            : (memo.current_signer_order === 1 ? 'text-purple-700' : 'text-purple-400')
                        }`}>ตรวจทาน/เสนอ</span>
                        <span className={`sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5
                            ? 'text-muted-foreground'
                            : (memo.current_signer_order === 1 ? 'text-purple-700 font-bold' : 'text-purple-400')
                        }`}>
                          {(() => {
                            // ดึงชื่อผู้ตรวจทาน/ผู้เสนอจาก clerk_id (first_name + last_name)
                            try {
                              if (memo.clerk_id) {
                                const clerkProfile = profiles.find(p => p.user_id === memo.clerk_id);
                                if (clerkProfile) {
                                  return `${clerkProfile.first_name} ${clerkProfile.last_name}`;
                                }
                              }

                              return 'ไม่ระบุ';
                            } catch (error) {
                              console.error('Error getting clerk name:', error);
                              return 'ไม่ระบุ';
                            }
                          })()}
                        </span>
                        <div className={`w-2 h-2 rounded-full mt-1 ${
                          memo.current_signer_order === 5
                            ? 'bg-gray-200'
                            : (memo.current_signer_order === 1 ? 'bg-purple-500' : 'bg-purple-200')
                        }`}></div>
                      </div>
                      <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-purple-200'}`} />

                      {/* แสดงเฉพาะผู้ลงนามจาก signer_list_progress (ข้ามผู้เขียน/author) */}
                      {memo.signer_list_progress && Array.isArray(memo.signer_list_progress) && memo.signer_list_progress.length > 0 ? (
                        memo.signer_list_progress
                          .filter(signer => signer.role !== 'author' && signer.role !== 'clerk') // ข้ามผู้เขียนและธุรการ
                          .sort((a, b) => a.order - b.order)
                          .map((signer, idx, arr) => (
                            <React.Fragment key={signer.order}>
                              <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === signer.order ? 'text-purple-700' : 'text-purple-400')
                                }`}>
                                  {(() => {
                                    // ตรวจสอบ user_id: ถ้าเป็น 28ef1822-628a-4dfd-b7ea-2defa97d755b ให้แสดงเป็น ผู้อำนวยการ เสมอ
                                    if (signer.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b') {
                                      return 'ผู้อำนวยการ';
                                    }

                                    // แสดงตำแหน่งตาม role
                                    switch (signer.role) {
                                      case 'assistant_director':
                                        return signer.org_structure_role || 'หัวหน้าฝ่าย';
                                      case 'deputy_director':
                                        return 'รองผู้อำนวยการ';
                                      case 'director':
                                        return 'ผู้อำนวยการ';
                                      default:
                                        return signer.job_position || signer.position || '-';
                                    }
                                  })()}
                                </span>
                                <span className={`sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === signer.order ? 'text-purple-700 font-bold' : 'text-purple-400')
                                }`}>{(() => {
                                  // Always use user_id to fetch fresh data from profiles
                                  const userProfile = profiles.find(p => p.user_id === signer.user_id);
                                  if (userProfile) {
                                    return `${userProfile.first_name} ${userProfile.last_name}`.trim();
                                  }
                                  return '-';
                                })()}</span>
                                <div className={`w-2 h-2 rounded-full mt-1 ${
                                  memo.current_signer_order === 5 
                                    ? 'bg-gray-200'
                                    : (memo.current_signer_order === signer.order ? 'bg-purple-500' : 'bg-purple-200')
                                }`}></div>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-purple-200'}`} />
                              )}
                            </React.Fragment>
                          ))
                      ) : (
                        // Fallback เก่าถ้าไม่มี signer_list_progress
                        Array.isArray(memo.signature_positions) && memo.signature_positions.length > 0 ? (
                          memo.signature_positions
                            .filter(pos => pos.signer && [2,3,4].includes(pos.signer.order))
                            .sort((a, b) => a.signer.order - b.signer.order)
                            .map((pos, idx, arr) => (
                              <React.Fragment key={pos.signer.order}>
                                <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                  <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                    memo.current_signer_order === 5 
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === pos.signer.order ? 'text-purple-700' : 'text-purple-400')
                                  }`}>{
                                    // เฉพาะ นายอานนท์ จ่าแก้ว ให้แสดงเป็น ผู้อำนวยการ
                                    (pos.signer.name && pos.signer.name.includes('อานนท์') && pos.signer.name.includes('จ่าแก้ว')) ? 'ผู้อำนวยการ' :
                                    (pos.signer.org_structure_role || pos.signer.job_position || pos.signer.position || '-')
                                  }</span>
                                  <span className={`sm:text-[10px] text-[9px] ${
                                    memo.current_signer_order === 5 
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === pos.signer.order ? 'text-purple-700 font-bold' : 'text-purple-400')
                                  }`}>{pos.signer.name || '-'}</span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${
                                    memo.current_signer_order === 5 
                                      ? 'bg-gray-200'
                                      : (memo.current_signer_order === pos.signer.order ? 'bg-purple-500' : 'bg-purple-200')
                                  }`}></div>
                                </div>
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-purple-200'}`} />
                              </React.Fragment>
                          ))
                        ) : (
                          <span className={`text-[9px] ${memo.current_signer_order === 5 ? 'text-muted-foreground' : 'text-purple-400'}`}>ไม่พบข้อมูลลำดับผู้ลงนาม</span>
                        )
                      )}
                      
                      {/* Connector to final step */}
                      {((memo.signer_list_progress && memo.signer_list_progress.filter(s => s.role !== 'author').length > 0) || 
                        (memo.signature_positions && memo.signature_positions.length > 0)) && (
                        <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-gray-200' : 'bg-purple-200'}`} />
                      )}
                    </>
                  )}
                  {/* Step 5: เกษียนหนังสือแล้ว - ไม่แสดงถ้าถูกตีกลับ */}
                  {memo.status !== 'draft' && memo.status !== 'rejected' && (
                    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                      <span className={`font-semibold sm:text-[10px] text-[9px] ${
                        memo.current_signer_order === 5 
                          ? 'text-foreground' 
                          : 'text-purple-400'
                      }`}>เกษียนหนังสือแล้ว</span>
                      {memo.current_signer_order === 5 && (
                        <div className="w-2 h-2 rounded-full mt-1 bg-gray-700"></div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-auto">
                  {/* เมื่อ current_signer_order = 5 แสดงปุ่ม "ดูเอกสาร" และปุ่มมอบหมายงาน (สำหรับธุรการ) */}
                  {memo.current_signer_order === 5 ? (
                    <>
                      <Button variant="outline" size="sm" className={`h-7 px-2 flex items-center gap-1 border-blue-200 text-blue-600 ${memo.is_assigned ? '' : ''}`}
                        onClick={() => {
                          const documentType = memo.__source_table === 'doc_receive' ? 'doc_receive' : 'memo';
                          navigate('/document-detail', {
                            state: {
                              documentId: memo.id,
                              documentType: documentType
                            }
                          });
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        {memo.is_assigned && <span className="text-xs font-medium">ดูรายงาน</span>}
                      </Button>
                      {/* ปุ่มมอบหมายงาน - แสดงเฉพาะธุรการ */}
                      {(profile?.is_admin || profile?.position === 'clerk_teacher') && (
                        <>
                          {!memo.is_assigned ? (
                            <div className="relative">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const documentType = memo.__source_table === 'doc_receive' ? 'doc_receive' : 'memo';
                                  navigate(`/task-assignment?documentId=${memo.id}&documentType=${documentType}`);
                                }}
                                className="h-7 px-2 flex items-center gap-1 bg-green-50 border-green-500 text-green-700 hover:bg-green-100"
                              >
                                <ClipboardList className="h-4 w-4" />
                                <span className="text-xs font-medium">มอบหมายงาน</span>
                              </Button>
                              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow z-10">
                                ใหม่
                              </span>
                            </div>
                          ) : memo.has_active_tasks ? (
                            <div className="relative">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewAssignees(memo)}
                                className="h-7 px-2 flex items-center gap-1 bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                              >
                                <ClipboardList className="h-4 w-4" />
                                <span className="text-xs font-medium">ดูรายชื่อ</span>
                              </Button>
                              {/* Show "ทราบแล้ว" badge when task is in progress */}
                              {memo.has_in_progress_task && (
                                <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow z-10">
                                  ทราบแล้ว
                                </span>
                              )}
                            </div>
                          ) : null}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {/* ปุ่มดูปกติสำหรับสถานะอื่นๆ */}
                      <Button variant="outline" size="sm" className="h-7 px-2 flex items-center border-blue-200 text-blue-600"
                        onClick={() => {
                          const documentType = memo.__source_table === 'doc_receive' ? 'doc_receive' : 'memo';
                          navigate('/document-detail', {
                            state: {
                              documentId: memo.id,
                              documentType: documentType
                            }
                          });
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {/* Edit button - only show for memo author and not yet proposed (current_signer_order <= 1) */}
                      {profile?.user_id === memo.user_id && memo.current_signer_order <= 1 && (
                        <div className="relative">
                          <Button variant="outline" size="sm" className="h-7 px-2 flex items-center border-purple-200 text-purple-600"
                            onClick={() => {
                              // Navigate to edit page based on document type
                              const editRoute = getDocumentEditRoute(memo, memo.id);
                              navigate(editRoute);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {/* Show "ตีกลับ" badge for rejected memos on top-right corner */}
                          {memo.status === 'rejected' && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-white z-10">
                              ใหม่{memo.revision_count ? `(${memo.revision_count})` : ''}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Debug: Check user position */}
                      {(() => {
                        console.log('🔍 Debug DocumentList - User position:', profile?.position, 'Is clerk_teacher:', (profile?.is_admin || profile?.position === 'clerk_teacher'));
                        return null;
                      })()}
                      {(profile?.is_admin || profile?.position === 'clerk_teacher') && (
                        <div className="relative">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className={`h-7 px-2 flex items-center gap-1 ${
                              memo.current_signer_order > 1 
                                ? 'border-gray-200 text-muted-foreground cursor-not-allowed' 
                                : 'border-purple-200 text-purple-600'
                            }`}
                            onClick={() => {
                              if (memo.current_signer_order <= 1) {
                                const manageRoute = getDocumentManageRoute(memo, memo.id);
                                console.log('🔍 Navigating to manage route:', manageRoute, 'for memo:', memo.id);
                                navigate(manageRoute);
                              }
                            }}
                            disabled={memo.status === 'rejected' || memo.current_signer_order > 1}
                            title={memo.current_signer_order > 1 ? 'เอกสารถูกส่งเสนอแล้ว ไม่สามารถจัดการได้' : 'จัดการเอกสาร'}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-xs font-medium">
                              {memo.current_signer_order > 1 ? 'ส่งเสนอแล้ว' : 'จัดการเอกสาร'}
                            </span>
                          </Button>
                          {memo.status === 'draft' && memo.current_signer_order <= 1 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                              ใหม่{memo.revision_count ? `(${memo.revision_count})` : ''}
                            </span>
                          )}
                          {memo.current_signer_order > 1 && memo.current_signer_order < 5 && (
                            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">เสนอแล้ว</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {/* Delete button - แสดงเฉพาะธุรการเท่านั้น */}
                  {(() => {
                    const shouldShow = (profile?.is_admin || profile?.position === 'clerk_teacher');
                    console.log('🗑️ DocumentList Delete Button Check:', {
                      position: profile?.position,
                      isClerkTeacher: shouldShow,
                      memoId: memo.id,
                      willRender: shouldShow ? 'YES - BUTTON WILL RENDER' : 'NO - BUTTON HIDDEN'
                    });
                    return null;
                  })()}
                  {(profile?.is_admin || profile?.position === 'clerk_teacher') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 flex items-center justify-center border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        console.log('🗑️ Delete button clicked for memo:', memo.id);
                        handleDeleteClick(memo);
                      }}
                      title="ลบเอกสาร"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
            })
          ) : (
            <div className="p-6 text-center text-purple-200">
              <FileText className="h-8 w-8 mx-auto mb-2 text-purple-200" />
              {searchTerm || statusFilter !== 'all' ? (
                <div>
                  <p className="text-sm">ไม่พบเอกสารที่ตรงกับเงื่อนไข</p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                    }}
                    className="text-purple-400 hover:text-purple-600 mt-1 text-xs h-6"
                  >
                    ล้างตัวกรอง
                  </Button>
                </div>
              ) : (
                // แสดงข้อความที่แตกต่างกันตามบทบาท
                permissions.position === "clerk_teacher" ? (
                  <div className="text-sm">
                    <p>ยังไม่มีเอกสารในสถานศึกษา</p>
                    <span className="text-xs text-muted-foreground">รอเอกสารจากครูและบุคลากรเพื่อทำการจัดการ</span>
                  </div>
                ) : (["assistant_director", "deputy_director"].includes(permissions.position) ? (
                  <div className="text-sm">
                    <p>ไม่มีเอกสารของผู้อื่น</p>
                    <span className="text-xs text-muted-foreground">เอกสารส่วนตัวแสดงในส่วนข้างบน</span>
                  </div>
                ) : (
                  <p className="text-sm">ไม่มีเอกสารในระบบ</p>
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-purple-100 bg-purple-50/50">
            <div className="text-xs text-muted-foreground">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedMemos.length)} จาก {filteredAndSortedMemos.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-purple-200"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-purple-200"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              ยืนยันการลบเอกสาร
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              คุณกำลังจะลบเอกสาร: <span className="font-semibold text-foreground">"{documentToDelete?.form_data?.to || documentToDelete?.subject || 'ไม่ระบุ'}"</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>คำเตือน:</strong> การลบเอกสารนี้จะไม่สามารถกู้คืนได้
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone-verification-memo" className="text-sm font-medium">
                กรุณากรอก 4 ตัวท้ายของเบอร์โทรศัพท์ของคุณเพื่อยืนยัน
              </Label>
              <Input
                id="phone-verification-memo"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={phoneVerification}
                onChange={(e) => setPhoneVerification(e.target.value.replace(/\D/g, ''))}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                placeholder="XXXX"
                className="text-center text-lg tracking-widest"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                เบอร์โทรของคุณลงท้ายด้วย: {profile?.phone ? `****${profile.phone.slice(-4)}` : 'ไม่พบข้อมูล'}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteModalOpen(false);
                setDocumentToDelete(null);
                setPhoneVerification('');
              }}
              disabled={isDeleting}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting || phoneVerification.length !== 4}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  กำลังลบ...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  ยืนยันการลบ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal ดูรายชื่อผู้รับมอบหมาย */}
      <Dialog open={showAssigneesModal} onOpenChange={setShowAssigneesModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              รายชื่อผู้ได้รับมอบหมาย
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {isLoadingAssignees ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : assigneesList.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                ไม่พบรายชื่อผู้รับมอบหมาย
              </div>
            ) : (
              <div>
                {/* Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="py-2 px-2 text-left font-medium text-muted-foreground w-12">#</th>
                      <th className="py-2 px-2 text-left font-medium text-muted-foreground">ชื่อ</th>
                      <th className="py-2 px-2 text-center font-medium text-muted-foreground w-24">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneesList
                      .slice((assigneesPage - 1) * assigneesPerPage, assigneesPage * assigneesPerPage)
                      .map((assignee, index) => (
                        <tr key={assignee.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 text-muted-foreground">
                            {(assigneesPage - 1) * assigneesPerPage + index + 1}
                          </td>
                          <td className="py-2 px-2 text-foreground">{assignee.assignee_name}</td>
                          <td className="py-2 px-2 text-center">
                            <Badge
                              className={`text-[10px] px-1.5 py-0.5 ${
                                assignee.status === 'completed'
                                  ? 'bg-green-100 text-green-700 border-green-300'
                                  : assignee.status === 'in_progress'
                                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                                  : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                              }`}
                            >
                              {assignee.status === 'completed'
                                ? 'เสร็จสิ้น'
                                : assignee.status === 'in_progress'
                                ? 'ทราบแล้ว'
                                : 'รอดำเนินการ'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {assigneesList.length > assigneesPerPage && (
                  <div className="flex items-center justify-between pt-3 mt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAssigneesPage((p) => Math.max(1, p - 1))}
                      disabled={assigneesPage === 1}
                      className="h-7 text-xs"
                    >
                      <ChevronLeft className="h-3 w-3 mr-1" />
                      ก่อนหน้า
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {assigneesPage} / {Math.ceil(assigneesList.length / assigneesPerPage)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setAssigneesPage((p) =>
                          Math.min(Math.ceil(assigneesList.length / assigneesPerPage), p + 1)
                        )
                      }
                      disabled={assigneesPage >= Math.ceil(assigneesList.length / assigneesPerPage)}
                      className="h-7 text-xs"
                    >
                      ถัดไป
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAssigneesModal(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DocumentList;