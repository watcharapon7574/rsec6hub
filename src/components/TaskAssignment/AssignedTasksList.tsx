import React, { useState, useMemo } from 'react';
import { FileText, User, Calendar, CheckCircle, Clock, XCircle, PlayCircle, Eye, Search, ChevronLeft, ChevronRight, Upload, X, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAssignedTasks } from '@/hooks/useAssignedTasks';
import { TaskStatus } from '@/services/taskAssignmentService';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const AssignedTasksList = () => {
  const navigate = useNavigate();
  const { tasks, loading, updateTaskStatus, pendingCount, fetchTasks } = useAssignedTasks();

  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<TaskStatus>('in_progress');
  const [completionNote, setCompletionNote] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // State สำหรับการค้นหาและกรอง
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [sortBy, setSortBy] = useState<'assigned_at' | 'document_subject'>('assigned_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // State สำหรับ pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status config
  const getStatusConfig = (status: TaskStatus) => {
    const configs = {
      pending: {
        label: 'รอดำเนินการ',
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:border-yellow-800',
        icon: Clock,
      },
      in_progress: {
        label: 'กำลังดำเนินการ',
        color: 'bg-blue-100 text-blue-700 border-blue-200 dark:border-blue-800',
        icon: PlayCircle,
      },
      completed: {
        label: 'เสร็จสิ้น',
        color: 'bg-green-100 text-green-700 border-green-200 dark:border-green-800',
        icon: CheckCircle,
      },
      cancelled: {
        label: 'ยกเลิก',
        color: 'bg-muted text-foreground border-border',
        icon: XCircle,
      },
    };
    return configs[status];
  };

  // กรองและจัดเรียงข้อมูล
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...tasks];

    // กรองตามคำค้นหา
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(task =>
        task.document_subject?.toLowerCase().includes(search) ||
        task.document_number?.toLowerCase().includes(search) ||
        task.assigned_by_name?.toLowerCase().includes(search)
      );
    }

    // กรองตามสถานะ
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // จัดเรียง
    filtered.sort((a, b) => {
      let aValue, bValue;

      if (sortBy === 'document_subject') {
        aValue = a.document_subject || '';
        bValue = b.document_subject || '';
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
      } else {
        // sort by assigned_at
        aValue = new Date(a.assigned_at || 0).getTime();
        bValue = new Date(b.assigned_at || 0).getTime();
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return filtered;
  }, [tasks, searchTerm, statusFilter, sortBy, sortOrder]);

  // คำนวณข้อมูลสำหรับ pagination
  const totalPages = Math.ceil(filteredAndSortedTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = filteredAndSortedTasks.slice(startIndex, endIndex);

  // Reset หน้าเมื่อข้อมูลเปลี่ยน
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  // Open status update dialog
  const handleOpenStatusDialog = (task: any, status: TaskStatus) => {
    setSelectedTask(task);
    setNewStatus(status);
    setCompletionNote('');
    setReportFile(null);
    setShowStatusDialog(true);
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // ตรวจสอบขนาดไฟล์ (จำกัดที่ 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('ไฟล์มีขนาดใหญ่เกิน 10MB');
        return;
      }
      setReportFile(file);
    }
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setReportFile(null);
  };

  // Update task status
  const handleUpdateStatus = async () => {
    if (!selectedTask) return;

    setUpdatingStatus(true);

    try {
      let reportFileUrl: string | undefined;

      // อัปโหลดไฟล์รายงานถ้ามี
      if (reportFile && newStatus === 'completed') {
        const fileName = `${Date.now()}_${reportFile.name}`;
        const filePath = `task_reports/${selectedTask.assignment_id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, reportFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`ไม่สามารถอัปโหลดไฟล์ได้: ${uploadError.message}`);
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        reportFileUrl = publicUrlData.publicUrl;
      }

      // อัปเดตสถานะและบันทึก URL ไฟล์
      await updateTaskStatus(
        selectedTask.assignment_id,
        newStatus,
        completionNote || undefined,
        reportFileUrl
      );

      setShowStatusDialog(false);
      setSelectedTask(null);
      setCompletionNote('');
      setReportFile(null);
    } catch (error: any) {
      console.error('Error updating status:', error);
      alert(error.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Navigate to document view
  const handleViewDocument = (documentId: string, documentType: string) => {
    if (documentType === 'memo') {
      navigate(`/pdf-signature?memoId=${documentId}`);
    } else {
      navigate(`/pdf-signature?docReceiveId=${documentId}`);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">กำลังโหลดรายการงาน...</div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="bg-card border border-border">
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">ไม่มีงานที่ได้รับมอบหมาย</h3>
            <p className="text-sm">คุณยังไม่มีงานที่ต้องดำเนินการ</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      {pendingCount > 0 && (
        <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200 dark:border-orange-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium text-foreground">
                    มีงานรอดำเนินการ {pendingCount} รายการ
                  </div>
                  <div className="text-sm text-muted-foreground">
                    กรุณาตรวจสอบและดำเนินการให้เรียบร้อย
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="flex gap-2 items-center">
            {/* ช่องค้นหา */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหางาน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>

            {/* ตัวกรองตามสถานะ */}
            <div className="w-40">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="pending">รอดำเนินการ</SelectItem>
                  <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
                  <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                  <SelectItem value="cancelled">ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* การจัดเรียง */}
            <div className="w-32">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="เรียง" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assigned_at">วันที่</SelectItem>
                  <SelectItem value="document_subject">ชื่อ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ปุ่มเปลี่ยนทิศทางการเรียง */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="h-9 w-9 p-0"
              title={sortOrder === 'asc' ? 'เรียงจากน้อยไปมาก' : 'เรียงจากมากไปน้อย'}
            >
              <span className="text-sm">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            </Button>

            {/* ปุ่มล้างตัวกรอง */}
            {(searchTerm || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="h-9 w-9 p-0"
                title="ล้างตัวกรอง"
              >
                <span className="text-lg">×</span>
              </Button>
            )}

            {/* ปุ่มรีเฟรช */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="h-9 w-9 p-0"
              title="รีเฟรชข้อมูล"
            >
              <RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* แสดงจำนวนผลลัพธ์ */}
          {(searchTerm || statusFilter !== 'all') && (
            <div className="text-xs text-muted-foreground mt-2 text-center">
              แสดง {filteredAndSortedTasks.length} จาก {tasks.length} รายการ
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task List */}
      {currentPageData.length > 0 ? (
        currentPageData.map((task) => {
          const statusConfig = getStatusConfig(task.status);
          const StatusIcon = statusConfig.icon;

          return (
            <Card
              key={task.assignment_id}
              className="bg-card border border-border hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <h3 className="font-semibold text-lg text-foreground truncate">
                          {task.document_subject}
                        </h3>
                      </div>

                      {task.document_number && (
                        <p className="text-sm text-muted-foreground mb-1">
                          เลขที่: {task.document_number}
                        </p>
                      )}

                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>มอบหมายโดย: {task.assigned_by_name}</span>
                      </div>
                    </div>

                    <Badge className={`${statusConfig.color} flex items-center space-x-1 px-3 py-1`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span>{statusConfig.label}</span>
                    </Badge>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>มอบหมายเมื่อ: {formatDate(task.assigned_at)}</span>
                    </div>

                    {task.completed_at && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        <span>เสร็จสิ้นเมื่อ: {formatDate(task.completed_at)}</span>
                      </div>
                    )}

                    {task.note && (
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground mb-1">
                          💬 หมายเหตุจากผู้มอบหมาย
                        </div>
                        <div className="text-sm text-foreground">{task.note}</div>
                      </div>
                    )}

                    {task.completion_note && (
                      <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground mb-1">
                          ✅ หมายเหตุการดำเนินการ
                        </div>
                        <div className="text-sm text-foreground">{task.completion_note}</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDocument(task.document_id, task.document_type)}
                      className="text-xs w-8 h-8 p-0"
                      title="ดูเอกสาร"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {task.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenStatusDialog(task, 'in_progress')}
                        className="text-xs"
                      >
                        <PlayCircle className="h-3.5 w-3.5 mr-1" />
                        ทราบ
                      </Button>
                    )}

                    {task.status === 'in_progress' && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenStatusDialog(task, 'completed')}
                        className="text-xs bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        รายงาน
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card className="bg-card border border-border">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">ไม่พบงานที่ค้นหา</h3>
              <p className="text-sm">ลองปรับเปลี่ยนคำค้นหาหรือตัวกรอง</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="bg-card border border-border">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                แสดง {startIndex + 1}-{Math.min(endIndex, filteredAndSortedTasks.length)} จาก {filteredAndSortedTasks.length} รายการ
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Update Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newStatus === 'in_progress' ? 'ทราบแล้ว' : 'รายงานผล'}
            </DialogTitle>
            <DialogDescription>
              {newStatus === 'in_progress'
                ? 'ยืนยันการรับทราบงานนี้'
                : 'กรุณาระบุรายละเอียดการรายงานผล'}
            </DialogDescription>
          </DialogHeader>

          {newStatus === 'completed' && (
            <div className="py-4 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  หมายเหตุการดำเนินการ (ถ้ามี)
                </label>
                <Textarea
                  placeholder="ระบุรายละเอียดการดำเนินการ..."
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  แนบไฟล์รายงาน (ถ้ามี)
                </label>
                {reportFile ? (
                  <div className="flex items-center gap-2 p-3 border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 rounded-lg">
                    <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-700 flex-1 truncate">
                      {reportFile.name}
                    </span>
                    <span className="text-xs text-green-600">
                      {(reportFile.size / 1024).toFixed(1)} KB
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRemoveFile}
                      className="h-6 w-6 p-0 hover:bg-red-100"
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      id="report-file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    />
                    <label
                      htmlFor="report-file"
                      className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50 dark:bg-green-950 transition-colors"
                    >
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        คลิกเพื่อเลือกไฟล์ (สูงสุด 10MB)
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                      รองรับ: PDF, Word, Excel, รูปภาพ
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStatusDialog(false)}
              disabled={updatingStatus}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updatingStatus}>
              {updatingStatus ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssignedTasksList;
