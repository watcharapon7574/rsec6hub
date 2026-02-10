import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Eye, Calendar, User, Clock, CheckCircle, PlayCircle, XCircle, FileText, ClipboardList, RotateCcw, ChevronDown, ChevronUp, MapPin, Users, Settings2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssignedTasks } from '@/hooks/useAssignedTasks';
import { TaskStatus, TaskAssignmentWithDetails, taskAssignmentService, TeamMember, AssignmentSource } from '@/services/taskAssignmentService';
import { extractPdfUrl } from '@/utils/fileUpload';
import { supabase } from '@/integrations/supabase/client';
import TeamManagementModal from '@/components/TaskAssignment/TeamManagementModal';
import TeamMemberIcon from '@/components/TaskAssignment/TeamMemberIcon';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Assignee {
  id: string;
  assigned_to_name: string;
  status: string;
  assigned_at: string;
  is_team_leader: boolean;
  is_reporter: boolean;
}

interface AssignedDocumentsListProps {
  defaultCollapsed?: boolean;
}

const AssignedDocumentsList: React.FC<AssignedDocumentsListProps> = ({ defaultCollapsed = true }) => {
  const navigate = useNavigate();
  const { tasks, loading, updateTaskStatus, fetchTasks } = useAssignedTasks();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // State สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);

  // ฟังก์ชันกรองและจัดเรียงข้อมูล
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      // ค้นหาตามชื่อเอกสาร, ผู้มอบหมาย
      const searchMatch = searchTerm === '' ||
        task.document_subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assigned_by_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.task_description?.toLowerCase().includes(searchTerm.toLowerCase());

      // กรองตามสถานะ
      let statusMatch = true;
      if (statusFilter !== 'all') {
        statusMatch = task.status === statusFilter;
      }

      // กรองตามประเภทเอกสาร
      let typeMatch = true;
      if (typeFilter !== 'all') {
        typeMatch = task.document_type === typeFilter;
      }

      return searchMatch && statusMatch && typeMatch;
    });

    // จัดเรียงข้อมูล
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'document_subject':
          aValue = a.document_subject || '';
          bValue = b.document_subject || '';
          break;
        case 'status':
          const statusOrder: Record<string, number> = { pending: 0, in_progress: 1, completed: 2, cancelled: 3 };
          aValue = statusOrder[a.status] ?? 99;
          bValue = statusOrder[b.status] ?? 99;
          break;
        case 'assigned_at':
          aValue = new Date(a.assigned_at || 0).getTime();
          bValue = new Date(b.assigned_at || 0).getTime();
          break;
        case 'updated_at':
        default:
          aValue = new Date(a.updated_at || a.assigned_at || 0).getTime();
          bValue = new Date(b.updated_at || b.assigned_at || 0).getTime();
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return filtered;
  }, [tasks, searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageTasks = filteredAndSortedTasks.slice(startIndex, endIndex);

  // Handle manual refresh
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchTasks();
    } finally {
      setIsRefreshing(false);
    }
  };
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIsReporter, setSelectedTaskIsReporter] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // State for assignees dialog
  const [assigneesDialogOpen, setAssigneesDialogOpen] = useState(false);
  const [assigneesList, setAssigneesList] = useState<Assignee[]>([]);
  const [selectedDocumentSubject, setSelectedDocumentSubject] = useState('');
  const [loadingAssignees, setLoadingAssignees] = useState(false);

  // State for team management modal
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [teamModalTask, setTeamModalTask] = useState<TaskAssignmentWithDetails | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Fetch all assignees for a document
  const fetchAssignees = async (documentId: string, documentType: string, subject: string) => {
    setLoadingAssignees(true);
    setSelectedDocumentSubject(subject);
    setAssigneesDialogOpen(true);

    try {
      const column = documentType === 'memo' ? 'memo_id' : 'doc_receive_id';
      const { data: assignments, error } = await (supabase as any)
        .from('task_assignments')
        .select('id, assigned_to, status, assigned_at, is_team_leader, is_reporter')
        .eq(column, documentId)
        .is('deleted_at', null)
        .order('is_team_leader', { ascending: false }) // หัวหน้าทีมขึ้นก่อน
        .order('is_reporter', { ascending: false }) // ผู้รายงานถัดมา
        .order('assigned_at', { ascending: true });

      if (error) throw error;

      // Get unique user IDs
      const userIds = Array.from(new Set((assignments || []).map((a: any) => String(a.assigned_to)))).filter(Boolean) as string[];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, `${p.first_name} ${p.last_name}`]) || []);

      const assignees: Assignee[] = (assignments || []).map(a => ({
        id: a.id,
        assigned_to_name: profileMap.get(a.assigned_to) || 'Unknown',
        status: a.status,
        assigned_at: a.assigned_at,
        is_team_leader: a.is_team_leader || false,
        is_reporter: a.is_reporter || false
      }));

      setAssigneesList(assignees);
    } catch (error) {
      console.error('Error fetching assignees:', error);
      setAssigneesList([]);
    } finally {
      setLoadingAssignees(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear() + 543; // Convert to Buddhist year
    return `${day}/${month}/${year}`;
  };

  // Format event date (YYYY-MM-DD format from DB)
  const formatEventDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${day}/${month}`;
  };

  const getFirstName = (fullName: string) => {
    return fullName.split(' ')[0];
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getStatusConfig = (status: TaskStatus) => {
    const configs = {
      pending: {
        label: 'รอดำเนินการ',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        icon: Clock,
      },
      in_progress: {
        label: 'กำลังดำเนินการ',
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        icon: PlayCircle,
      },
      completed: {
        label: 'เสร็จสิ้น',
        color: 'bg-green-100 text-green-700 border-green-300',
        icon: CheckCircle,
      },
      cancelled: {
        label: 'ยกเลิก',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        icon: XCircle,
      },
    };
    return configs[status];
  };

  const handleViewDocument = (task: TaskAssignmentWithDetails) => {
    navigate('/document-detail', {
      state: {
        documentId: task.document_id,
        documentType: task.document_type,
        // Role info for visibility control
        isTeamLeader: task.is_team_leader,
        currentUserId: task.assigned_to_id,
      },
    });
  };

  const handleUpdateStatus = async (assignmentId: string, newStatus: TaskStatus) => {
    try {
      await updateTaskStatus(assignmentId, newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Handle "ทราบ" button
  // For team leaders: open modal to select reporters
  // For non-leaders: just update status to in_progress
  const handleAcknowledge = async (task: TaskAssignmentWithDetails) => {
    // If this is a team leader, open the team management modal
    // to let them select reporters before acknowledging
    if (task.is_team_leader) {
      await handleManageTeam(task);
      return;
    }

    // For non-leaders, just update status
    try {
      await updateTaskStatus(task.assignment_id, 'in_progress');

      toast({
        title: 'รับทราบงานสำเร็จ',
        description: 'งานถูกเปลี่ยนสถานะเป็น "กำลังดำเนินการ"',
      });

      await fetchTasks();
    } catch (error: any) {
      console.error('Error acknowledging task:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถรับทราบงานได้',
        variant: 'destructive',
      });
    }
  };

  // Handle team management modal confirmation
  const handleTeamConfirm = async (
    reporterIds: string[],
    newTeamMembers?: { userId: string; isReporter: boolean }[]
  ) => {
    if (!teamModalTask) return;

    try {
      // Check if this is first acknowledgement (pending) or update (in_progress)
      if (teamModalTask.status === 'pending') {
        // First time: acknowledge and set reporters
        await taskAssignmentService.acknowledgeTask(teamModalTask.assignment_id, {
          reporterIds,
          teamMembers: newTeamMembers
        });

        toast({
          title: 'รับทราบงานสำเร็จ',
          description: 'งานถูกเปลี่ยนสถานะเป็น "กำลังดำเนินการ"',
        });
      } else {
        // Already in progress: just update reporters and add new members
        await taskAssignmentService.updateTeamAndReporters(teamModalTask.assignment_id, {
          reporterIds,
          newTeamMembers
        });

        toast({
          title: 'อัปเดตทีมสำเร็จ',
          description: 'แก้ไขข้อมูลผู้รายงานเรียบร้อยแล้ว',
        });
      }

      // Refresh tasks
      await fetchTasks();
    } catch (error: any) {
      console.error('Error handling team confirmation:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถดำเนินการได้',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Handle "จัดการทีม" button - opens team management modal
  const handleManageTeam = async (task: TaskAssignmentWithDetails) => {
    // Fetch team members for this assignment
    try {
      const members = await taskAssignmentService.getTeamMembers(task.assignment_id);
      setTeamMembers(members);
      setTeamModalTask(task);
      setTeamModalOpen(true);
    } catch (error) {
      console.error('Error fetching team members:', error);
      // Fallback: if we can't get team members, use default with current user
      setTeamMembers([{
        assignment_id: task.assignment_id,
        user_id: task.assigned_to_id,
        first_name: task.assigned_to_name.split(' ')[0] || '',
        last_name: task.assigned_to_name.split(' ').slice(1).join(' ') || '',
        position: '',
        is_team_leader: true,
        is_reporter: false,
        status: task.status
      }]);
      setTeamModalTask(task);
      setTeamModalOpen(true);
    }
  };

  const handleCompleteClick = (assignmentId: string, isReporter: boolean) => {
    setSelectedTaskId(assignmentId);
    setSelectedTaskIsReporter(isReporter);
    setCompletionNote('');
    setReportFile(null);
    setCompletionDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setReportFile(file);
    } else if (file) {
      alert('กรุณาเลือกไฟล์ PDF เท่านั้น');
      e.target.value = '';
    }
  };

  const handleConfirmComplete = async () => {
    if (!selectedTaskId) return;
    if (!completionNote.trim()) {
      alert('กรุณากรอกรายงานผลการปฏิบัติงาน');
      return;
    }
    // If reporter, file is required
    if (selectedTaskIsReporter && !reportFile) {
      alert('ผู้รายงานต้องแนบไฟล์เอกสาร');
      return;
    }

    setIsUploading(true);

    try {
      let reportFileUrl = null;

      // Upload PDF file if provided
      if (reportFile) {
        const { supabase } = await import('@/integrations/supabase/client');
        const fileName = `task_report_${selectedTaskId}_${Date.now()}.pdf`;
        const filePath = `task_reports/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, reportFile, {
            contentType: 'application/pdf',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading report file:', uploadError);
          alert('เกิดข้อผิดพลาดในการอัปโหลดไฟล์รายงาน');
          setIsUploading(false);
          return;
        }

        if (uploadData?.path) {
          const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(uploadData.path);

          reportFileUrl = publicUrl;
        }
      }

      // Combine completion note with file URL if exists
      const finalCompletionNote = reportFileUrl
        ? `${completionNote}\n\nไฟล์รายงาน: ${reportFileUrl}`
        : completionNote;

      await updateTaskStatus(selectedTaskId, 'completed', finalCompletionNote);

      setCompletionDialogOpen(false);
      setSelectedTaskId(null);
      setCompletionNote('');
      setReportFile(null);
    } catch (error) {
      console.error('Error completing task:', error);
      alert('เกิดข้อผิดพลาดในการรายงานผลงาน');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        className={`bg-teal-50 border-b border-teal-100 py-3 px-4 cursor-pointer hover:bg-teal-100/60 transition-all ${isCollapsed ? 'rounded-lg' : 'rounded-t-lg'}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <CardTitle className="flex items-center gap-2 text-base text-teal-800">
          <div className="p-1.5 rounded-lg bg-teal-200/60">
            <ClipboardList className="h-4 w-4 text-teal-700" />
          </div>
          งานที่ได้รับมอบหมาย
          <Badge variant="secondary" className="ml-auto bg-teal-200/60 text-teal-800 font-semibold px-2 py-1 rounded-full">
            {filteredAndSortedTasks.length > 0 ? `${filteredAndSortedTasks.length} รายการ` : 'ไม่มีงาน'}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            disabled={isRefreshing || loading}
            className="ml-2 p-1 h-8 w-8 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          {/* Toggle button - prominent style */}
          <div className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors">
            {isCollapsed ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardTitle>
        <div className="text-sm text-muted-foreground font-normal mt-1">
          {isCollapsed ? 'คลิกเพื่อแสดงรายการ' : 'รายการงานที่ได้รับมอบหมายจากเอกสารราชการ'}
        </div>
      </CardHeader>

      {!isCollapsed && (
      <>
      {/* ส่วนค้นหาและกรอง - แถวเดียวแนวนอน */}
      <div className="bg-white border-b border-teal-100 px-3 py-2">
        <div className="flex gap-2 items-center">
          {/* ช่องค้นหา */}
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
            <Input
              placeholder="ค้นหางาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs h-8 border-gray-200 focus:border-teal-400 focus:ring-teal-400 focus:ring-1"
            />
          </div>

          {/* ตัวกรองตามสถานะ */}
          <div className="w-32">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-teal-400">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
                <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                <SelectItem value="cancelled">ยกเลิก</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ตัวกรองตามประเภทเอกสาร */}
          <div className="w-28">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-teal-400">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภท</SelectItem>
                <SelectItem value="memo">บันทึกข้อความ</SelectItem>
                <SelectItem value="doc_receive">หนังสือรับ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* การจัดเรียง */}
          <div className="w-20">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs border-gray-200 focus:border-teal-400">
                <SelectValue placeholder="เรียง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">ล่าสุด</SelectItem>
                <SelectItem value="assigned_at">วันที่มอบหมาย</SelectItem>
                <SelectItem value="document_subject">ชื่อ</SelectItem>
                <SelectItem value="status">สถานะ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ปุ่มเปลี่ยนทิศทางการเรียง */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="h-8 w-8 p-0 border-gray-200 hover:border-teal-400 hover:text-teal-600"
            title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
          >
            <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          </Button>

          {/* ปุ่มล้างตัวกรอง */}
          {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
              className="h-8 w-8 p-0 text-gray-400 hover:text-teal-600 hover:bg-teal-50"
              title="ล้างตัวกรอง"
            >
              <span className="text-sm">×</span>
            </Button>
          )}
        </div>

        {/* แสดงจำนวนผลลัพธ์ */}
        {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
          <div className="text-[10px] text-gray-500 mt-1 text-center">
            แสดง {filteredAndSortedTasks.length} จาก {tasks.length} รายการ
          </div>
        )}
      </div>
      <CardContent className="p-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-3"></div>
            <div className="text-muted-foreground text-sm">กำลังโหลดรายการงาน...</div>
          </div>
        ) : filteredAndSortedTasks.length === 0 ? (
          <div className="text-center py-6 text-teal-300">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-60" />
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' ? (
              <div>
                <p className="text-sm font-medium">ไม่พบงานที่ตรงกับเงื่อนไข</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                  className="text-teal-400 hover:text-teal-600 mt-1 text-xs h-6"
                >
                  ล้างตัวกรอง
                </Button>
              </div>
            ) : (
              <p className="text-sm font-medium">ไม่มีงานที่ได้รับมอบหมาย</p>
            )}
          </div>
        ) : (
        <div className="space-y-2">
      {currentPageTasks.map((task) => {
        const statusConfig = getStatusConfig(task.status);
        const StatusIcon = statusConfig.icon;

        return (
          <Card
            key={task.assignment_id}
            className="bg-white border border-border/50 hover:shadow-sm transition-all duration-200"
          >
            <CardContent className="p-2.5">
              {/* แถวเดียว: เหมือน DocumentList */}
              <div className="flex items-center justify-between">
                {/* ส่วนซ้าย: เหมือน DocumentList - gap-2 */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {/* Status Icon */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${statusConfig.color}`}>
                    <StatusIcon className="h-3 w-3" />
                  </div>

                  {/* ชื่อเอกสาร */}
                  <span className="font-medium truncate max-w-[120px] sm:max-w-[160px] sm:text-base text-sm">
                    {task.document_subject}
                  </span>

                  {/* ผู้เขียนหนังสือ (ชื่อแรก) */}
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {getFirstName(task.assigned_by_name)}
                  </span>

                  {/* วันที่มอบหมาย */}
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(task.assigned_at)}
                  </span>

                  {/* เวลา/สถานที่ของงาน */}
                  {(task.event_time || task.location) && (
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-pink-600 bg-pink-50 border border-pink-200 rounded-md px-2 py-0.5">
                      {task.event_time && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {task.event_time}
                        </span>
                      )}
                      {task.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {truncateText(task.location, 10)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* รายละเอียดงาน (task_description) - แสดง 40 ตัวอักษร */}
                  {task.task_description && (
                    <div className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-md px-2.5 py-1">
                      <ClipboardList className="h-3 w-3 text-purple-600 flex-shrink-0" />
                      <span className="text-xs text-purple-700 truncate max-w-[150px] font-medium">
                        {truncateText(task.task_description, 40)}
                      </span>
                    </div>
                  )}

                  {/* รายงานผล (completion_note) */}
                  {task.completion_note && (
                    <div className="hidden lg:flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-md px-2.5 py-1">
                      <span className="text-[10px] font-medium text-green-700">✓</span>
                      <span className="text-xs text-green-800 truncate max-w-[100px] font-medium">
                        {truncateText(task.completion_note, 25)}
                      </span>
                    </div>
                  )}
                </div>

                {/* ส่วนขวา: ปุ่มทั้งหมดติดกัน */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {/* ปุ่มดูเอกสาร - แสดงทุกสถานะ */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewDocument(task)}
                    className="h-7 w-7 p-0"
                    title="ดูเอกสาร"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  {/* ปุ่มดูรายชื่อผู้รับมอบหมาย */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchAssignees(task.document_id, task.document_type, task.document_subject)}
                    className="h-7 w-7 p-0"
                    title="ดูรายชื่อ"
                  >
                    <Users className="h-4 w-4" />
                  </Button>

                  {/* ปุ่มตามสถานะ */}
                  {task.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleAcknowledge(task)}
                      className="h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-700"
                    >
                      <PlayCircle className="h-3.5 w-3.5 mr-1" />
                      ทราบ
                    </Button>
                  )}

                  {task.status === 'in_progress' && (
                    <>
                      {/* ปุ่มจัดการทีม - เฉพาะ is_team_leader และ assignment_source = 'position' */}
                      {task.is_team_leader && task.assignment_source === 'position' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManageTeam(task)}
                          className="h-7 text-xs px-2.5 border-orange-300 text-orange-600 hover:bg-orange-50"
                        >
                          <Settings2 className="h-3.5 w-3.5 mr-1" />
                          จัดการทีม
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleCompleteClick(task.assignment_id, task.is_reporter || false)}
                        className="h-7 text-xs px-2.5 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        รายงาน
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
        </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-teal-100">
            <div className="text-xs text-gray-600">
              แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedTasks.length)} จาก {filteredAndSortedTasks.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-teal-200"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronDown className="h-3 w-3 rotate-90" />
              </Button>
              <span className="text-xs text-gray-600 px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 border-teal-200"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronUp className="h-3 w-3 rotate-90" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      </>
      )}

      {/* Completion Note Dialog */}
      <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>✅ รายงานผล</DialogTitle>
            <DialogDescription>
              กรุณากรอกรายงานผลการดำเนินการหรือบันทึกสรุปงาน
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="completion-note" className="text-base font-medium">
                รายงานผลการดำเนินการ <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="completion-note"
                placeholder="ระบุรายละเอียดผลการดำเนินการ เช่น สรุปงานที่ทำ ผลลัพธ์ที่ได้ หรือปัญหาที่พบ..."
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                rows={8}
                className="resize-none border-2 focus:border-blue-400"
              />
              <p className="text-xs text-gray-500">
                รายงานนี้จะถูกบันทึกเพื่อตรวจสอบ กรุณากรอกให้ครบถ้วน
              </p>
            </div>

            {/* แสดงส่วนแนบไฟล์เฉพาะผู้รายงาน */}
            {selectedTaskIsReporter && (
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="report-file" className="text-sm font-medium flex items-center gap-2">
                  📎 แนบไฟล์เอกสาร <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  💡 คุณเป็นผู้รายงาน ต้องแนบไฟล์รายงาน
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors">
                  <input
                    id="report-file"
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-600
                      file:mr-4 file:py-2.5 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-600 file:text-white
                      hover:file:bg-blue-700
                      file:cursor-pointer
                      cursor-pointer"
                  />
                  {reportFile && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700 flex items-center gap-2 font-medium">
                        <CheckCircle className="h-4 w-4" />
                        ไฟล์ที่เลือก: {reportFile.name}
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        ขนาด: {(reportFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCompletionDialogOpen(false);
                setCompletionNote('');
                setReportFile(null);
              }}
              disabled={isUploading}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirmComplete}
              disabled={!completionNote.trim() || isUploading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  กำลังรายงาน...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  รายงาน
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignees Dialog */}
      <Dialog open={assigneesDialogOpen} onOpenChange={setAssigneesDialogOpen}>
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-600 flex-shrink-0" />
              <span>รายชื่อผู้รับมอบหมาย</span>
            </DialogTitle>
            <DialogDescription className="line-clamp-2 text-sm">
              {selectedDocumentSubject}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 flex-1 overflow-y-auto min-h-0">
            {loadingAssignees ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-8 w-8 text-teal-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
            ) : assigneesList.length === 0 ? (
              <p className="text-center text-gray-500 py-4">ไม่พบข้อมูลผู้รับมอบหมาย</p>
            ) : (
              <div className="space-y-2">
                {assigneesList.map((assignee) => (
                  <div
                    key={assignee.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Role Icon */}
                      <TeamMemberIcon
                        isLeader={assignee.is_team_leader}
                        isReporter={assignee.is_reporter}
                        size="sm"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-gray-800 text-sm truncate">{assignee.assigned_to_name}</span>
                        {/* Role badges */}
                        <div className="flex gap-1">
                          {assignee.is_team_leader && (
                            <span className="text-[10px] text-amber-600 font-medium">หัวหน้า</span>
                          )}
                          {assignee.is_reporter && (
                            <span className="text-[10px] text-pink-600 font-medium">
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
                          ? 'bg-green-100 text-green-700'
                          : assignee.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {assignee.status === 'completed' ? 'เสร็จ' : assignee.status === 'in_progress' ? 'กำลังทำ' : 'รอ'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button variant="outline" onClick={() => setAssigneesDialogOpen(false)} className="w-full sm:w-auto">
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Management Modal */}
      {teamModalTask && (
        <TeamManagementModal
          open={teamModalOpen}
          onClose={() => {
            setTeamModalOpen(false);
            setTeamModalTask(null);
          }}
          assignmentId={teamModalTask.assignment_id}
          assignmentSource={(teamModalTask.assignment_source || 'name') as AssignmentSource}
          positionName={teamModalTask.position_name || undefined}
          currentUserId={currentUserId}
          existingTeam={teamMembers}
          onConfirm={handleTeamConfirm}
        />
      )}
    </Card>
  );
};

export default AssignedDocumentsList;
