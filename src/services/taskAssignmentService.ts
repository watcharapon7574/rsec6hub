import { supabase } from '@/integrations/supabase/client';

// =====================================================
// Types & Interfaces
// =====================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type DocumentType = 'memo' | 'doc_receive';

export interface TaskAssignment {
  id: string;
  memo_id: string | null;
  doc_receive_id: string | null;
  document_type: DocumentType;
  assigned_by: string;
  assigned_to: string;
  assigned_at: string;
  completed_at: string | null;
  status: TaskStatus;
  note: string | null;
  completion_note: string | null;
  deleted_at: string | null;
}

export interface TaskAssignmentWithDetails {
  assignment_id: string;
  document_id: string;
  document_type: DocumentType;
  document_subject: string;
  document_number: string | null;
  document_pdf_url: string | null;
  assigned_by_id: string;
  assigned_by_name: string;
  assigned_to_id: string;
  assigned_to_name: string;
  assigned_at: string;
  completed_at: string | null;
  status: TaskStatus;
  note: string | null;
  completion_note: string | null;
}

export interface DocumentReadyForAssignment {
  document_id: string;
  document_type: DocumentType;
  document_subject: string;
  document_number: string | null;
  author_name: string;
  completed_at: string;
  is_assigned: boolean;
  last_comment: string | null;
  has_in_progress_task: boolean;
}

// =====================================================
// Task Assignment Service
// =====================================================

class TaskAssignmentService {
  /**
   * สร้างงานมอบหมาย (เฉพาะธุรการ)
   */
  async createTaskAssignment(
    documentId: string,
    documentType: DocumentType,
    assignedToUserId: string,
    note?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('create_task_assignment', {
        p_document_id: documentId,
        p_document_type: documentType,
        p_assigned_to: assignedToUserId,
        p_note: note || null
      });

      if (error) {
        console.error('Error creating task assignment:', error);
        throw new Error(error.message);
      }

      return data; // Returns assignment_id
    } catch (error) {
      console.error('Failed to create task assignment:', error);
      throw error;
    }
  }

  /**
   * สร้างงานมอบหมายหลายคน (batch create)
   */
  async createMultipleTaskAssignments(
    documentId: string,
    documentType: DocumentType,
    assignedToUserIds: string[],
    note?: string
  ): Promise<string[]> {
    try {
      const assignmentIds: string[] = [];

      for (const userId of assignedToUserIds) {
        const assignmentId = await this.createTaskAssignment(
          documentId,
          documentType,
          userId,
          note
        );
        assignmentIds.push(assignmentId);
      }

      return assignmentIds;
    } catch (error) {
      console.error('Failed to create multiple task assignments:', error);
      throw error;
    }
  }

  /**
   * ดึงรายการงานที่ได้รับมอบหมาย
   */
  async getUserAssignedTasks(
    userId?: string,
    status?: TaskStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<TaskAssignmentWithDetails[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_assigned_tasks', {
        p_user_id: userId || null,
        p_status: status || null,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('Error getting user assigned tasks:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get user assigned tasks:', error);
      throw error;
    }
  }

  /**
   * อัปเดตสถานะงาน
   */
  async updateTaskStatus(
    assignmentId: string,
    newStatus: TaskStatus,
    completionNote?: string,
    reportFileUrl?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('update_task_status', {
        p_assignment_id: assignmentId,
        p_new_status: newStatus,
        p_completion_note: completionNote || null,
        p_report_file_url: reportFileUrl || null
      });

      if (error) {
        console.error('Error updating task status:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to update task status:', error);
      throw error;
    }
  }

  /**
   * ดึงเอกสารที่พร้อมสำหรับการมอบหมาย (current_signer_order = 5)
   */
  async getDocumentsReadyForAssignment(): Promise<DocumentReadyForAssignment[]> {
    try {
      const { data, error } = await supabase.rpc('get_documents_ready_for_assignment');

      if (error) {
        console.error('Error getting documents ready for assignment:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get documents ready for assignment:', error);
      throw error;
    }
  }

  /**
   * ลบงานมอบหมาย (soft delete)
   */
  async deleteTaskAssignment(assignmentId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('soft_delete_task_assignment', {
        p_assignment_id: assignmentId
      });

      if (error) {
        console.error('Error deleting task assignment:', error);
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Failed to delete task assignment:', error);
      throw error;
    }
  }

  /**
   * ดึงงานมอบหมายทั้งหมดของเอกสาร
   */
  async getTaskAssignmentsByDocument(
    documentId: string,
    documentType: DocumentType
  ): Promise<TaskAssignment[]> {
    try {
      const query = supabase
        .from('task_assignments')
        .select('*')
        .eq('document_type', documentType)
        .is('deleted_at', null)
        .order('assigned_at', { ascending: false });

      if (documentType === 'memo') {
        query.eq('memo_id', documentId);
      } else {
        query.eq('doc_receive_id', documentId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting task assignments by document:', error);
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get task assignments by document:', error);
      throw error;
    }
  }

  /**
   * ดึงจำนวนงานที่ยังไม่เสร็จของผู้ใช้
   */
  async getPendingTaskCount(userId?: string): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const targetUserId = userId || user?.id;

      if (!targetUserId) {
        // Return 0 instead of throwing error if user not authenticated yet
        console.warn('User not authenticated yet, returning 0 for pending task count');
        return 0;
      }

      const { count, error } = await supabase
        .from('task_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', targetUserId)
        .in('status', ['pending', 'in_progress'])
        .is('deleted_at', null);

      if (error) {
        console.error('Error getting pending task count:', error);
        throw new Error(error.message);
      }

      return count || 0;
    } catch (error) {
      console.error('Failed to get pending task count:', error);
      // Return 0 instead of re-throwing to prevent UI crashes
      return 0;
    }
  }

  /**
   * Subscribe to task assignment changes (Realtime)
   */
  subscribeToTaskAssignments(
    userId: string,
    callback: (payload: any) => void
  ) {
    const channel = supabase
      .channel('task_assignments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignments',
          filter: `assigned_to=eq.${userId}`
        },
        callback
      )
      .subscribe();

    return channel;
  }

  /**
   * Unsubscribe from task assignment changes
   */
  async unsubscribeFromTaskAssignments(channel: any) {
    await supabase.removeChannel(channel);
  }
}

// Export singleton instance
export const taskAssignmentService = new TaskAssignmentService();
