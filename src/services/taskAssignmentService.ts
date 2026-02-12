import { supabase } from '@/integrations/supabase/client';

// =====================================================
// Types & Interfaces
// =====================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type DocumentType = 'memo' | 'doc_receive';
export type AssignmentSource = 'name' | 'group' | 'position';

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
  task_description: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  completion_note: string | null;
  deleted_at: string | null;
  // Team management fields
  assignment_source: AssignmentSource | null;
  position_id: string | null;
  group_id: string | null;
  is_reporter: boolean;
  is_team_leader: boolean;
  parent_assignment_id: string | null;
}

export interface TeamMember {
  assignment_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  employee_id?: string;
  position: string;
  is_team_leader: boolean;
  is_reporter: boolean;
  status: TaskStatus;
}

export interface SelectionInfo {
  source: AssignmentSource | null;
  positionId?: string;
  positionName?: string;
  groupId?: string;
  groupName?: string;
  // For group assignments: track leader user IDs from each selected group
  groupLeaderIds?: string[];
}

export interface TaskDetailsOptions {
  note?: string;
  taskDescription?: string;
  eventDate?: Date | null;
  eventTime?: string;
  location?: string;
  // Team management
  selectionInfo?: SelectionInfo;
  isTeamLeader?: boolean;
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
  updated_at: string | null;
  status: TaskStatus;
  note: string | null;
  completion_note: string | null;
  // New task detail fields
  task_description: string | null;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  // Team management fields
  assignment_source: AssignmentSource | null;
  position_id: string | null;
  position_name: string | null;
  group_id: string | null;
  group_name: string | null;
  is_reporter: boolean;
  is_team_leader: boolean;
  parent_assignment_id: string | null;
  // Flag to check if any reporter has been assigned for this document
  has_reporter_assigned: boolean;
}

export interface AcknowledgeOptions {
  teamMembers?: { userId: string; isReporter: boolean }[];
  reporterIds: string[]; // User IDs who are reporters (must have at least 1)
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
    options?: TaskDetailsOptions
  ): Promise<string> {
    try {
      // Step 1: Create task assignment via RPC (handles authorization)
      const { data, error } = await (supabase as any).rpc('create_task_assignment', {
        p_document_id: documentId,
        p_document_type: documentType,
        p_assigned_to: assignedToUserId,
        p_note: options?.note || null
      });

      if (error) {
        console.error('Error creating task assignment:', error);
        throw new Error(error.message);
      }

      const assignmentId = data;

      // Step 2: Update with additional task details and team management fields
      const updateData: Record<string, any> = {};

      // Task details
      if (options?.taskDescription) {
        updateData.task_description = options.taskDescription;
      }
      if (options?.eventDate) {
        updateData.event_date = options.eventDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
      }
      if (options?.eventTime) {
        updateData.event_time = options.eventTime;
      }
      if (options?.location) {
        updateData.location = options.location;
      }

      // Team management fields from selectionInfo
      if (options?.selectionInfo) {
        const { source, positionId, groupId } = options.selectionInfo;
        if (source) {
          updateData.assignment_source = source;
        }
        if (positionId) {
          updateData.position_id = positionId;
        }
        if (groupId) {
          updateData.group_id = groupId;
        }
      }

      // Set team leader flag
      if (options?.isTeamLeader) {
        updateData.is_team_leader = true;
      }

      // Update if we have any data
      if (Object.keys(updateData).length > 0) {
        console.log('📝 Updating task assignment:', { assignmentId, updateData });

        const { error: updateError } = await (supabase as any)
          .from('task_assignments')
          .update(updateData)
          .eq('id', assignmentId);

        if (updateError) {
          console.error('❌ Error updating task details:', updateError);
          // Don't throw - assignment was created successfully
        } else {
          console.log('✅ Task assignment updated successfully');
        }
      }

      return assignmentId;
    } catch (error) {
      console.error('Failed to create task assignment:', error);
      throw error;
    }
  }

  /**
   * ส่งแจ้งเตือนกลุ่ม Telegram เมื่อมอบหมายงาน
   */
  async sendGroupNotification(
    documentId: string,
    documentType: DocumentType,
    assigneeUserIds: string[],
    options?: TaskDetailsOptions
  ): Promise<void> {
    console.log('📢 sendGroupNotification called with:', {
      documentId,
      documentType,
      assigneeUserIds,
      options
    });

    try {
      // Get document details
      let subject = '';
      let docNumber = '';

      if (documentType === 'memo') {
        const { data: memo } = await supabase
          .from('memos')
          .select('subject, doc_number')
          .eq('id', documentId)
          .single();
        subject = memo?.subject || '';
        docNumber = memo?.doc_number || '';
      } else {
        const { data: docReceive } = await (supabase as any)
          .from('doc_receive')
          .select('subject, doc_number')
          .eq('id', documentId)
          .single();
        subject = docReceive?.subject || '';
        docNumber = docReceive?.doc_number || '';
      }

      // For position-based assignments (ส้ม), only show the first person (position holder)
      // Team leader will manage and add team members later
      const isPositionBased = options?.selectionInfo?.source === 'position';
      const userIdsToShow = isPositionBased ? [assigneeUserIds[0]] : assigneeUserIds;

      // Get assignee names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIdsToShow);

      const assigneeNames = (profiles || []).map(p => `${p.first_name} ${p.last_name}`);

      // Get assigner name (current user)
      const { data: { user } } = await supabase.auth.getUser();
      let assignerName = 'ไม่ระบุ';
      if (user?.id) {
        const { data: assignerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', user.id)
          .single();
        if (assignerProfile) {
          assignerName = `${assignerProfile.first_name} ${assignerProfile.last_name}`;
        }
      }

      // Format event date for Thai display
      let formattedDate = '';
      if (options?.eventDate) {
        const date = options.eventDate;
        const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                           'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const day = date.getDate();
        const month = thaiMonths[date.getMonth()];
        const year = date.getFullYear() + 543;
        formattedDate = `${day} ${month} ${year}`;
      }

      // Send notification to Edge Function
      const payload = {
        type: 'task_assigned_group',
        document_id: documentId,
        document_type: documentType,
        subject: subject,
        doc_number: docNumber,
        assigned_by: assignerName,
        task_description: options?.taskDescription || '',
        event_date: formattedDate,
        event_time: options?.eventTime || '',
        location: options?.location || '',
        note: options?.note || '',
        assignee_names: assigneeNames,
        is_position_based: isPositionBased,
      };

      console.log('📤 Sending telegram-notify payload:', payload);

      const { data, error } = await supabase.functions.invoke('telegram-notify', {
        body: payload
      });

      console.log('📥 telegram-notify response:', { data, error });

      if (error) {
        console.error('❌ Error sending group notification:', error);
      } else {
        console.log('✅ Group notification sent successfully:', data);
      }
    } catch (error) {
      console.error('❌ Failed to send group notification:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * สร้างงานมอบหมายหลายคน (batch create)
   */
  async createMultipleTaskAssignments(
    documentId: string,
    documentType: DocumentType,
    assignedToUserIds: string[],
    options?: TaskDetailsOptions
  ): Promise<string[]> {
    try {
      const assignmentIds: string[] = [];
      const isPositionBased = options?.selectionInfo?.source === 'position';
      const isGroupBased = options?.selectionInfo?.source === 'group';
      const isNameBased = options?.selectionInfo?.source === 'name';
      const groupLeaderIds = options?.selectionInfo?.groupLeaderIds || [];

      // Determine team leader BEFORE creating assignments
      let teamLeaderUserId: string | null = null;

      // ===== Team Leader Determination Rules =====
      // Case 1: Position (ส้ม) - ผู้รับผิดชอบตำแหน่งเป็นหัวหน้า (เพิ่มคนอื่นไม่ได้)
      // Case 2: Group 1 กลุ่ม (ม่วง) - ใช้ leader_user_id ที่บันทึกตอนสร้างกลุ่ม
      // Case 3: Name only (น้ำเงิน) - คนแรกที่เพิ่มเป็นหัวหน้า
      // Case 4: Group + เพิ่มรายคน - หัวหน้ากลุ่มเป็นหัวหน้าเสมอ
      // Case 5: หลายกลุ่ม - เปรียบเทียบ RSEC ของหัวหน้าทุกกลุ่ม (น้อยสุดเป็นหัว)
      // Case 6: หลายกลุ่ม + รายคน - ใช้ logic เดียวกับ Case 5

      if (assignedToUserIds.length === 1) {
        // Single user: they are the team leader
        teamLeaderUserId = assignedToUserIds[0];
      } else if (isPositionBased && groupLeaderIds.length > 0) {
        // Case 1: Position - use the position member (stored in groupLeaderIds)
        teamLeaderUserId = groupLeaderIds[0];
      } else if (isPositionBased) {
        // Position fallback (shouldn't happen)
        teamLeaderUserId = assignedToUserIds[0];
      } else if ((isGroupBased || (isPositionBased && groupLeaderIds.length > 0)) && groupLeaderIds.length > 0) {
        // Case 2, 4, 5: Group-based with leaders
        // Filter to only include leaders that are in the assigned users
        const validLeaderIds = groupLeaderIds.filter(id => assignedToUserIds.includes(id));

        if (validLeaderIds.length === 1) {
          // Case 2 & 4: Single group leader (even with additional name-based users)
          teamLeaderUserId = validLeaderIds[0];
        } else if (validLeaderIds.length > 1) {
          // Case 5: Multiple groups - compare RSEC of group leaders only
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, employee_id')
            .in('user_id', validLeaderIds);

          if (profiles && profiles.length > 0) {
            const leadersWithEmployeeId = profiles.map(p => ({
              userId: p.user_id,
              employeeId: p.employee_id
            }));
            teamLeaderUserId = this.getMostSeniorUser(leadersWithEmployeeId);
          }
        }

        // If no valid leaders found (shouldn't happen for properly created groups)
        if (!teamLeaderUserId) {
          console.warn('⚠️ Group-based but no valid leaders found in assigned users');
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, employee_id')
            .in('user_id', assignedToUserIds);

          if (profiles && profiles.length > 0) {
            const usersWithEmployeeId = profiles.map(p => ({
              userId: p.user_id,
              employeeId: p.employee_id
            }));
            teamLeaderUserId = this.getMostSeniorUser(usersWithEmployeeId);
          }
        }
      } else if (isGroupBased) {
        // Group-based but groupLeaderIds is empty (old groups without leader_user_id)
        console.warn('⚠️ Group-based but groupLeaderIds is empty - using RSEC seniority');
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, employee_id')
          .in('user_id', assignedToUserIds);

        if (profiles && profiles.length > 0) {
          const usersWithEmployeeId = profiles.map(p => ({
            userId: p.user_id,
            employeeId: p.employee_id
          }));
          teamLeaderUserId = this.getMostSeniorUser(usersWithEmployeeId);
        }
      } else if (isNameBased) {
        // Case 3: Name-based only - first person added is the team leader
        teamLeaderUserId = assignedToUserIds[0];
      } else if (!options?.selectionInfo?.source && assignedToUserIds.length > 1) {
        // Source is null/undefined with multiple users: use RSEC seniority
        console.warn('⚠️ Source is null but has multiple users - using RSEC seniority');
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, employee_id')
          .in('user_id', assignedToUserIds);

        if (profiles && profiles.length > 0) {
          const usersWithEmployeeId = profiles.map(p => ({
            userId: p.user_id,
            employeeId: p.employee_id
          }));
          teamLeaderUserId = this.getMostSeniorUser(usersWithEmployeeId);
        }
      }

      // Final fallback: if no leader was determined, use first user
      if (!teamLeaderUserId && assignedToUserIds.length > 0) {
        teamLeaderUserId = assignedToUserIds[0];
      }

      console.log('📋 createMultipleTaskAssignments:', {
        isPositionBased,
        isGroupBased,
        isNameBased,
        groupLeaderIds,
        teamLeaderUserId,
        assignedToUserIds,
        source: options?.selectionInfo?.source
      });

      // Create assignment for each user with isTeamLeader flag
      for (let i = 0; i < assignedToUserIds.length; i++) {
        const userId = assignedToUserIds[i];
        const isLeader = userId === teamLeaderUserId;

        const assignmentId = await this.createTaskAssignment(
          documentId,
          documentType,
          userId,
          {
            ...options,
            isTeamLeader: isLeader
          }
        );
        assignmentIds.push(assignmentId);

        console.log(`  ✅ Created assignment for ${userId}, isTeamLeader: ${isLeader}`);
      }

      // Send group notification to Telegram (fire and forget)
      this.sendGroupNotification(documentId, documentType, assignedToUserIds, options)
        .catch(err => console.error('Group notification failed:', err));

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
      const { data, error } = await (supabase as any).rpc('get_user_assigned_tasks', {
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
      const { data, error } = await (supabase as any).rpc('update_task_status', {
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
      const { data, error } = await (supabase as any).rpc('get_documents_ready_for_assignment');

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
      const { data, error } = await (supabase as any).rpc('soft_delete_task_assignment', {
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
      const query = (supabase as any)
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

      const { count, error } = await (supabase as any)
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

  // =====================================================
  // Team Management Methods
  // =====================================================

  /**
   * กด "ทราบ" - รับทราบงานและกำหนดผู้รายงาน
   * For position-based: Can add team members + set reporters
   * For name/group-based: Only set reporters
   */
  async acknowledgeTask(
    assignmentId: string,
    options: AcknowledgeOptions
  ): Promise<boolean> {
    try {
      // Reporter is now optional - no validation required
      const reporterIds = options.reporterIds || [];

      // Get the assignment to check source type
      const { data: assignment, error: fetchError } = await (supabase as any)
        .from('task_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (fetchError || !assignment) {
        throw new Error('ไม่พบงานมอบหมาย');
      }

      // Determine status based on assignment type and reporter role
      // For position-based (team leader): always 'in_progress' to allow team management
      // For others: Reporter = 'in_progress', Non-reporter = 'completed'
      const isThisPersonReporter = reporterIds.includes(assignment.assigned_to);
      const isPositionBased = assignment.assignment_source === 'position';

      // Team leader (position-based) stays in_progress to manage team
      // Even if not a reporter, they need to be able to add members or assign reporter later
      const newStatus = isPositionBased ? 'in_progress' : (isThisPersonReporter ? 'in_progress' : 'completed');

      console.log('🔍 acknowledgeTask debug:', {
        assignmentId,
        isPositionBased,
        assignmentSource: assignment.assignment_source,
        isThisPersonReporter,
        reporterIds,
        assignedTo: assignment.assigned_to,
        newStatus
      });

      // Update the main assignment
      const { error: updateError } = await (supabase as any)
        .from('task_assignments')
        .update({
          status: newStatus,
          is_reporter: isThisPersonReporter
        })
        .eq('id', assignmentId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // If position-based and team members provided, add them
      if (assignment.assignment_source === 'position' && options.teamMembers) {
        for (const member of options.teamMembers) {
          await this.addTeamMember(
            assignmentId,
            member.userId,
            member.isReporter
          );
        }
      }

      // For name/group-based assignments, update reporter status for all team members
      if (assignment.assignment_source === 'name' || assignment.assignment_source === 'group') {
        // Update all assignments in the same group
        const docColumn = assignment.document_type === 'memo' ? 'memo_id' : 'doc_receive_id';
        const docId = assignment.document_type === 'memo' ? assignment.memo_id : assignment.doc_receive_id;

        // Get all assignments for this document
        const { data: allAssignments } = await (supabase as any)
          .from('task_assignments')
          .select('id, assigned_to')
          .eq(docColumn, docId)
          .is('deleted_at', null);

        if (allAssignments) {
          for (const a of allAssignments) {
            // Only update is_reporter, don't change status (each member needs to acknowledge themselves)
            await (supabase as any)
              .from('task_assignments')
              .update({
                is_reporter: reporterIds.includes(a.assigned_to)
              })
              .eq('id', a.id);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to acknowledge task:', error);
      throw error;
    }
  }

  /**
   * เพิ่มสมาชิกทีม (เฉพาะผู้ที่มอบหมายผ่านหน้าที่)
   */
  async addTeamMember(
    parentAssignmentId: string,
    userId: string,
    isReporter: boolean = false
  ): Promise<string> {
    try {
      // Get parent assignment details
      const { data: parent, error: parentError } = await (supabase as any)
        .from('task_assignments')
        .select('*')
        .eq('id', parentAssignmentId)
        .single();

      if (parentError || !parent) {
        throw new Error('ไม่พบงานมอบหมายหลัก');
      }

      // Check if this is a position-based assignment
      if (parent.assignment_source !== 'position') {
        throw new Error('ไม่สามารถเพิ่มทีมได้ (งานนี้ไม่ได้มอบหมายผ่านหน้าที่)');
      }

      // Create new team member assignment
      const newAssignment: Record<string, any> = {
        memo_id: parent.memo_id,
        doc_receive_id: parent.doc_receive_id,
        document_type: parent.document_type,
        assigned_by: parent.assigned_to, // Team leader assigns
        assigned_to: userId,
        status: 'pending', // New team members start as pending (need to acknowledge themselves)
        note: parent.note,
        task_description: parent.task_description,
        event_date: parent.event_date,
        event_time: parent.event_time,
        location: parent.location,
        assignment_source: 'name', // Team members are added by name
        position_id: parent.position_id,
        is_reporter: isReporter,
        is_team_leader: false,
        parent_assignment_id: parentAssignmentId
      };

      const { data, error } = await (supabase as any)
        .from('task_assignments')
        .insert(newAssignment)
        .select('id')
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data.id;
    } catch (error) {
      console.error('Failed to add team member:', error);
      throw error;
    }
  }

  /**
   * ดึงสมาชิกทีมทั้งหมดของงาน
   */
  async getTeamMembers(assignmentId: string): Promise<TeamMember[]> {
    try {
      // Get the assignment and all related assignments
      const { data: assignment } = await (supabase as any)
        .from('task_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (!assignment) {
        return [];
      }

      // Get all assignments for the same document
      const docColumn = assignment.document_type === 'memo' ? 'memo_id' : 'doc_receive_id';
      const docId = assignment.document_type === 'memo' ? assignment.memo_id : assignment.doc_receive_id;

      // Step 1: Get all assignments
      const { data: allAssignments, error } = await (supabase as any)
        .from('task_assignments')
        .select('id, assigned_to, is_team_leader, is_reporter, status')
        .eq(docColumn, docId)
        .is('deleted_at', null)
        .order('is_team_leader', { ascending: false });

      if (error || !allAssignments || allAssignments.length === 0) {
        return [];
      }

      // Step 2: Get unique user IDs and fetch profiles separately
      const userIds = Array.from(new Set(allAssignments.map((a: any) => String(a.assigned_to)))).filter(Boolean) as string[];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, employee_id, position')
        .in('user_id', userIds);

      // Create a map for quick lookup
      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      // Step 3: Combine assignments with profiles
      return allAssignments.map((a: any) => {
        const profile = profileMap.get(a.assigned_to);
        return {
          assignment_id: a.id,
          user_id: a.assigned_to,
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          employee_id: profile?.employee_id,
          position: profile?.position || '',
          is_team_leader: a.is_team_leader || false,
          is_reporter: a.is_reporter || false,
          status: a.status
        };
      });
    } catch (error) {
      console.error('Failed to get team members:', error);
      return [];
    }
  }

  /**
   * อัปเดตสถานะผู้รายงานของสมาชิกทีม
   */
  async updateReporterStatus(
    assignmentId: string,
    isReporter: boolean
  ): Promise<boolean> {
    try {
      const { error } = await (supabase as any)
        .from('task_assignments')
        .update({ is_reporter: isReporter })
        .eq('id', assignmentId);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    } catch (error) {
      console.error('Failed to update reporter status:', error);
      throw error;
    }
  }

  /**
   * อัปเดต reporters และเพิ่มทีมใหม่ (สำหรับกรณีแก้ไขหลังจากทราบแล้ว)
   */
  async updateTeamAndReporters(
    assignmentId: string,
    options: {
      reporterIds: string[];
      newTeamMembers?: { userId: string; isReporter: boolean }[];
    }
  ): Promise<boolean> {
    try {
      // Reporter is now optional - no validation required
      const reporterIds = options.reporterIds || [];

      // Get the assignment to find document info
      const { data: assignment, error: fetchError } = await (supabase as any)
        .from('task_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (fetchError || !assignment) {
        throw new Error('ไม่พบงานมอบหมาย');
      }

      // Get document column
      const docColumn = assignment.document_type === 'memo' ? 'memo_id' : 'doc_receive_id';
      const docId = assignment.document_type === 'memo' ? assignment.memo_id : assignment.doc_receive_id;

      // Get all current team members for this document
      const { data: allAssignments } = await (supabase as any)
        .from('task_assignments')
        .select('id, assigned_to')
        .eq(docColumn, docId)
        .is('deleted_at', null);

      // Update is_reporter for all existing team members
      if (allAssignments) {
        for (const a of allAssignments) {
          await (supabase as any)
            .from('task_assignments')
            .update({ is_reporter: reporterIds.includes(a.assigned_to) })
            .eq('id', a.id);
        }
      }

      // Add new team members if any
      if (options.newTeamMembers && options.newTeamMembers.length > 0) {
        for (const member of options.newTeamMembers) {
          await this.addTeamMember(
            assignmentId,
            member.userId,
            member.isReporter
          );
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to update team and reporters:', error);
      throw error;
    }
  }

  /**
   * ลบสมาชิกทีม (soft delete)
   * - สามารถลบได้เฉพาะคนที่ยัง pending เท่านั้น
   * - ไม่สามารถลบหัวหน้าทีมได้
   */
  async removeTeamMember(assignmentId: string): Promise<boolean> {
    try {
      // Get the assignment to check status and role
      const { data: assignment, error: fetchError } = await (supabase as any)
        .from('task_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();

      if (fetchError || !assignment) {
        throw new Error('ไม่พบงานมอบหมาย');
      }

      // Cannot remove team leader
      if (assignment.is_team_leader) {
        throw new Error('ไม่สามารถลบหัวหน้าทีมได้');
      }

      // Can only remove pending members
      if (assignment.status !== 'pending') {
        throw new Error('ไม่สามารถลบสมาชิกที่รับทราบงานแล้วได้');
      }

      // Soft delete
      const { error: deleteError } = await (supabase as any)
        .from('task_assignments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', assignmentId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (error) {
      console.error('Failed to remove team member:', error);
      throw error;
    }
  }

  /**
   * หาผู้อาวุโสที่สุดจาก employee_id (RSECxxx - ตัวเลขน้อยสุด = อาวุโสสุด)
   */
  getMostSeniorUser(users: { userId: string; employeeId?: string }[]): string | null {
    if (users.length === 0) return null;
    if (users.length === 1) return users[0].userId;

    // Sort by employee_id numerically (RSEC001 is more senior than RSEC100)
    const sorted = [...users].sort((a, b) => {
      const numA = parseInt((a.employeeId || '').replace(/\D/g, ''), 10) || 999999;
      const numB = parseInt((b.employeeId || '').replace(/\D/g, ''), 10) || 999999;
      return numA - numB;
    });

    return sorted[0].userId;
  }

  /**
   * เสร็จสิ้นงานด้วยการสร้างบันทึกข้อความรายงาน
   * - Link memo ID กับ task assignment
   * - เปลี่ยนสถานะเป็น completed
   * - ส่งแจ้งเตือนให้ผู้เกี่ยวข้อง
   */
  async completeTaskWithReportMemo(assignmentId: string, memoId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();

      // Update task assignment with report memo and completed status
      const { error: updateError } = await (supabase as any)
        .from('task_assignments')
        .update({
          report_memo_id: memoId,
          status: 'completed',
          completed_at: now,
          completion_note: 'รายงานผลผ่านบันทึกข้อความ'
        })
        .eq('id', assignmentId);

      if (updateError) {
        console.error('Error updating task assignment:', updateError);
        throw new Error('ไม่สามารถอัปเดตสถานะงานได้');
      }

      // Get task details for notification
      const { data: task, error: taskError } = await (supabase as any)
        .from('task_assignments')
        .select(`
          id,
          assigned_to,
          assigned_by,
          document_type,
          memo_id,
          doc_receive_id,
          is_team_leader
        `)
        .eq('id', assignmentId)
        .single();

      if (taskError) {
        console.warn('Could not fetch task for notifications:', taskError);
        return true; // Still return success since main update worked
      }

      // Get document subject for notification
      let documentSubject = '';
      if (task.document_type === 'memo' && task.memo_id) {
        const { data: memo } = await supabase
          .from('memos')
          .select('subject')
          .eq('id', task.memo_id)
          .single();
        documentSubject = memo?.subject || '';
      } else if (task.document_type === 'doc_receive' && task.doc_receive_id) {
        const { data: docReceive } = await (supabase as any)
          .from('doc_receives')
          .select('subject')
          .eq('id', task.doc_receive_id)
          .single();
        documentSubject = docReceive?.subject || '';
      }

      // Get team leader for this document (to notify)
      const docColumn = task.document_type === 'memo' ? 'memo_id' : 'doc_receive_id';
      const docId = task.document_type === 'memo' ? task.memo_id : task.doc_receive_id;

      const { data: teamLeader } = await (supabase as any)
        .from('task_assignments')
        .select('assigned_to')
        .eq(docColumn, docId)
        .eq('is_team_leader', true)
        .is('deleted_at', null)
        .single();

      // Collect users to notify
      const usersToNotify = new Set<string>();

      // Add assigned_by (ธุรการ)
      if (task.assigned_by) {
        usersToNotify.add(task.assigned_by);
      }

      // Add team leader
      if (teamLeader?.assigned_to) {
        usersToNotify.add(teamLeader.assigned_to);
      }

      // Get memo signers from signature_positions (ผู้ลงนาม)
      // NOTE: signers are stored in memos.signature_positions JSONB, not in a separate table
      if (memoId) {
        const { data: memoWithSigners } = await supabase
          .from('memos')
          .select('signature_positions')
          .eq('id', memoId)
          .single();

        if (memoWithSigners?.signature_positions) {
          const signaturePositions = memoWithSigners.signature_positions as Array<{ userId?: string; user_id?: string }>;
          signaturePositions.forEach(signer => {
            const signerUserId = signer.userId || signer.user_id;
            if (signerUserId) {
              usersToNotify.add(signerUserId);
            }
          });
        }
      }

      // Create notifications
      // NOTE: notifications table has reference_id (uuid) instead of data (jsonb)
      const notifications = Array.from(usersToNotify).map(userId => ({
        user_id: userId,
        type: 'task_report_submitted',
        title: 'มีการรายงานผลงาน',
        message: `มีการรายงานผลสำหรับ: ${documentSubject}`,
        reference_id: memoId, // Reference to the report memo
        is_read: false
      }));

      if (notifications.length > 0) {
        const { error: notifyError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (notifyError) {
          console.warn('Could not create notifications:', notifyError);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to complete task with report memo:', error);
      throw error;
    }
  }

  /**
   * 🧪 ทดสอบส่ง Telegram Group Notification
   * เรียกจาก browser console:
   *   import { taskAssignmentService } from '@/services/taskAssignmentService';
   *   taskAssignmentService.testGroupNotification();
   */
  async testGroupNotification(): Promise<void> {
    console.log('🧪 Testing Group Notification...');

    const testPayload = {
      type: 'task_assigned_group',
      document_id: 'test-' + Date.now(),
      document_type: 'memo',
      subject: '🧪 ทดสอบระบบแจ้งเตือน',
      doc_number: 'TEST-001',
      assigned_by: 'ระบบทดสอบ',
      task_description: 'นี่คือข้อความทดสอบจากระบบ FastDoc',
      event_date: '15 ก.พ. 2569',
      event_time: '09:00',
      location: 'ห้องประชุม 1',
      note: 'ทดสอบการส่งแจ้งเตือน',
      assignee_names: ['นายทดสอบ หนึ่ง', 'นางทดสอบ สอง', 'นายทดสอบ สาม'],
      is_position_based: false,
    };

    console.log('📤 Sending test payload:', testPayload);

    try {
      const { data, error } = await supabase.functions.invoke('telegram-notify', {
        body: testPayload
      });

      console.log('📥 Response:', { data, error });

      if (error) {
        console.error('❌ Test failed:', error);
      } else {
        console.log('✅ Test notification sent successfully!');
      }
    } catch (err) {
      console.error('❌ Test error:', err);
    }
  }
}

// Export singleton instance
export const taskAssignmentService = new TaskAssignmentService();

// 🧪 Expose to window for console testing
if (typeof window !== 'undefined') {
  (window as any).testTelegramNotification = () => taskAssignmentService.testGroupNotification();
}
