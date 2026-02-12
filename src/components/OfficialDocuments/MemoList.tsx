import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, AlertCircle, Clock, CheckCircle, XCircle, FileText, Paperclip, Search, ChevronLeft, ChevronRight, RotateCcw, Edit, ChevronDown, ChevronUp, ClipboardCheck, ClipboardList, FileCheck, Trash2, Users } from 'lucide-react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { useSmartRealtime } from '@/hooks/useSmartRealtime';
import { supabase } from '@/integrations/supabase/client';
import { extractPdfUrl } from '@/utils/fileUpload';
import { getDocumentManageRoute, getDocumentEditRoute } from '@/utils/memoUtils';
import { formatThaiDateShort } from '@/utils/dateUtils';
import { useToast } from '@/hooks/use-toast';
import TeamMemberIcon from '@/components/TaskAssignment/TeamMemberIcon';

interface MemoDocument {
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

interface MemoListProps {
  memoList: any[];
  onRefresh?: () => void;
  defaultCollapsed?: boolean;
}

const MemoList: React.FC<MemoListProps> = ({
  memoList = [],
  onRefresh,
  defaultCollapsed = false
}) => {
  const { getPermissions, profile } = useEmployeeAuth();
  const { profiles } = useProfiles();
  const permissions = getPermissions();
  const { updateSingleMemo } = useSmartRealtime();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State สำหรับ collapsible
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // State สำหรับ modal ดูรายชื่อผู้รับมอบหมาย
  const [showAssigneesModal, setShowAssigneesModal] = useState(false);
  const [selectedMemoForAssignees, setSelectedMemoForAssignees] = useState<any>(null);
  const [assigneesList, setAssigneesList] = useState<any[]>([]);
  const [assigneesPage, setAssigneesPage] = useState(1);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const assigneesPerPage = 5;

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
  const [localMemos, setLocalMemos] = useState(memoList);

  // State สำหรับติดตาม memo ที่มี draft report memo
  const [draftReportMemos, setDraftReportMemos] = useState<Record<string, string>>({});

  // State สำหรับติดตาม memo ที่เป็น report memo (linked via task_assignments.report_memo_id)
  const [reportMemoIds, setReportMemoIds] = useState<Set<string>>(new Set());

  // อัพเดท localMemos เมื่อ memoList เปลี่ยน
  useEffect(() => {
    setLocalMemos(memoList);
  }, [memoList]);

  // Fetch draft report memos and identify which memos ARE report memos
  useEffect(() => {
    const fetchReportMemoInfo = async () => {
      if (!localMemos.length) return;

      try {
        const memoIds = localMemos.map(m => m.id);

        // Query 1: Find task_assignments where memo_id is in our list (to find linked report memos)
        const { data: assignmentsByMemoId, error: error1 } = await (supabase as any)
          .from('task_assignments')
          .select('memo_id, report_memo_id')
          .in('memo_id', memoIds)
          .is('deleted_at', null);

        // Query 2: Find task_assignments where report_memo_id is in our list (to identify report memos)
        const { data: assignmentsByReportId, error: error2 } = await (supabase as any)
          .from('task_assignments')
          .select('memo_id, report_memo_id')
          .in('report_memo_id', memoIds)
          .is('deleted_at', null);

        if (error1) {
          console.error('Error fetching task assignments by memo_id:', error1);
        }
        if (error2) {
          console.error('Error fetching task assignments by report_memo_id:', error2);
        }

        // Combine both results
        const assignments = [...(assignmentsByMemoId || []), ...(assignmentsByReportId || [])];

        // Track which memos in our list ARE report memos
        const reportMemoIdsSet = new Set<string>();
        if (assignments?.length) {
          for (const assignment of assignments) {
            if (assignment.report_memo_id && memoIds.includes(assignment.report_memo_id)) {
              reportMemoIdsSet.add(assignment.report_memo_id);
            }
          }
        }
        setReportMemoIds(reportMemoIdsSet);
        console.log('📋 Report memo IDs found:', Array.from(reportMemoIdsSet));

        // Only continue with draft report memo tracking for admin/clerk
        if (!permissions.isAdmin && !permissions.isClerk) return;

        if (!assignments?.length) {
          setDraftReportMemos({});
          return;
        }

        // Get report memo IDs that are linked to memos in our list
        const linkedReportMemoIds = assignments
          .filter(a => a.report_memo_id && memoIds.includes(a.memo_id))
          .map(a => a.report_memo_id)
          .filter(Boolean);

        if (!linkedReportMemoIds.length) {
          setDraftReportMemos({});
          return;
        }

        // Check which report memos are in draft status
        const { data: reportMemos, error: reportMemosError } = await supabase
          .from('memos')
          .select('id, status')
          .in('id', linkedReportMemoIds)
          .eq('status', 'draft');

        if (reportMemosError || !reportMemos?.length) {
          setDraftReportMemos({});
          return;
        }

        // Build mapping: original memo_id -> draft report_memo_id
        const draftReportMap: Record<string, string> = {};
        for (const assignment of assignments) {
          const reportMemo = reportMemos.find(rm => rm.id === assignment.report_memo_id);
          if (reportMemo && assignment.memo_id) {
            draftReportMap[assignment.memo_id] = assignment.report_memo_id;
          }
        }

        setDraftReportMemos(draftReportMap);
      } catch (error) {
        console.error('Error fetching report memo info:', error);
      }
    };

    fetchReportMemoInfo();
  }, [localMemos, permissions.isAdmin, permissions.isClerk]);

  // Setup realtime listeners
  useEffect(() => {
    // Admin หรือ Clerk สามารถ subscribe ได้
    if (!permissions.isAdmin && !permissions.isClerk) {
      return;
    }

    const subscription = (supabase as any)
      .channel('memo-list-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memos',
          filter: profile?.user_id ? `created_by=neq.${profile.user_id}` : undefined,
        },
        async (payload: any) => {
          console.log('🔵 MemoList: Realtime memo change:', payload);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updatedMemo = payload.new;
            setLocalMemos(prevMemos => {
              const existingIndex = prevMemos.findIndex(m => m.id === updatedMemo.id);
              if (existingIndex >= 0) {
                const updated = [...prevMemos];
                updated[existingIndex] = updatedMemo;
                return updated;
              } else {
                return [updatedMemo, ...prevMemos];
              }
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setLocalMemos(prevMemos =>
              prevMemos.filter(memo => memo.id !== deletedId)
            );
          }
        }
      )
      .subscribe();

    return () => {
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
  const handleViewAssignees = async (memo: any) => {
    setSelectedMemoForAssignees(memo);
    setAssigneesPage(1);
    setIsLoadingAssignees(true);
    setShowAssigneesModal(true);

    try {
      // Step 1: Fetch task assignments for this memo
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
        .eq('memo_id', memo.id)
        .eq('document_type', 'memo')
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
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds as string[]);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      }

      // Create a map of user_id to full_name
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

  // กรองเอกสารสำหรับแสดง - Admin และธุรการเห็นทุกเอกสาร
  const shouldShowMemo = (memo: any) => {
    // Admin หรือธุรการเห็นทุกเอกสาร (รวมทั้งของตัวเองด้วย)
    return permissions.isAdmin || permissions.isClerk;
  };

  // ฟังก์ชันกรองและจัดเรียงข้อมูล
  const filteredAndSortedMemos = useMemo(() => {
    let filtered = localMemos.filter(memo => {
      if (memo.doc_del) return false;
      if (!shouldShowMemo(memo)) return false;

      const searchMatch = searchTerm === '' ||
        memo.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.author_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memo.doc_number?.toLowerCase().includes(searchTerm.toLowerCase());

      let statusMatch = true;
      if (statusFilter !== 'all') {
        const signerOrder = memo.current_signer_order;
        switch (statusFilter) {
          case 'draft':
            statusMatch = signerOrder === 1;
            break;
          case 'pending_sign':
            statusMatch = signerOrder >= 2 && signerOrder <= 4;
            break;
          case 'completed':
            statusMatch = signerOrder === 5;
            break;
          case 'rejected':
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

    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'subject':
          aValue = a.subject || '';
          bValue = b.subject || '';
          break;
        case 'status':
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
  }, [localMemos, searchTerm, statusFilter, assignmentFilter, sortBy, sortOrder, profile?.user_id, permissions.position, permissions.isAdmin, permissions.isClerk]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedMemos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedMemos.slice(startIndex, endIndex);

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, assignmentFilter, sortBy, sortOrder]);

  // แสดงเฉพาะ Admin หรือธุรการเท่านั้น
  if (!permissions.isAdmin && !permissions.isClerk) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        className={`bg-amber-500 py-3 px-4 cursor-pointer hover:bg-amber-600 transition-all ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg'}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <FileText className="h-4 w-4 text-amber-100" />
          รายการบันทึกข้อความ
          <Badge variant="secondary" className="ml-auto bg-amber-600 text-white font-semibold px-2 py-1 rounded-full">
            {filteredAndSortedMemos.length > 0 ? `${filteredAndSortedMemos.length} รายการ` : 'ไม่มีเอกสาร'}
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
        <div className="text-sm text-amber-100 font-normal mt-1">
          {isCollapsed ? 'คลิกเพื่อแสดงรายการ' : 'จัดการบันทึกข้อความ ตรวจสอบความถูกต้อง และจัดเส้นทางการอนุมัติ'}
        </div>
      </CardHeader>

      {!isCollapsed && (
      <>
      {/* ส่วนค้นหาและกรอง */}
      <div className="bg-card border-b border-border px-3 py-2">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-foreground" />
            <Input
              placeholder="ค้นหาเอกสาร..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs h-8 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 focus:border-amber-400 focus:ring-amber-400 focus:ring-1"
            />
          </div>

          <div className="w-28">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs border-border focus:border-amber-400">
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
              <SelectTrigger className="h-8 text-xs border-border focus:border-amber-400">
                <SelectValue placeholder="มอบหมาย" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="assigned">มอบหมายแล้ว</SelectItem>
                <SelectItem value="not_assigned">ยังไม่มอบหมาย</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-20">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs border-border focus:border-amber-400">
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-8 w-8 p-0 border-border hover:border-amber-400 hover:text-amber-600 dark:text-amber-400 dark:text-amber-600"
            title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
          >
            <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          </Button>

          {(searchTerm || statusFilter !== 'all' || assignmentFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setAssignmentFilter('all');
              }}
              className="h-8 w-8 p-0 text-foreground hover:text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 dark:bg-amber-950"
              title="ล้างตัวกรอง"
            >
              <span className="text-sm">×</span>
            </Button>
          )}
        </div>

        {(searchTerm || statusFilter !== 'all' || assignmentFilter !== 'all') && (
          <div className="text-[10px] text-foreground mt-1 text-center">
            แสดง {filteredAndSortedMemos.length} จาก {memoList.filter(shouldShowMemo).length} รายการ
          </div>
        )}
      </div>

      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          {currentPageData.length > 0 ? (
            currentPageData.map((memo) => {
              const isCompleted = memo.current_signer_order === 5;
              const baseClasses = "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border rounded-lg px-2 sm:px-3 py-2 shadow-sm transition group min-w-0";
              const completedClasses = isCompleted
                ? "bg-muted dark:bg-background/80 border-border hover:bg-accent dark:hover:bg-card/80"
                : "bg-card border-border hover:bg-muted/50";

              return (
              <div key={memo.id} className={`${baseClasses} ${completedClasses}`}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {/* Icon: FileCheck (teal) for report memo, FileText (amber) for regular memo */}
                  {reportMemoIds.has(memo.id) ? (
                    <FileCheck className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-teal-500'}`} />
                  ) : (
                    <FileText className={`h-4 w-4 flex-shrink-0 ${isCompleted ? 'text-muted-foreground' : 'text-amber-500'}`} />
                  )}
                  <span className={`font-medium truncate max-w-[120px] sm:max-w-[160px] sm:text-base text-sm ${isCompleted ? 'text-muted-foreground group-hover:text-foreground' : reportMemoIds.has(memo.id) ? 'text-teal-700 dark:text-teal-300 group-hover:text-teal-800' : 'text-foreground group-hover:text-amber-700 dark:text-amber-300'}`} title={memo.subject}>{memo.subject}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{(memo.author_name || '-').split(' ')[0]}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatThaiDateShort(memo.created_at)}</span>
                  {memo.doc_number && <span className="text-xs text-muted-foreground whitespace-nowrap">#{memo.doc_number.split('/')[0]}</span>}
                  <span
                    style={{
                      background: memo.current_signer_order === 1 ? '#2563eb' :
                                  memo.current_signer_order >= 2 && memo.current_signer_order <= 4 ? '#f59e42' :
                                  memo.current_signer_order === 5 ? '#16a34a' :
                                  memo.current_signer_order === 0 ? '#ef4444' : '#6b7280',
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

                {/* Progress Stepper - แสดงครบทุกคน (ธุรการ + ผู้ลงนาม) */}
                <div className="flex items-center gap-1 sm:gap-2 ml-2 flex-1 overflow-x-auto">
                  {memo.status === 'draft' ? (
                    <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                      <span className="font-semibold sm:text-[10px] text-[9px] text-amber-700 dark:text-amber-300">รอตรวจทาน</span>
                      <div className="w-2 h-2 rounded-full mt-1 bg-amber-500"></div>
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
                      {/* ธุรการ */}
                      <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                        <span className={`font-semibold sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5
                            ? 'text-muted-foreground'
                            : (memo.current_signer_order === 1 ? 'text-amber-700 dark:text-amber-300' : 'text-amber-400 dark:text-amber-600')
                        }`}>ตรวจทาน/เสนอ</span>
                        <span className={`sm:text-[10px] text-[9px] ${
                          memo.current_signer_order === 5
                            ? 'text-muted-foreground'
                            : (memo.current_signer_order === 1 ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-amber-400 dark:text-amber-600')
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
                            : (memo.current_signer_order === 1 ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800')
                        }`}></div>
                      </div>
                      <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800'}`} />

                      {/* ผู้ลงนามทั้งหมด */}
                      {memo.signer_list_progress && Array.isArray(memo.signer_list_progress) && memo.signer_list_progress.length > 0 ? (
                        memo.signer_list_progress
                          .filter(signer => signer.role !== 'author' && signer.role !== 'clerk')
                          .sort((a, b) => a.order - b.order)
                          .map((signer, idx, arr) => (
                            <React.Fragment key={signer.order}>
                              <div className="flex flex-col items-center min-w-[44px] sm:min-w-[60px]">
                                <span className={`font-semibold sm:text-[10px] text-[9px] ${
                                  memo.current_signer_order === 5
                                    ? 'text-muted-foreground'
                                    : (memo.current_signer_order === signer.order ? 'text-amber-700 dark:text-amber-300' : 'text-amber-400 dark:text-amber-600')
                                }`}>
                                  {(() => {
                                    if (signer.user_id === '28ef1822-628a-4dfd-b7ea-2defa97d755b') {
                                      return 'ผู้อำนวยการ';
                                    }
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
                                    : (memo.current_signer_order === signer.order ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-amber-400 dark:text-amber-600')
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
                                    : (memo.current_signer_order === signer.order ? 'bg-amber-500' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800')
                                }`}></div>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800'}`} />
                              )}
                            </React.Fragment>
                          ))
                      ) : (
                        <span className={`text-[9px] ${memo.current_signer_order === 5 ? 'text-muted-foreground' : 'text-amber-400 dark:text-amber-600'}`}>ไม่พบข้อมูลลำดับผู้ลงนาม</span>
                      )}

                      {/* Connector to final step - ไม่แสดงสำหรับ report memo */}
                      {!reportMemoIds.has(memo.id) && memo.signer_list_progress && memo.signer_list_progress.filter(s => s.role !== 'author' && s.role !== 'clerk').length > 0 && (
                        <div className={`w-4 sm:w-5 h-0.5 mx-0.5 sm:mx-1 ${memo.current_signer_order === 5 ? 'bg-muted' : 'bg-amber-200 dark:bg-amber-800 dark:bg-amber-800'}`} />
                      )}
                    </>
                  )}
                  {/* Step 5: เกษียนหนังสือแล้ว - ไม่แสดงถ้าถูกตีกลับ หรือเป็น report memo */}
                  {memo.status !== 'draft' && memo.status !== 'rejected' && !reportMemoIds.has(memo.id) && (
                    <div className="flex flex-col items-center min-w-[60px] sm:min-w-[80px]">
                      <span className={`font-semibold sm:text-[10px] text-[9px] ${
                        memo.current_signer_order === 5
                          ? 'text-foreground'
                          : 'text-amber-400 dark:text-amber-600'
                      }`}>เกษียนหนังสือแล้ว</span>
                      {memo.current_signer_order === 5 && (
                        <div className="w-2 h-2 rounded-full mt-1 bg-gray-700 dark:bg-gray-300"></div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-1 ml-auto">
                  {/* เมื่อ current_signer_order = 5 (เสร็จสิ้น) */}
                  {memo.current_signer_order === 5 ? (
                    <>
                      {/* ปุ่ม "ดูเอกสาร" - นำไปหน้า document-detail */}
                      <Button variant="outline" size="sm" className={`h-7 px-2 flex items-center gap-1 ${reportMemoIds.has(memo.id) ? 'border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400' : 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'}`}
                        onClick={() => {
                          navigate('/document-detail', {
                            state: {
                              documentId: memo.id,
                              documentType: 'memo'
                            }
                          });
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        {(reportMemoIds.has(memo.id) || memo.is_assigned) && <span className="text-xs font-medium">ดูรายงาน</span>}
                      </Button>
                      {/* ปุ่มมอบหมายงาน/ดูรายชื่อ - แสดงเฉพาะธุรการ และไม่ใช่ report memo */}
                      {(profile?.is_admin || profile?.position === 'clerk_teacher') && !reportMemoIds.has(memo.id) && (
                        <>
                          {!memo.is_assigned ? (
                            <div className="relative">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigate(`/task-assignment?documentId=${memo.id}&documentType=memo`);
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
                      {/* ปุ่มลบ - เฉพาะ report memo */}
                      {(profile?.is_admin || profile?.position === 'clerk_teacher') && reportMemoIds.has(memo.id) && (
                        <Button variant="outline" size="sm" className="h-7 px-2 flex items-center border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => {
                            // TODO: Implement delete functionality
                            console.log('Delete report memo:', memo.id);
                          }}
                          title="ลบรายงาน"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* ปุ่มดูปกติสำหรับสถานะอื่นๆ */}
                      <Button variant="outline" size="sm" className="h-7 px-2 flex items-center border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 dark:text-blue-600"
                        onClick={() => {
                          const fileUrl = extractPdfUrl(memo.pdf_draft_path) || memo.pdf_draft_path || '';
                          navigate('/pdf-just-preview', {
                            state: {
                              fileUrl,
                              fileName: memo.subject || 'ไฟล์ PDF',
                              memoId: memo.id
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
                          <Button variant="outline" size="sm" className={`h-7 px-2 flex items-center gap-1 ${memo.status === 'rejected' ? 'border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950' : (reportMemoIds.has(memo.id) ? 'border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400' : 'border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400')}`}
                            onClick={() => {
                              if (reportMemoIds.has(memo.id)) {
                                // Navigate to create report memo page with edit mode
                                navigate(`/create-report-memo?edit=${memo.id}`);
                              } else {
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
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-white z-10">ตีกลับ</span>
                          )}
                        </div>
                      )}

                      {/* จัดการเอกสาร/จัดการรายงาน button - only for clerk_teacher and not yet proposed */}
                      {(profile?.is_admin || profile?.position === 'clerk_teacher') && (
                        <div className="relative">
                          {(() => {
                            const isReportMemo = reportMemoIds.has(memo.id);
                            const buttonColor = isReportMemo
                              ? (memo.current_signer_order > 1 ? 'border-border text-muted-foreground cursor-not-allowed' : 'border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400')
                              : (memo.current_signer_order > 1 ? 'border-border text-muted-foreground cursor-not-allowed' : 'border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 dark:text-amber-600');
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
                                      // Navigate to manage report memo page
                                      navigate(`/manage-report-memo/${memo.id}`);
                                    } else {
                                      const manageRoute = getDocumentManageRoute(memo, memo.id);
                                      navigate(manageRoute);
                                    }
                                  }
                                }}
                                disabled={memo.status === 'rejected' || memo.current_signer_order > 1}
                                title={buttonTitle}
                              >
                                <IconComponent className="h-4 w-4" />
                                <span className="text-xs font-medium">{buttonText}</span>
                              </Button>
                            );
                          })()}
                          {memo.status === 'draft' && memo.current_signer_order <= 1 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">ใหม่</span>
                          )}
                          {memo.current_signer_order > 1 && memo.current_signer_order < 5 && (
                            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">เสนอแล้ว</span>
                          )}
                        </div>
                      )}

                      {/* จัดการรายงาน button - แสดงเมื่อมี report memo ที่ status = draft */}
                      {(profile?.is_admin || profile?.position === 'clerk_teacher') && draftReportMemos[memo.id] && (
                        <div className="relative">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 flex items-center gap-1 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400"
                            onClick={() => navigate(`/manage-report-memo/${draftReportMemos[memo.id]}`)}
                            title="จัดการรายงานที่ส่งมา"
                          >
                            <ClipboardCheck className="h-4 w-4" />
                            <span className="text-xs font-medium">จัดการรายงาน</span>
                          </Button>
                          <span className="absolute -top-2 -right-2 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">ใหม่</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
            })
          ) : (
            <div className="p-6 text-center text-amber-200">
              <FileText className="h-8 w-8 mx-auto mb-2 text-amber-200" />
              <p className="text-sm">ไม่มีบันทึกข้อความในระบบ</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-amber-100 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50">
            <div className="text-xs text-muted-foreground">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedMemos.length)} จาก {filteredAndSortedMemos.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-amber-200 dark:border-amber-800"
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
                className="h-7 w-7 p-0 border-amber-200 dark:border-amber-800"
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
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-amber-600" />
              รายชื่อผู้รับมอบหมาย
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 flex-1 overflow-y-auto min-h-0">
            {isLoadingAssignees ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-8 w-8 text-amber-500" viewBox="0 0 24 24">
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

export default MemoList;
