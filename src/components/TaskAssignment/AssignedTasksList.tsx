import React, { useState } from 'react';
import { FileText, User, Calendar, CheckCircle, Clock, XCircle, PlayCircle, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const AssignedTasksList = () => {
  const navigate = useNavigate();
  const { tasks, loading, updateTaskStatus, pendingCount } = useAssignedTasks();

  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState<TaskStatus>('in_progress');
  const [completionNote, setCompletionNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
        color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: Clock,
      },
      in_progress: {
        label: 'กำลังดำเนินการ',
        color: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: PlayCircle,
      },
      completed: {
        label: 'เสร็จสิ้น',
        color: 'bg-green-100 text-green-700 border-green-200',
        icon: CheckCircle,
      },
      cancelled: {
        label: 'ยกเลิก',
        color: 'bg-gray-100 text-gray-700 border-gray-200',
        icon: XCircle,
      },
    };
    return configs[status];
  };

  // Open status update dialog
  const handleOpenStatusDialog = (task: any, status: TaskStatus) => {
    setSelectedTask(task);
    setNewStatus(status);
    setCompletionNote('');
    setShowStatusDialog(true);
  };

  // Update task status
  const handleUpdateStatus = async () => {
    if (!selectedTask) return;

    setUpdatingStatus(true);

    try {
      await updateTaskStatus(
        selectedTask.assignment_id,
        newStatus,
        completionNote || undefined
      );

      setShowStatusDialog(false);
      setSelectedTask(null);
      setCompletionNote('');
    } catch (error) {
      console.error('Error updating status:', error);
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
      <Card className="bg-white border border-border/50">
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
        <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
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

      {/* Task List */}
      {tasks.map((task) => {
        const statusConfig = getStatusConfig(task.status);
        const StatusIcon = statusConfig.icon;

        return (
          <Card
            key={task.assignment_id}
            className="bg-white border border-border/50 hover:shadow-md transition-shadow"
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        💬 หมายเหตุจากผู้มอบหมาย
                      </div>
                      <div className="text-sm text-foreground">{task.note}</div>
                    </div>
                  )}

                  {task.completion_note && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
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
                    className="text-xs"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    ดูเอกสาร
                  </Button>

                  {task.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenStatusDialog(task, 'in_progress')}
                      className="text-xs"
                    >
                      <PlayCircle className="h-3.5 w-3.5 mr-1" />
                      เริ่มดำเนินการ
                    </Button>
                  )}

                  {task.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenStatusDialog(task, 'completed')}
                      className="text-xs bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      ทำเสร็จแล้ว
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Status Update Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newStatus === 'in_progress' ? 'เริ่มดำเนินการ' : 'ทำงานเสร็จสิ้น'}
            </DialogTitle>
            <DialogDescription>
              {newStatus === 'in_progress'
                ? 'ยืนยันการเริ่มดำเนินการงานนี้'
                : 'กรุณาระบุรายละเอียดการดำเนินการ'}
            </DialogDescription>
          </DialogHeader>

          {newStatus === 'completed' && (
            <div className="py-4">
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
