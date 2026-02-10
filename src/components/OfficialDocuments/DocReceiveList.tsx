import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, AlertCircle, Clock, CheckCircle, XCircle, FileText, Paperclip, Search, ChevronLeft, ChevronRight, RotateCcw, Edit, FileInput, ClipboardList, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ClerkDocumentActions from './ClerkDocumentActions';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { useSmartRealtime } from '@/hooks/useSmartRealtime';
import { supabase } from '@/integrations/supabase/client';
import { extractPdfUrl } from '@/utils/fileUpload';
import { getDocumentManageRoute, isPDFUploadMemo } from '@/utils/memoUtils';
import Accordion from './Accordion';

// ประเภทเอกสารหนังสือรับ (PDF อัปโหลด)
interface DocReceiveDocument {
  id: number;
  title: string;
  description: string;
  requester: string;
  department: string;
  status: string;
  created_at: string;
  document_number: string | null;
  urgency: string;
  source_type?: string;
}

interface DocReceiveListProps {
  documents: DocReceiveDocument[];
  docReceiveList?: any[];
  onReject?: (documentId: string, reason: string) => void;
  onAssignNumber?: (documentId: string, number: string) => void;
  onSetSigners?: (documentId: string, signers: any[]) => void;
  onRefresh?: () => void;
  defaultCollapsed?: boolean;
}

const DocReceiveList: React.FC<DocReceiveListProps> = ({
  documents,
  docReceiveList = [],
  onReject,
  onAssignNumber,
  onSetSigners,
  onRefresh,
  defaultCollapsed = false
}) => {
  const { getPermissions, profile } = useEmployeeAuth();
  const { profiles } = useProfiles();
  const permissions = getPermissions();
  const { updateSingleMemo } = useSmartRealtime();
  const navigate = useNavigate();

  // State สำหรับ collapsible
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // State สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State สำหรับ realtime updates
  const [localDocReceive, setLocalDocReceive] = useState(docReceiveList);

  // State สำหรับ modal ดูรายชื่อผู้รับมอบหมาย
  const [showAssigneesModal, setShowAssigneesModal] = useState(false);
  const [selectedDocForAssignees, setSelectedDocForAssignees] = useState<any>(null);
  const [assigneesList, setAssigneesList] = useState<any[]>([]);
  const [assigneesPage, setAssigneesPage] = useState(1);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const assigneesPerPage = 5;

  const { toast } = useToast();

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

    const handleDocReceiveUpdated = (event: CustomEvent) => {
      const { docReceive, action } = event.detail;
      console.log('📋 DocReceiveList: Doc Receive updated', { docReceive, action, position: permissions.position });
      
      if (action === 'INSERT' || action === 'UPDATE') {
        setLocalDocReceive(prevDocs => {
          const existingIndex = prevDocs.findIndex(d => d.id === docReceive.id);
          if (existingIndex >= 0) {
            // อัพเดท doc_receive ที่มีอยู่
            const updated = [...prevDocs];
            updated[existingIndex] = docReceive;
            return updated;
          } else {
            // เพิ่ม doc_receive ใหม่
            return [docReceive, ...prevDocs];
          }
        });
      }
    };

    const handleDocReceiveDeleted = (event: CustomEvent) => {
      const { docReceiveId } = event.detail;
      console.log('🗑️ DocReceiveList: Doc Receive deleted', { docReceiveId, position: permissions.position });
      
      setLocalDocReceive(prevDocs => 
        prevDocs.filter(doc => doc.id !== docReceiveId)
      );
    };

    // เพิ่ม event listeners สำหรับ doc_receive
    window.addEventListener('doc-receive-updated', handleDocReceiveUpdated as EventListener);
    window.addEventListener('doc-receive-deleted', handleDocReceiveDeleted as EventListener);

    // Setup Supabase realtime subscription สำหรับ doc_receive
    const subscription = (supabase as any)
      .channel('doc-receive-list-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doc_receive',
          filter: profile?.user_id ? `created_by=neq.${profile.user_id}` : undefined, // เอกสารที่ไม่ใช่ของตนเอง
        },
        async (payload: any) => {
          console.log('🔵 DocReceiveList: Realtime doc_receive change:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // อัพเดท doc_receive ใน local state
            const updatedDoc = payload.new;
            setLocalDocReceive(prevDocs => {
              const existingIndex = prevDocs.findIndex(d => d.id === updatedDoc.id);
              if (existingIndex >= 0) {
                const updated = [...prevDocs];
                updated[existingIndex] = updatedDoc;
                return updated;
              } else {
                return [updatedDoc, ...prevDocs];
              }
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setLocalDocReceive(prevDocs => 
              prevDocs.filter(doc => doc.id !== deletedId)
            );
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      window.removeEventListener('doc-receive-updated', handleDocReceiveUpdated as EventListener);
      window.removeEventListener('doc-receive-deleted', handleDocReceiveDeleted as EventListener);
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

  // ฟังก์ชันสำหรับดูรายชื่อผู้รับมอบหมาย
  const handleViewAssignees = async (doc: any) => {
    setSelectedDocForAssignees(doc);
    setAssigneesPage(1);
    setIsLoadingAssignees(true);
    setShowAssigneesModal(true);

    try {
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
        .eq('doc_receive_id', doc.id)
        .eq('document_type', 'doc_receive')
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
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      }

      // Create a map of user_id to full_name (combined first_name + last_name)
      const profileMap = new Map();
      (profilesData || []).forEach((p: any) => {
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

  // กรองเอกสารสำหรับแสดงใน DocumentList
  // สำหรับ clerk_teacher, ผู้ช่วยผอ, รองผอ ไม่แสดงเอกสารส่วนตัวใน DocumentList
  // เพราะจะแสดงใน PersonalDocumentList แยกต่างหาก
  const shouldShowMemo = (memo: any) => {
    // Admin เห็นเอกสารทั้งหมด
    if (permissions.isAdmin) {
      return true;
    }

    // สำหรับ clerk_teacher: ไม่แสดงเอกสารส่วนตัวใน DocumentList (เหมือนเดิม)
    // ยกเว้น PDF Upload ที่ให้ธุรการทุกคนจัดการได้
    if (permissions.isClerk) {
      // แสดงเฉพาะเอกสารของคนอื่น (ไม่ใช่เอกสารของตนเอง)
      // หรือถ้าเป็น PDF Upload ให้แสดงทุกคนรวมทั้งของตัวเอง
      return memo.user_id !== profile?.user_id || isPDFUploadMemo(memo);
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
  const filteredAndSortedDocReceive = useMemo(() => {
    // กรองตาม shouldShowMemo ก่อน
    let filtered = localDocReceive.filter(memo => {
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

      // กรองตามการมอบหมาย (เฉพาะเอกสารที่เสร็จสิ้นแล้ว)
      let assignmentMatch = true;
      if (assignmentFilter !== 'all') {
        if (assignmentFilter === 'assigned') {
          assignmentMatch = memo.is_assigned === true;
        } else if (assignmentFilter === 'not_assigned') {
          assignmentMatch = memo.current_signer_order === 5 && !memo.is_assigned;
        }
      }

      return searchMatch && statusMatch && assignmentMatch;
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
  }, [localDocReceive, searchTerm, statusFilter, assignmentFilter, sortBy, sortOrder, profile?.user_id, permissions.position]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedDocReceive.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedDocReceive.slice(startIndex, endIndex);

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, assignmentFilter, sortBy, sortOrder]);

  // แสดง Card รายการหนังสือรับ (PDF อัปโหลด) สำหรับทุกตำแหน่ง
  // if (["deputy_director", "director"].includes(permissions.position)) {
  //   return null;
  // }

  return (
    <Card>
      <CardHeader
        className={`bg-green-600 py-3 px-4 cursor-pointer hover:bg-green-700 transition-all ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg'}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <FileText className="h-4 w-4 text-green-100" />
          รายการหนังสือรับ
          <Badge variant="secondary" className="ml-auto bg-green-700 text-white font-semibold px-2 py-1 rounded-full">
            {filteredAndSortedDocReceive.length > 0 ? `${filteredAndSortedDocReceive.length} รายการ` : 'ไม่มีเอกสาร'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRefresh?.(); }}
            disabled={!onRefresh}
            className="ml-2 p-1 h-8 w-8 text-white/70 hover:text-white disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-white/10 transition-colors">
            {isCollapsed ? (
              <ChevronDown className="h-5 w-5 text-white/70" />
            ) : (
              <ChevronUp className="h-5 w-5 text-white/70" />
            )}
          </div>
        </CardTitle>
        <div className="text-sm text-green-100 font-normal mt-1">
          {isCollapsed ? 'คลิกเพื่อแสดงรายการ' : 'จัดการหนังสือรับ ตรวจสอบความถูกต้อง กำหนดเลขที่ และจัดเส้นทางการอนุมัติ'}
        </div>
      </CardHeader>

      {/* Content - ซ่อนเมื่อ collapsed */}
      {!isCollapsed && (
      <>
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
              className="pl-7 pr-3 py-1 text-xs h-8 border-border focus:border-green-400 focus:ring-green-400 focus:ring-1"
            />
          </div>

          {/* ตัวกรองตามสถานะ */}
          <div className="w-28">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs border-border focus:border-green-400">
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

          {/* ตัวกรองตามการมอบหมาย */}
          <div className="w-32">
            <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
              <SelectTrigger className="h-8 text-xs border-border focus:border-green-400">
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
              <SelectTrigger className="h-8 text-xs border-border focus:border-green-400">
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
            className="h-8 w-8 p-0 border-border hover:border-green-400 hover:text-green-600 dark:text-green-400 dark:text-green-600"
            title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
          >
            <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          </Button>

          {/* ปุ่มล้างตัวกรอง */}
          {(searchTerm || statusFilter !== 'all' || assignmentFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setAssignmentFilter('all');
              }}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 dark:bg-green-950"
              title="ล้างตัวกรอง"
            >
              <span className="text-sm">×</span>
            </Button>
          )}
        </div>

        {/* แสดงจำนวนผลลัพธ์ */}
        {(searchTerm || statusFilter !== 'all' || assignmentFilter !== 'all') && (
          <div className="text-[10px] text-muted-foreground mt-1 text-center">
            แสดง {filteredAndSortedDocReceive.length} จาก {docReceiveList.filter(shouldShowMemo).length} รายการ
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
                ? "bg-muted border-border hover:bg-accent" 
                : "bg-card border-border hover:bg-muted/50";
              
              return (
              <div key={memo.id} className={`${baseClasses} ${completedClasses}`}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <FileInput className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-green-500'}`} />
                  <span className={`font-medium truncate max-w-[120px] sm:max-w-[160px] sm:text-base text-sm ${isCompleted ? 'text-muted-foreground group-hover:text-foreground' : 'text-foreground group-hover:text-green-700 dark:text-green-300'}`} title={memo.subject}>{memo.subject}</span>
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
                        <Paperclip className="h-3 w-3 text-green-600 dark:text-green-400 dark:text-green-600" />
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
                      <span className="font-semibold sm:text-[10px] text-[9px] text-green-700 dark:text-green-300">รอตรวจทาน</span>
                      <div className="w-2 h-2 rounded-full mt-1 bg-green-500"></div>
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
                            : (memo.current_signer_order === 1 ? 'text-green-700 dark:text-green-300' : 'text-green-400 dark:text-green-600')
                        }`}>ตรวจทาน</span>
                        <span className={`sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5 
                            ? 'text-muted-foreground'
                            : (memo.current_signer_order === 1 ? 'text-green-700 dark:text-green-300 font-bold' : 'text-green-400 dark:text-green-600')
                        }`}>
                          {(() => {
                            // ดึงชื่อธุรการผู้ตรวจทานจาก clerk_id (first_name + last_name)
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
                            : (memo.current_signer_order === 1 ? 'bg-green-500' : 'bg-green-200 dark:bg-green-800')
                        }`}></div>
                      </div>
                      <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-green-200 dark:bg-green-800'}`} />

                      {/* แสดงผู้เสนอ (clerk_teacher) สำหรับหนังสือรับ */}
                      {memo.signer_list_progress && Array.isArray(memo.signer_list_progress) && memo.signer_list_progress.length > 0 && (() => {
                        const proposer = memo.signer_list_progress.find(s => s.role === 'clerk');
                        if (proposer) {
                          return (
                            <>
                              <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === proposer.order ? 'text-green-700 dark:text-green-300' : 'text-green-400 dark:text-green-600')
                                }`}>ผู้เสนอ</span>
                                <span className={`sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === proposer.order ? 'text-green-700 dark:text-green-300 font-bold' : 'text-green-400 dark:text-green-600')
                                }`}>
                                  {(() => {
                                    // Always use user_id to fetch fresh data from profiles
                                    const userProfile = profiles.find(p => p.user_id === proposer.user_id);
                                    if (userProfile) {
                                      return `${userProfile.first_name} ${userProfile.last_name}`.trim();
                                    }
                                    return '-';
                                  })()}
                                </span>
                                <div className={`w-2 h-2 rounded-full mt-1 ${
                                  memo.current_signer_order === 5
                                    ? 'bg-muted'
                                    : (memo.current_signer_order === proposer.order ? 'bg-green-500' : 'bg-green-200 dark:bg-green-800')
                                }`}></div>
                              </div>
                              <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-green-200 dark:bg-green-800'}`} />
                            </>
                          );
                        }
                        return null;
                      })()}

                      {/* แสดงเฉพาะผู้ลงนามจาก signer_list_progress (ข้ามผู้เขียน/author และธุรการ/clerk) */}
                      {memo.signer_list_progress && Array.isArray(memo.signer_list_progress) && memo.signer_list_progress.length > 0 ? (
                        memo.signer_list_progress
                          .filter(signer => signer.role !== 'author' && signer.role !== 'clerk') // ข้ามผู้เขียนและธุรการ (ธุรการไม่ลงนาม แค่ประทับตรา)
                          .sort((a, b) => a.order - b.order)
                          .map((signer, idx, arr) => (
                            <React.Fragment key={signer.order}>
                              <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5 
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === signer.order ? 'text-green-700 dark:text-green-300' : 'text-green-400 dark:text-green-600')
                                }`}>
                                  {(() => {
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
                                    : (memo.current_signer_order === signer.order ? 'text-green-700 dark:text-green-300 font-bold' : 'text-green-400 dark:text-green-600')
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
                                    : (memo.current_signer_order === signer.order ? 'bg-green-500' : 'bg-green-200 dark:bg-green-800')
                                }`}></div>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-green-200 dark:bg-green-800'}`} />
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
                                      : (memo.current_signer_order === pos.signer.order ? 'text-green-700 dark:text-green-300' : 'text-green-400 dark:text-green-600')
                                  }`}>{
                                    // เฉพาะ นายอานนท์ จ่าแก้ว ให้แสดงเป็น ผู้อำนวยการ
                                    (pos.signer.name && pos.signer.name.includes('อานนท์') && pos.signer.name.includes('จ่าแก้ว')) ? 'ผู้อำนวยการ' :
                                    (pos.signer.org_structure_role || pos.signer.job_position || pos.signer.position || '-')
                                  }</span>
                                  <span className={`sm:text-[10px] text-[9px] ${
                                    memo.current_signer_order === 5 
                                      ? 'text-muted-foreground'
                                      : (memo.current_signer_order === pos.signer.order ? 'text-green-700 dark:text-green-300 font-bold' : 'text-green-400 dark:text-green-600')
                                  }`}>{pos.signer.name || '-'}</span>
                                  <div className={`w-2 h-2 rounded-full mt-1 ${
                                    memo.current_signer_order === 5 
                                      ? 'bg-muted'
                                      : (memo.current_signer_order === pos.signer.order ? 'bg-green-500' : 'bg-green-200 dark:bg-green-800')
                                  }`}></div>
                                </div>
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-green-200 dark:bg-green-800'}`} />
                              </React.Fragment>
                          ))
                        ) : (
                          <span className={`text-[9px] ${memo.current_signer_order === 5 ? 'text-muted-foreground' : 'text-green-400 dark:text-green-600'}`}>ไม่พบข้อมูลลำดับผู้ลงนาม</span>
                        )
                      )}
                      
                      {/* Connector to final step */}
                      {((memo.signer_list_progress && memo.signer_list_progress.filter(s => s.role !== 'author').length > 0) || 
                        (memo.signature_positions && memo.signature_positions.length > 0)) && (
                        <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-green-200 dark:bg-green-800'}`} />
                      )}
                    </>
                  )}
                  {/* Step 5: เกษียนหนังสือแล้ว - ไม่แสดงถ้าถูกตีกลับ */}
                  {memo.status !== 'draft' && memo.status !== 'rejected' && (
                    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                      <span className={`font-semibold sm:text-[10px] text-[9px] ${
                        memo.current_signer_order === 5 
                          ? 'text-foreground' 
                          : 'text-green-400 dark:text-green-600'
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
                      <Button variant="outline" size="sm" className="h-7 px-2 flex items-center gap-1 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 dark:text-blue-600"
                        onClick={() => {
                          const fileUrl = extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                          navigate('/pdf-just-preview', {
                            state: {
                              fileUrl,
                              fileName: memo.subject || memo.title || 'ไฟล์ PDF',
                              memoId: memo.id
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
                                  navigate(`/task-assignment?documentId=${memo.id}&documentType=doc_receive`);
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
                          const fileUrl = extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path || memo.pdfUrl || memo.pdf_url || memo.fileUrl || memo.file_url || '';
                          navigate('/pdf-just-preview', {
                            state: {
                              fileUrl,
                              fileName: memo.subject || memo.title || 'ไฟล์ PDF',
                              memoId: memo.id
                            }
                          });
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {/* Edit button - Edit metadata (date, subject, doc_number) before managing document */}
                      {(profile?.is_admin || profile?.position === 'clerk_teacher') && memo.current_signer_order === 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 flex items-center border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 dark:bg-amber-950"
                          onClick={() => navigate(`/edit-doc-receive/${memo.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {/* Debug: Check user position */}
                      {(() => {
                        console.log('🔍 Debug DocumentList - User position:', profile?.position, 'Is clerk_teacher:', (profile?.is_admin || profile?.position === 'clerk_teacher'));
                        return null;
                      })()}
                      {((profile?.is_admin || profile?.position === 'clerk_teacher') || isPDFUploadMemo(memo)) && (
                        <div className="relative">
                          {memo.status === 'rejected' ? (
                            /* ปุ่มแก้ไขสำหรับเอกสารที่ถูกตีกลับ */
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 flex items-center gap-1 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 dark:bg-red-950"
                              onClick={() => navigate(`/pdf-signature?edit=${memo.id}`)}
                              title="แก้ไขเอกสารที่ถูกตีกลับ"
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-xs font-medium">แก้ไข</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className={`h-7 px-2 flex items-center gap-1 ${
                                memo.current_signer_order > 1
                                  ? 'border-border text-muted-foreground cursor-not-allowed'
                                  : 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 dark:text-green-600'
                              }`}
                              onClick={() => {
                                if (memo.current_signer_order <= 1) {
                                  const manageRoute = getDocumentManageRoute(memo, memo.id);
                                  console.log('🔍 Navigating to manage route:', manageRoute, 'for memo:', memo.id);
                                  navigate(manageRoute);
                                }
                              }}
                              disabled={memo.current_signer_order > 1}
                              title={memo.current_signer_order > 1 ? 'เอกสารถูกส่งเสนอแล้ว ไม่สามารถจัดการได้' : 'จัดการเอกสาร'}
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-xs font-medium">
                                {memo.current_signer_order > 1 ? 'ส่งเสนอแล้ว' : 'จัดการเอกสาร'}
                              </span>
                            </Button>
                          )}
                          {memo.status === 'draft' && memo.current_signer_order <= 1 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">ใหม่</span>
                          )}
                          {memo.status === 'rejected' && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">ตีกลับ</span>
                          )}
                          {memo.current_signer_order > 1 && memo.current_signer_order < 5 && memo.status !== 'rejected' && (
                            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">เสนอแล้ว</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
            })
          ) : (
            <div className="p-6 text-center text-green-200">
              <FileInput className="h-8 w-8 mx-auto mb-2 text-green-200" />
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
                    className="text-green-400 hover:text-green-600 dark:text-green-400 dark:text-green-600 mt-1 text-xs h-6"
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
          <div className="flex items-center justify-between px-3 py-2 border-t border-green-100 dark:border-green-900 bg-green-50 dark:bg-green-950/50">
            <div className="text-xs text-muted-foreground">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedDocReceive.length)} จาก {filteredAndSortedDocReceive.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-green-200 dark:border-green-800"
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
                className="h-7 w-7 p-0 border-green-200 dark:border-green-800"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      </>
      )}

      {/* Modal ดูรายชื่อผู้รับมอบหมาย */}
      <Dialog open={showAssigneesModal} onOpenChange={setShowAssigneesModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400 dark:text-blue-600" />
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
                    <tr className="border-b bg-muted">
                      <th className="py-2 px-2 text-left font-medium text-muted-foreground w-12">#</th>
                      <th className="py-2 px-2 text-left font-medium text-muted-foreground">ชื่อ</th>
                      <th className="py-2 px-2 text-center font-medium text-muted-foreground w-24">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneesList
                      .slice((assigneesPage - 1) * assigneesPerPage, assigneesPage * assigneesPerPage)
                      .map((assignee, index) => (
                        <tr key={assignee.id} className="border-b hover:bg-muted">
                          <td className="py-2 px-2 text-muted-foreground">
                            {(assigneesPage - 1) * assigneesPerPage + index + 1}
                          </td>
                          <td className="py-2 px-2 text-foreground">{assignee.assignee_name}</td>
                          <td className="py-2 px-2 text-center">
                            <Badge
                              className={`text-[10px] px-1.5 py-0.5 ${
                                assignee.status === 'completed'
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                                  : assignee.status === 'in_progress'
                                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                                  : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
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

export default DocReceiveList;