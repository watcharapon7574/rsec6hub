import { useState, useEffect, useCallback } from 'react';
import { taskAssignmentService, TaskStatus } from '@/services/taskAssignmentService';
import type { TaskAssignmentWithDetails } from '@/services/taskAssignmentService';
import { toast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';

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
  const { profile } = useEmployeeAuth();

  // ดึงรายการงานที่ได้รับมอบหมาย
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await taskAssignmentService.getUserAssignedTasks(
        undefined, // use current user
        statusFilter,
        10000 // โหลดทั้งหมด ไม่ตัดที่ 50 รายการ
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

  // Realtime subscription — กรองเฉพาะ row ที่ assigned_to = current user
  // (เดิมไม่มี filter → ทุก user รับ event ของ task_assignment ทั้งระบบ + เด้ง toast ผิดๆ)
  useEffect(() => {
    if (!enableRealtime || !profile?.user_id) return;

    const channel = taskAssignmentService.subscribeToTaskAssignments(
      (payload) => {
        // ทุก event ผ่าน filter assigned_to=eq.userId แล้ว → INSERT = งานใหม่ของ user จริง
        if (payload.eventType === 'INSERT') {
          toast({
            title: '📋 มีงานใหม่มอบหมายให้คุณ',
            description: 'คุณได้รับงานมอบหมายใหม่ กรุณาตรวจสอบ',
          });
        }

        // Refresh task list
        fetchTasks();
      },
      profile.user_id
    );

    return () => {
      taskAssignmentService.unsubscribeFromTaskAssignments(channel);
    };
  }, [enableRealtime, fetchTasks, profile?.user_id]);

  return {
    tasks,
    loading,
    error,
    pendingCount,
    fetchTasks,
    updateTaskStatus,
  };
};
