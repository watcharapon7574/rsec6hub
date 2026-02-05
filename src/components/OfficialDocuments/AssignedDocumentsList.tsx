import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Eye, Calendar, User, Clock, CheckCircle, PlayCircle, XCircle, FileText, ClipboardList, RotateCcw } from 'lucide-react';
import { useAssignedTasks } from '@/hooks/useAssignedTasks';
import { TaskStatus, TaskAssignmentWithDetails } from '@/services/taskAssignmentService';
import { extractPdfUrl } from '@/utils/fileUpload';
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

const AssignedDocumentsList = () => {
  const navigate = useNavigate();
  const { tasks, loading, updateTaskStatus, fetchTasks } = useAssignedTasks();
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
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear() + 543; // Convert to Buddhist year
    return `${day}/${month}/${year}`;
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
    navigate('/pdf-just-preview', {
      state: {
        fileUrl: task.document_pdf_url,
        fileName: 'เอกสาร',
        memoId: task.document_type === 'memo' ? task.document_id : undefined,
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

  const handleCompleteClick = (assignmentId: string) => {
    setSelectedTaskId(assignmentId);
    setCompletionNote('');
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <div className="text-muted-foreground">กำลังโหลดรายการงาน...</div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="text-center text-gray-500">
          <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">ไม่มีงานที่ได้รับมอบหมาย</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">
            {tasks.length > 0 ? `${tasks.length} รายการ` : 'ไม่มีงาน'}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          className="p-1 h-8 w-8 text-green-600 hover:bg-green-50 disabled:opacity-50"
        >
          <RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      {tasks.map((task) => {
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

                  {/* วันที่ */}
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(task.assigned_at)}
                  </span>

                  {/* ความคิดเห็น */}
                  {(task.note || task.completion_note) && (
                    <div className={`
                      ${task.completion_note
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-sm'
                        : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-sm'
                      }
                      border rounded-md px-2.5 py-1 flex items-center gap-1.5
                    `}>
                      <span className={`text-[10px] font-medium ${task.completion_note ? 'text-green-700' : 'text-blue-700'}`}>
                        {task.completion_note ? '✓' : '💬'}
                      </span>
                      <span className={`text-xs ${task.completion_note ? 'text-green-800' : 'text-blue-800'} truncate block max-w-[120px] font-medium`}>
                        {task.note ? truncateText(task.note, 35) : truncateText(task.completion_note!, 35)}
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

                  {/* ปุ่มตามสถานะ */}
                  {task.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(task.assignment_id, 'in_progress')}
                      className="h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-700"
                    >
                      <PlayCircle className="h-3.5 w-3.5 mr-1" />
                      ทราบ
                    </Button>
                  )}

                  {task.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => handleCompleteClick(task.assignment_id)}
                      className="h-7 text-xs px-2.5 bg-green-600 hover:bg-green-700"
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
      })}

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

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="report-file" className="text-sm font-medium flex items-center gap-2">
                📎 แนบไฟล์เอกสาร (ถ้ามี)
              </Label>
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
    </div>
  );
};

export default AssignedDocumentsList;
