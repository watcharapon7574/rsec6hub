import { useState, useEffect, useCallback } from 'react';
import { taskAssignmentService, TaskStatus } from '@/services/taskAssignmentService';
import type { TaskAssignmentWithDetails } from '@/services/taskAssignmentService';
import { toast } from '@/hooks/use-toast';

/**
 * Hook สำหรับจัดการงานที่ได้รับมอบหมาย (ฝั่งผู้รับมอบหมาย)
 */
export const useAssignedTasks = (
  statusFilter?: TaskStatus,
  enableRealtime: boolean = true
) => {
  const [tasks, setTasks] = useState<TaskAssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // ดึงรายการงานที่ได้รับมอบหมาย
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await taskAssignmentService.getUserAssignedTasks(
        undefined, // use current user
        statusFilter
      );
      setTasks(data);

      // Update pending count
      const count = await taskAssignmentService.getPendingTaskCount();
      setPendingCount(count);
    } catch (err: any) {
      const errorMessage = err.message || 'ไม่สามารถโหลดรายการงานได้';
      setError(errorMessage);
      console.error('Error fetching assigned tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // อัปเดตสถานะงาน
  const updateTaskStatus = useCallback(
    async (
      assignmentId: string,
      newStatus: TaskStatus,
      completionNote?: string,
      reportFileUrl?: string
    ) => {
      setLoading(true);
      setError(null);

      try {
        await taskAssignmentService.updateTaskStatus(
          assignmentId,
          newStatus,
          completionNote,
          reportFileUrl
        );

        const statusText = {
          pending: 'รอดำเนินการ',
          in_progress: 'กำลังดำเนินการ',
          completed: 'เสร็จสิ้น',
          cancelled: 'ยกเลิก',
        };

        toast({
          title: 'อัปเดตสถานะสำเร็จ',
          description: `เปลี่ยนสถานะเป็น "${statusText[newStatus]}" แล้ว`,
        });

        // Refresh task list
        await fetchTasks();

        return true;
      } catch (err: any) {
        const errorMessage = err.message || 'ไม่สามารถอัปเดตสถานะได้';
        setError(errorMessage);

        toast({
          title: 'เกิดข้อผิดพลาด',
          description: errorMessage,
          variant: 'destructive',
        });

        return false;
      } finally {
        setLoading(false);
      }
    },
    [fetchTasks]
  );

  // โหลดข้อมูลครั้งแรก
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime subscription - ฟังทุกการเปลี่ยนแปลงบน task_assignments
  useEffect(() => {
    if (!enableRealtime) return;

    const channel = taskAssignmentService.subscribeToTaskAssignments(
      (payload) => {
        // Show toast notification for new assignments
        if (payload.eventType === 'INSERT') {
          toast({
            title: '📋 มีงานใหม่มอบหมายให้คุณ',
            description: 'คุณได้รับงานมอบหมายใหม่ กรุณาตรวจสอบ',
          });
        }

        // Refresh task list
        fetchTasks();
      }
    );

    return () => {
      taskAssignmentService.unsubscribeFromTaskAssignments(channel);
    };
  }, [enableRealtime, fetchTasks]);

  return {
    tasks,
    loading,
    error,
    pendingCount,
    fetchTasks,
    updateTaskStatus,
  };
};
