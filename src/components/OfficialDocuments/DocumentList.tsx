import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, Edit, Calendar, User, AlertCircle, Clock, CheckCircle, XCircle, FileText, FileCheck, Settings, Building, Paperclip, Search, Filter, ChevronLeft, ChevronRight, RotateCcw, Trash2, FileInput, ClipboardList, ClipboardCheck, Users } from 'lucide-react';
import ClerkDocumentActions from './ClerkDocumentActions';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { useSmartRealtime } from '@/hooks/useSmartRealtime';
import { supabase } from '@/integrations/supabase/client';
import { extractPdfUrl } from '@/utils/fileUpload';
import { getDocumentManageRoute, getDocumentEditRoute, isPDFUploadMemo } from '@/utils/memoUtils';
import { shouldShowMemo as shouldShowMemoFn, parseSecretaryRole } from '@/utils/documentVisibility';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Accordion from './Accordion';
import { MemoService } from '@/services/memoService';
import { formatThaiDateShort } from '@/utils/dateUtils';
import TeamMemberIcon from '@/components/TaskAssignment/TeamMemberIcon';

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

  // เช็คเลขาฝ่ายจาก org_structure_role (เริ่มต้นด้วย "เลขา")
  const { isSecretary, department: secretaryDepartment } = parseSecretaryRole(profile?.org_structure_role);

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

  // State สำหรับติดตาม memo ที่เป็น report memo (ใช้ is_report_memo column โดยตรง)
  const [reportMemoIds, setReportMemoIds] = useState<Set<string>>(new Set());

  // อัพเดท localMemos เมื่อ realMemos เปลี่ยน
  useEffect(() => {
    setLocalMemos(realMemos);

    // อัปเดต reportMemoIds จาก is_report_memo column โดยตรง (ไม่ต้อง query task_assignments)
    const reportIds = new Set<string>();
    for (const memo of realMemos) {
      if (memo.is_report_memo === true) {
        reportIds.add(memo.id);
      }
    }
    setReportMemoIds(reportIds);
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
          completed_at,
          is_team_leader,
          is_reporter
        `)
        .eq(idColumn, memo.id)
        .eq('document_type', documentType)
        .is('deleted_at', null)
        .order('is_team_leader', { ascending: false })
        .order('is_reporter', { ascending: false })
        .order('assigned_at', { ascending: true });

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
      case 'draft': return 'text-blue-600 dark:text-blue-400 dark:text-blue-600'; // ฟ้า
      case 'pending_sign': return 'text-orange-500'; // ส้ม
      case 'approved': return 'text-green-600 dark:text-green-400 dark:text-green-600'; // เขียว
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
      case 1: return 'text-blue-600 dark:text-blue-400 dark:text-blue-600'; // ฉบับร่าง - น้ำเงิน
      case 2:
      case 3:
      case 4: return 'text-orange-500'; // รอลงนาม - ส้ม
      case 5: return 'text-green-600 dark:text-green-400 dark:text-green-600'; // เสร็จสิ้น - เขียว
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
      case 'high': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'low': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      default: return 'bg-muted text-foreground';
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

  // กรองเอกสารสำหรับแสดงใน DocumentList (delegate ไปที่ pure function เพื่อให้ test ได้)
  const shouldShowMemo = (memo: any) => shouldShowMemoFn(memo, {
    permissions,
    userId: profile?.user_id,
    isSecretary,
    secretaryDepartment,
  });

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
  }, [localMemos, searchTerm, statusFilter, typeFilter, assignmentFilter, sortBy, sortOrder, profile?.user_id, permissions.position, permissions.isAdmin, permissions.isClerk, isSecretary, secretaryDepartment]);

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
            isSecretary && secretaryDepartment ?
              `เอกสาร${secretaryDepartment}` :
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
        {isSecretary && secretaryDepartment && (
          <div className="text-sm text-purple-100 font-normal mt-1">
            เอกสารทั้งหมดของ{secretaryDepartment} (สำหรับสรุปงาน)
          </div>
        )}
        {!isSecretary && ["assistant_director", "deputy_director"].includes(permissions.position) && (
          <div className="text-sm text-purple-100 font-normal mt-1">
            เอกสารที่สร้างโดยผู้อื่น (เอกสารของคุณแสดงในส่วนข้างบน)
          </div>
        )}
      </CardHeader>

      {/* ส่วนค้นหาและกรอง - แถวเดียวแนวนอน */}
      <div className="bg-card border-b border-border px-3 py-2 overflow-x-auto">
        <div className="flex gap-2 items-center min-w-max">
          {/* ช่องค้นหา */}
          <div className="relative w-40 sm:flex-1 sm:w-auto">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเอกสาร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs h-8 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 focus:border-purple-400 focus:ring-purple-400 focus:ring-1"
            />
          </div>

          {/* ตัวกรองตามสถานะ */}
          <div className="w-28">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs border-border focus:border-purple-400">
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
              <SelectTrigger className="h-8 text-xs border-border focus:border-purple-400">
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
              <SelectTrigger className="h-8 text-xs border-border focus:border-purple-400">
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
              <SelectTrigger className="h-8 text-xs border-border focus:border-purple-400">
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
            className="h-8 w-8 p-0 border-border hover:border-purple-400 hover:text-purple-600 dark:text-purple-400 dark:text-purple-600"
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
              className="h-8 w-8 p-0 text-muted-foreground hover:text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950 dark:bg-purple-950"
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
                ? "bg-muted dark:bg-background/80 border-border hover:bg-accent dark:hover:bg-card/80" 
                : "bg-card border-border hover:bg-muted/50";
              
              return (
              <div key={memo.id} className={`${baseClasses} ${completedClasses}`}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {memo.__source_table === 'doc_receive' ? (
                    <FileInput className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-green-500'}`} />
                  ) : reportMemoIds.has(memo.id) ? (
                    <FileCheck className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-teal-500'}`} />
                  ) : (
                    <FileText className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-purple-500'}`} />
                  )}
                  <span className={`font-medium truncate max-w-[120px] sm:max-w-[160px] sm:text-base text-sm ${isCompleted ? 'text-muted-foreground group-hover:text-foreground' : reportMemoIds.has(memo.id) ? 'text-foreground group-hover:text-teal-700 dark:text-teal-300' : 'text-foreground group-hover:text-purple-700 dark:text-purple-300'}`} title={memo.subject}>{memo.subject}</span>
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
                        <Paperclip className="h-3 w-3 text-purple-600 dark:text-purple-400 dark:text-purple-600" />
                      </div>
                    );
                  })()}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{(memo.author_name || '-').split(' ')[0]}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatThaiDateShort(memo.created_at)}</span>
                  {memo.doc_number && <span className="text-xs text-muted-foreground whitespace-nowrap">#{memo.doc_number.split('/')[0]}</span>}
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
                      <span className="font-semibold sm:text-[10px] text-[9px] text-purple-700 dark:text-purple-300">รอตรวจทาน</span>
                      <div className="w-2 h-2 rounded-full mt-1 bg-purple-500"></div>
                    </div>
                  ) : memo.status === 'rejected' ? (
                    /* ถ้าถูกตีกลับ แสดงชื่อผู้ตีกลับจาก rejected_name_comment */
                    <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                      <span className="font-semibold sm:text-[10px] text-[9px] text-red-700 dark:text-red-300">ตีกลับ</span>
                      <span className="sm:text-[10px] text-[9px] text-red-600 dark:text-red-400 dark:text-red-600 font-medium">
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
                            : (memo.current_signer_order === 1 ? 'text-purple-700 dark:text-purple-300' : 'text-purple-400 dark:text-purple-600')
                        }`}>ตรวจทาน/เสนอ</span>
                        <span className={`sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5
                            ? 'text-muted-foreground'
                            : (memo.current_signer_order === 1 ? 'text-purple-700 dark:text-purple-300 font-bold' : 'text-purple-400 dark:text-purple-600')
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
                            ? 'bg-muted'
                            : (memo.current_signer_order === 1 ? 'bg-purple-500' : 'bg-purple-200 dark:bg-purple-800')
                        }`}></div>
                      </div>
                      <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-purple-200 dark:bg-purple-800'}`} />

                      {/* Parallel signers step (ถ้ามี) — กดดูรายชื่อ fixed popup */}
                      {(memo as any)?.parallel_signers?.signers?.length > 0 && (() => {
                        const pc = (memo as any).parallel_signers;
                        const completedCount = (pc.completed_user_ids || []).length;
                        const totalCount = pc.signers.length;
                        const isCurrentStep = memo.current_signer_order === pc.order;
                        const isDone = completedCount >= totalCount;
                        return (
                          <>
                            <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                              <button
                                type="button"
                                className="flex flex-col items-center focus:outline-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const existingPopup = document.getElementById(`parallel-popup-doc-${memo.id}`);
                                  if (existingPopup) { existingPopup.remove(); return; }
                                  document.querySelectorAll('[data-parallel-fixed-popup]').forEach(el => el.remove());
                                  const popup = document.createElement('div');
                                  popup.id = `parallel-popup-doc-${memo.id}`;
                                  popup.setAttribute('data-parallel-fixed-popup', 'true');
                                  popup.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:9999;`;
                                  popup.className = 'bg-card border border-border rounded-lg shadow-xl p-3 min-w-[180px]';
                                  popup.innerHTML = `
                                    <p class="text-xs font-semibold text-muted-foreground mb-2">ผู้ลงนามเพิ่มเติม</p>
                                    ${pc.signers.map((s: any) => {
                                      const done = (pc.completed_user_ids || []).includes(s.user_id);
                                      return `<div class="flex items-center gap-2 py-1">
                                        <span class="text-xs ${done ? 'text-green-600' : 'text-amber-600'}">${done ? '✓' : '○'}</span>
                                        <span class="text-xs text-foreground">${s.name}</span>
                                      </div>`;
                                    }).join('')}
                                  `;
                                  document.body.appendChild(popup);
                                  const close = (ev: MouseEvent) => {
                                    if (!popup.contains(ev.target as Node)) { popup.remove(); document.removeEventListener('click', close); window.removeEventListener('scroll', scrollClose, true); }
                                  };
                                  const scrollClose = () => { popup.remove(); document.removeEventListener('click', close); window.removeEventListener('scroll', scrollClose, true); };
                                  setTimeout(() => { document.addEventListener('click', close); window.addEventListener('scroll', scrollClose, true); }, 0);
                                }}
                              >
                                <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5 ? 'text-muted-foreground'
                                    : isCurrentStep ? 'text-purple-700 dark:text-purple-300'
                                    : 'text-purple-400 dark:text-purple-600'
                                }`}>
                                  <Users className="inline h-3 w-3 mr-0.5" /> {completedCount}/{totalCount}
                                </span>
                                <span className={`sm:text-[10px] text-[9px] underline decoration-dotted ${
                                  isCurrentStep ? 'text-purple-700 dark:text-purple-300 font-bold' : 'text-purple-400 dark:text-purple-600'
                                }`}>
                                  ผู้ลงนาม
                                </span>
                                <div className={`w-2 h-2 rounded-full mt-1 ${
                                  memo.current_signer_order === 5 ? 'bg-muted'
                                    : isCurrentStep ? 'bg-purple-500'
                                    : 'bg-purple-200 dark:bg-purple-800'
                                }`}></div>
                              </button>
                            </div>
                            <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-purple-200 dark:bg-purple-800'}`} />
                          </>
                        );
                      })()}

                      {/* แสดงเฉพาะผู้ลงนามจาก signer_list_progress (ข้ามผู้เขียน/author) */}
                      {memo.signer_list_progress && Array.isArray(memo.signer_list_progress) && memo.signer_list_progress.length > 0 ? (
                        memo.signer_list_progress
                          .filter(signer => signer.role !== 'author' && signer.role !== 'clerk' && signer.role !== 'parallel_signer') // ข้ามผู้เขียน ธุรการ และ parallel_signer
                          .sort((a, b) => a.order - b.order)
                          .map((signer, idx, arr) => (
                            <React.Fragment key={signer.user_id || `signer-${idx}`}>
                              <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === signer.order ? 'text-purple-700 dark:text-purple-300' : 'text-purple-400 dark:text-purple-600')
                                }`}>
                                  {(() => {
                                    if (signer.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b') return 'ผู้อำนวยการ';
                                    switch (signer.role) {
                                      case 'assistant_director':
                                        return signer.org_structure_role || 'หัวหน้าฝ่าย';
                                      case 'deputy_director':
                                        return 'รองผู้อำนวยการ';
                                      case 'director':
                                        return 'ผู้อำนวยการ';
                                      default:
                                        return signer.org_structure_role || signer.job_position || signer.position || '-';
                                    }
                                  })()}
                                </span>
                                <span className={`sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === signer.order ? 'text-purple-700 dark:text-purple-300 font-bold' : 'text-purple-400 dark:text-purple-600')
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
                                    ? 'bg-muted'
                                    : (memo.current_signer_order === signer.order ? 'bg-purple-500' : 'bg-purple-200 dark:bg-purple-800')
                                }`}></div>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-purple-200 dark:bg-purple-800'}`} />
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
                                      : (memo.current_signer_order === pos.signer.order ? 'text-purple-700 dark:text-purple-300' : 'text-purple-400 dark:text-purple-600')
                                  }`}>{
                                    // เฉพาะ นายอานนท์ จ่าแก้ว ให้แสดงเป็น ผู้อำนวยการ
                                    (pos.signer.name && pos.signer.name.includes('อานนท์') && pos.signer.name.includes('จ่าแก้ว')) ? 'ผู้อำนวยการ' :
                                    (pos.signer.org_structure_role || pos.signer.job_position || pos.signer.position || '-')
                                  }</span>
                                  <span className={`sm:text-[10px] text-[9px] ${
                                    memo.current_signer_order === 5 
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === pos.signer.order ? 'text-purple-700 dark:text-purple-300 font-bold' : 'text-purple-400 dark:text-purple-600')
                                  }`}>{pos.signer.name || '-'}</span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${
                                    memo.current_signer_order === 5 
                                      ? 'bg-muted'
                                      : (memo.current_signer_order === pos.signer.order ? 'bg-purple-500' : 'bg-purple-200 dark:bg-purple-800')
                                  }`}></div>
                                </div>
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-purple-200 dark:bg-purple-800'}`} />
                              </React.Fragment>
                          ))
                        ) : (
                          <span className={`text-[9px] ${memo.current_signer_order === 5 ? 'text-muted-foreground' : 'text-purple-400 dark:text-purple-600'}`}>ไม่พบข้อมูลลำดับผู้ลงนาม</span>
                        )
                      )}
                      
                      {/* Connector to final step */}
                      {((memo.signer_list_progress && memo.signer_list_progress.filter(s => s.role !== 'author').length > 0) ||
                        (memo.signature_positions && memo.signature_positions.length > 0)) && (
                        <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-purple-200 dark:bg-purple-800'}`} />
                      )}
                    </>
                  )}
                  {/* Step 5: เกษียนหนังสือแล้ว - ไม่แสดงถ้าถูกตีกลับ */}
                  {memo.status !== 'draft' && memo.status !== 'rejected' && (
                    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                      <span className={`font-semibold sm:text-[10px] text-[9px] ${
                        memo.current_signer_order === 5
                          ? 'text-foreground'
                          : 'text-purple-400 dark:text-purple-600'
                      }`}>เกษียนหนังสือแล้ว</span>
                      {memo.current_signer_order === 5 && (
                        <div className="w-2 h-2 rounded-full mt-1 bg-gray-700 dark:bg-gray-300"></div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-auto">
                  {/* เมื่อ current_signer_order = 5 แสดงปุ่ม "ดูเอกสาร" และปุ่มมอบหมายงาน (สำหรับธุรการ) */}
                  {memo.current_signer_order === 5 ? (
                    <>
                      <Button variant="outline" size="sm" className={`h-7 px-2 flex items-center gap-1 ${reportMemoIds.has(memo.id) ? 'border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400' : 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'}`}
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
                        {(reportMemoIds.has(memo.id) || memo.is_assigned) && <span className="text-xs font-medium">ดูรายงาน</span>}
                      </Button>
                      {/* ปุ่มดูรายชื่อผู้รับมอบหมาย - แสดงสำหรับเลขาฝ่าย (เฉพาะเอกสารที่มอบหมายแล้ว) */}
                      {isSecretary && memo.is_assigned && memo.has_active_tasks && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAssignees(memo)}
                          className="h-7 px-2 flex items-center gap-1 bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-900"
                        >
                          <ClipboardList className="h-4 w-4" />
                          <span className="text-xs font-medium">ดูรายชื่อ</span>
                        </Button>
                      )}
                      {/* ปุ่มมอบหมายงาน - แสดงเฉพาะธุรการ และไม่ใช่ report memo */}
                      {!isSecretary && (profile?.is_admin || profile?.position === 'clerk_teacher' || profile?.position === 'director') && !reportMemoIds.has(memo.id) && (
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
                                className="h-7 px-2 flex items-center gap-1 bg-green-50 dark:bg-green-950 border-green-500 text-green-700 dark:text-green-300 hover:bg-green-100 dark:bg-green-900 dark:hover:bg-green-900"
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
                                className="h-7 px-2 flex items-center gap-1 bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-900"
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
                      <Button variant="outline" size="sm" className="h-7 px-2 flex items-center border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 dark:text-blue-600"
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
                      {/* Edit button - show for memo author (draft or rejected) */}
                      {profile?.user_id === memo.user_id &&
                        (memo.current_signer_order <= 1 || memo.status === 'rejected') && (
                        <div className="relative">
                          <Button variant="outline" size="sm" className={`h-7 px-2 flex items-center gap-1 ${memo.status === 'rejected' ? 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950' : (reportMemoIds.has(memo.id) ? 'border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400' : 'border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400')}`}
                            onClick={() => {
                              if (reportMemoIds.has(memo.id)) {
                                // Navigate to create report memo page with edit mode
                                navigate(`/create-report-memo?edit=${memo.id}`);
                              } else {
                                // Navigate to edit page based on document type
                                const editRoute = getDocumentEditRoute(memo, memo.id);
                                navigate(editRoute);
                              }
                            }}
                            title={memo.status === 'rejected' ? 'แก้ไขเอกสารที่ถูกตีกลับ' : 'แก้ไขเอกสาร'}
                          >
                            <Edit className="h-4 w-4" />
                            {memo.status === 'rejected' && <span className="text-xs">แก้ไข</span>}
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
                        console.log('🔍 Debug DocumentList - User position:', profile?.position, 'Is clerk_teacher:', (profile?.is_admin || profile?.position === 'clerk_teacher' || profile?.position === 'director'));
                        return null;
                      })()}
                      {!isSecretary && (profile?.is_admin || profile?.position === 'clerk_teacher' || profile?.position === 'director') && (
                        <div className="relative">
                          {(() => {
                            const isReportMemo = reportMemoIds.has(memo.id);
                            const buttonColor = isReportMemo
                              ? (memo.current_signer_order > 1 ? 'border-border text-muted-foreground cursor-not-allowed' : 'border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400')
                              : (memo.current_signer_order > 1 ? 'border-border text-muted-foreground cursor-not-allowed' : 'border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400');
                            const buttonText = memo.current_signer_order > 1 ? 'ส่งเสนอแล้ว' : (isReportMemo ? 'จัดการรายงาน' : 'จัดการเอกสาร');
                            const buttonTitle = memo.current_signer_order > 1 ? 'เอกสารถูกส่งเสนอแล้ว ไม่สามารถจัดการได้' : (isReportMemo ? 'จัดการรายงาน' : 'จัดการเอกสาร');
                            const IconComponent = isReportMemo ? ClipboardCheck : FileText;

                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-7 px-2 flex items-center gap-1 ${buttonColor}`}
                                onClick={() => {
                                  if (memo.current_signer_order <= 1) {
                                    if (isReportMemo) {
                                      navigate(`/manage-report-memo/${memo.id}`);
                                    } else {
                                      const manageRoute = getDocumentManageRoute(memo, memo.id);
                                      console.log('🔍 Navigating to manage route:', manageRoute, 'for memo:', memo.id);
                                      navigate(manageRoute);
                                    }
                                  }
                                }}
                                disabled={memo.current_signer_order > 1}
                                title={buttonTitle}
                              >
                                <IconComponent className="h-4 w-4" />
                                <span className="text-xs font-medium">{buttonText}</span>
                              </Button>
                            );
                          })()}
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
                  {/* Delete button - แสดงเฉพาะธุรการเท่านั้น (ไม่แสดงสำหรับเลขาฝ่าย) */}
                  {!isSecretary && (profile?.is_admin || profile?.position === 'clerk_teacher' || profile?.position === 'director') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 flex items-center justify-center border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 dark:bg-red-950"
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
                    className="text-purple-400 hover:text-purple-600 dark:text-purple-400 dark:text-purple-600 mt-1 text-xs h-6"
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
                ) : isSecretary && secretaryDepartment ? (
                  <div className="text-sm">
                    <p>ยังไม่มีเอกสารของ{secretaryDepartment}</p>
                    <span className="text-xs text-muted-foreground">เอกสารจะแสดงเมื่อมีการระบุฝ่ายที่รับผิดชอบ</span>
                  </div>
                ) : ["assistant_director", "deputy_director"].includes(permissions.position) ? (
                  <div className="text-sm">
                    <p>ไม่มีเอกสารของผู้อื่น</p>
                    <span className="text-xs text-muted-foreground">เอกสารส่วนตัวแสดงในส่วนข้างบน</span>
                  </div>
                ) : (
                  <p className="text-sm">ไม่มีเอกสารในระบบ</p>
                )
              )}
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-purple-100 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/50">
            <div className="text-xs text-muted-foreground">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedMemos.length)} จาก {filteredAndSortedMemos.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-purple-200 dark:border-purple-800"
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
                className="h-7 w-7 p-0 border-purple-200 dark:border-purple-800"
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
            <DialogTitle className="text-red-600 dark:text-red-400 dark:text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              ยืนยันการลบเอกสาร
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              คุณกำลังจะลบเอกสาร: <span className="font-semibold text-foreground">"{documentToDelete?.form_data?.to || documentToDelete?.subject || 'ไม่ระบุ'}"</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
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
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-teal-600" />
              รายชื่อผู้รับมอบหมาย
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 flex-1 overflow-y-auto min-h-0">
            {isLoadingAssignees ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
            ) : assigneesList.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">ไม่พบข้อมูลผู้รับมอบหมาย</p>
            ) : (
              <div className="space-y-2">
                {assigneesList
                  .slice((assigneesPage - 1) * assigneesPerPage, assigneesPage * assigneesPerPage)
                  .map((assignee) => (
                    <div
                      key={assignee.id}
                      className="flex items-center justify-between p-3 bg-muted dark:bg-card/60 rounded-lg border gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {/* Role Icon */}
                        <TeamMemberIcon
                          isLeader={assignee.is_team_leader}
                          isReporter={assignee.is_reporter}
                          size="sm"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-foreground text-sm truncate">{assignee.assignee_name}</span>
                          {/* Role badges */}
                          <div className="flex gap-1">
                            {assignee.is_team_leader && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">หัวหน้า</span>
                            )}
                            {assignee.is_reporter && (
                              <span className="text-[10px] text-pink-600 dark:text-pink-400 font-medium">
                                {assignee.is_team_leader && '• '}ผู้รายงาน
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`flex-shrink-0 text-xs ${
                          assignee.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                            : assignee.status === 'in_progress'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        {assignee.status === 'completed' ? 'เสร็จ' : assignee.status === 'in_progress' ? 'กำลังทำ' : 'รอ'}
                      </Badge>
                    </div>
                  ))}

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

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setShowAssigneesModal(false)} className="w-full sm:w-auto">
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DocumentList;