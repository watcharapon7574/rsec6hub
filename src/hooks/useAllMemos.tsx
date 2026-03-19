import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { getFirstSignerOrder, calculateNextSignerOrder, calculateNextSignerOrderWithParallel, calculateRejection } from '@/services/approvalWorkflowService';

export interface MemoRecord {
  id: string;
  subject: string;
  introduction?: string;
  author_name: string;
  author_position: string;
  status: string;
  created_at: string;
  doc_number: string;
  doc_number_status?: string | null; // สถานะการลงเลขหนังสือ
  document_summary?: string; // เพิ่มฟิลด์สรุปเนื้อหาเอกสาร
  pdf_draft_path?: string;
  pdf_final_path?: string;
  user_id: string;
  date?: string;
  signature_positions?: any;
  current_signer_order?: number;
  attachment_title?: string;
  fact?: string;
  form_data?: any;
  proposal?: string;
  updated_at?: string;
  signatures?: any;
  attached_files?: string[];
  has_in_progress_task?: boolean;
  revision_count?: number; // จำนวนครั้งที่เอกสารถูกตีกลับ/แก้ไข
  rejected_name_comment?: any; // ข้อมูลผู้ตีกลับ (name, comment, rejected_at, position)
  doc_del?: any; // soft delete field (JSON with deleted_by, deleted_at, deleted_name)
}

export const useAllMemos = () => {
  const [memos, setMemos] = useState<MemoRecord[]>([]);
  const [completedReportMemos, setCompletedReportMemos] = useState<MemoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useEmployeeAuth();

  // ใช้ useCallback เพื่อให้ fetchMemos stable และไม่เป็น stale closure
  const fetchMemos = useCallback(async () => {
    try {
      setLoading(true);
      // แสดงเอกสารย้อนหลัง 30 วัน เพื่อไม่ให้พลาดเอกสารข้ามเดือน
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString();

      // Query with task_assignments to check for in_progress tasks
      const { data, error } = await (supabase as any)
        .from('memos')
        .select(`
          *,
          task_assignments!task_assignments_memo_id_fkey(
            id,
            status,
            deleted_at
          )
        `)
        .is('doc_del', null)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching memos:', error);
        throw error;
      }

      // Debug: Log raw data from database
      console.log('📊 useAllMemos: Raw data from database:', {
        count: data?.length,
        firstMemo: data?.[0],
        hasTaskAssignments: !!data?.[0]?.task_assignments,
        sampleTaskAssignments: data?.[0]?.task_assignments,
        assignedMemos: data?.filter(m => m.is_assigned).map(m => ({
          id: m.id,
          subject: m.subject,
          is_assigned: m.is_assigned,
          task_assignments: m.task_assignments
        }))
      });

      // Transform data to match MemoRecord type and add has_in_progress_task + has_active_tasks
      const transformedData = data?.map(memo => {
        const tasks = memo.task_assignments || [];
        // Check for in_progress tasks that are not deleted
        const hasInProgressTask = tasks.some((task: any) =>
          task.status === 'in_progress' && task.deleted_at === null
        );
        // Check for active tasks (pending or in_progress, not completed or cancelled)
        const hasActiveTasks = tasks.some((task: any) =>
          (task.status === 'pending' || task.status === 'in_progress') && task.deleted_at === null
        );

        // Debug log - ล็อกทุก memo ที่มี is_assigned
        if (memo.is_assigned) {
          console.log('🔍 useAllMemos transformation:', {
            memoId: memo.id,
            subject: memo.subject,
            is_assigned: memo.is_assigned,
            tasks: tasks,
            tasksLength: tasks.length,
            hasInProgressTask: hasInProgressTask,
            hasActiveTasks: hasActiveTasks
          });
        }

        // Remove task_assignments from the object to keep it clean
        const { task_assignments, ...memoWithoutTasks } = memo;

        return {
          ...memoWithoutTasks,
          attached_files: (() => {
            try {
              return memoWithoutTasks.attached_files ? JSON.parse(memoWithoutTasks.attached_files) : [];
            } catch {
              return [];
            }
          })(),
          has_in_progress_task: hasInProgressTask,
          has_active_tasks: hasActiveTasks
        };
      }) || [];

      // Debug: Log transformed data
      console.log('✅ useAllMemos: Transformed data:', {
        count: transformedData.length,
        firstTransformed: transformedData[0],
        hasInProgressTaskField: transformedData[0]?.has_in_progress_task,
        assignedDocs: transformedData.filter(m => m.is_assigned).map(m => ({
          id: m.id,
          subject: m.subject,
          has_in_progress_task: m.has_in_progress_task
        }))
      });

      setMemos(transformedData as MemoRecord[]);

      // Fetch completed report memos (เอกสารรายงานผลที่เสร็จสิ้น)
      try {
        // 1. ดึง task_assignments ที่มี report_memo_id
        const { data: assignments, error: assignmentsError } = await (supabase as any)
          .from('task_assignments')
          .select('report_memo_id')
          .not('report_memo_id', 'is', null)
          .is('deleted_at', null);

        if (!assignmentsError && assignments?.length) {
          const reportMemoIds = [...new Set(assignments.map((a: any) => a.report_memo_id))].filter(Boolean);

          if (reportMemoIds.length) {
            // 2. ดึง report memos ที่เสร็จสิ้นแล้ว (current_signer_order = 5)
            const { data: reportMemos } = await supabase
              .from('memos')
              .select('*')
              .in('id', reportMemoIds as string[])
              .eq('current_signer_order', 5)
              .is('doc_del', null)
              .order('updated_at', { ascending: false });

            if (reportMemos?.length) {
              setCompletedReportMemos(reportMemos as unknown as MemoRecord[]);
            } else {
              setCompletedReportMemos([]);
            }
          } else {
            setCompletedReportMemos([]);
          }
        } else {
          setCompletedReportMemos([]);
        }
      } catch (reportError) {
        console.error('Error fetching report memos:', reportError);
        setCompletedReportMemos([]);
      }
    } catch (error) {
      console.error('Error fetching memos:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดรายการบันทึกข้อความได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getMemoById = (id: string): MemoRecord | null => {
    return memos.find(memo => memo.id === id) || null;
  };

  const updateMemoStatus = async (memoId: string, status: string, docNumber?: string, rejectionReason?: string, currentSignerOrder?: number, newPdfDraftPath?: string, clerkId?: string) => {
    try {
      const updates: any = { status };
      if (docNumber) updates.doc_number = docNumber;
      if (typeof currentSignerOrder === 'number') updates.current_signer_order = currentSignerOrder;
      if (newPdfDraftPath) updates.pdf_draft_path = newPdfDraftPath;
      if (clerkId) updates.clerk_id = clerkId;

      // If there's a rejection reason, store it in form_data and rejected_name_comment
      if (rejectionReason && status === 'rejected' && profile) {
        // Get current memo to preserve existing form_data and get files for deletion
        const { data: currentMemo } = await (supabase as any)
          .from('memos')
          .select('form_data, revision_count, pdf_draft_path, attached_files')
          .eq('id', memoId)
          .single();

        if (currentMemo) {
          const currentFormData = currentMemo.form_data as any || {};
          updates.form_data = {
            ...currentFormData,
            rejection_reason: rejectionReason,
            rejected_at: new Date().toISOString()
          };

          // Increment revision_count
          const currentRevisionCount = currentMemo.revision_count || 0;
          updates.revision_count = currentRevisionCount + 1;

          // ลบ PDF และเอกสารแนบทันทีเมื่อถูกตีกลับ (เหมือน updateMemoApproval)
          console.log('🗑️ [updateMemoStatus] Deleting PDF and attachments due to rejection');

          // ลบ PDF draft
          console.log('📄 [updateMemoStatus] pdf_draft_path:', currentMemo.pdf_draft_path);
          if (currentMemo.pdf_draft_path) {
            try {
              const pdfPath = currentMemo.pdf_draft_path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, '');
              console.log('📄 [updateMemoStatus] PDF path to delete:', pdfPath);

              const { error: deletePdfError } = await supabase.storage
                .from('documents')
                .remove([pdfPath]);

              if (deletePdfError) {
                console.error('❌ [updateMemoStatus] Error deleting PDF:', deletePdfError);
              } else {
                console.log('✅ [updateMemoStatus] Deleted PDF:', pdfPath);
              }
            } catch (err) {
              console.error('❌ [updateMemoStatus] Error processing PDF deletion:', err);
            }
          }

          // ลบเอกสารแนบทั้งหมด
          console.log('📎 [updateMemoStatus] attached_files:', {
            value: currentMemo.attached_files,
            type: typeof currentMemo.attached_files
          });

          if (currentMemo.attached_files) {
            try {
              let attachedFilesArr: string[] = [];
              if (typeof currentMemo.attached_files === 'string') {
                try {
                  attachedFilesArr = JSON.parse(currentMemo.attached_files);
                  console.log('📎 [updateMemoStatus] Parsed attached_files:', attachedFilesArr);
                } catch {
                  attachedFilesArr = currentMemo.attached_files ? [currentMemo.attached_files] : [];
                }
              } else if (Array.isArray(currentMemo.attached_files)) {
                attachedFilesArr = currentMemo.attached_files;
              }

              if (attachedFilesArr.length > 0) {
                const attachmentPaths = attachedFilesArr
                  .map((url: string) => url?.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, ''))
                  .filter(Boolean);

                console.log('📎 [updateMemoStatus] Attachment paths to delete:', attachmentPaths);

                if (attachmentPaths.length > 0) {
                  const { error: deleteAttachmentsError } = await supabase.storage
                    .from('documents')
                    .remove(attachmentPaths);

                  if (deleteAttachmentsError) {
                    console.error('❌ [updateMemoStatus] Error deleting attachments:', deleteAttachmentsError);
                  } else {
                    console.log(`✅ [updateMemoStatus] Deleted ${attachmentPaths.length} attachment(s)`);
                  }
                }
              }
            } catch (err) {
              console.error('❌ [updateMemoStatus] Error processing attachments deletion:', err);
            }
          }

          // ล้างค่า pdf_draft_path และ attached_files ใน database
          updates.pdf_draft_path = null;
          updates.attached_files = null;
        }

        // Add rejected_name_comment JSONB data
        const rejectedNameComment = {
          name: `${profile.first_name} ${profile.last_name}`,
          comment: rejectionReason,
          rejected_at: new Date().toISOString(),
          position: profile.current_position || profile.job_position || profile.position || ''
        };
        updates.rejected_name_comment = rejectedNameComment;
      }

      const { error } = await supabase
        .from('memos')
        .update(updates)
        .eq('id', memoId);

      if (error) throw error;

      // Refresh memos
      await fetchMemos();

      toast({
        title: "อัปเดตสำเร็จ",
        description: "สถานะเอกสารได้ถูกอัปเดตแล้ว",
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating memo:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถอัปเดตสถานะเอกสารได้",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  const updateMemoSigners = async (memoId: string, signers: any[], signaturePositions: any[]) => {
    try {
      // ตรวจสอบว่า memo มีอยู่จริงก่อน
      const { data: existingMemo, error: checkError } = await (supabase as any)
        .from('memos')
        .select('id, status, doc_del')
        .eq('id', memoId)
        .single();

      if (checkError) {
        console.error('Error checking memo:', checkError);
        throw new Error(`ไม่พบเอกสาร: ${checkError.message}`);
      }

      if (!existingMemo) {
        throw new Error('ไม่พบเอกสารในระบบ');
      }

      if (existingMemo.doc_del) {
        throw new Error('เอกสารถูกลบแล้ว');
      }

      console.log('✅ Found memo:', existingMemo);

      const firstOrder = getFirstSignerOrder(signaturePositions);

      const { error } = await supabase
        .from('memos')
        .update({
          signature_positions: signaturePositions,
          status: 'pending_sign',
          current_signer_order: firstOrder // ใช้ order แรกจริงจาก signaturePositions (รองรับการข้ามผู้ลงนาม)
        })
        .eq('id', memoId);

      if (error) throw error;

      // Refresh memos
      await fetchMemos();
      
      toast({
        title: "ส่งเอกสารสำเร็จ",
        description: "เอกสารถูกส่งเข้าสู่กระบวนการลงนามแล้ว",
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating memo signers:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถส่งเอกสารเข้าสู่กระบวนการลงนามได้",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  const updateMemoApproval = async (memoId: string, action: 'approve' | 'reject', comment?: string, signOnBehalfUserId?: string) => {
    try {
      setLoading(true);

      // Debug: Log profile status
      console.log('🔍 [updateMemoApproval] Profile check:', {
        hasProfile: !!profile,
        profileName: profile ? `${profile.first_name} ${profile.last_name}` : 'NO PROFILE',
        action,
        comment
      });

      // Fetch fresh memo data from database (not from cached state)
      // This ensures we have the latest attached_files for deletion
      const { data: freshMemo, error: fetchError } = await supabase
        .from('memos')
        .select('*')
        .eq('id', memoId)
        .single();

      if (fetchError || !freshMemo) {
        console.error('Error fetching memo for approval:', fetchError);
        throw new Error('ไม่พบเอกสาร');
      }

      const memo = freshMemo as any;

      const signaturePositions = Array.isArray(memo.signature_positions) 
        ? memo.signature_positions 
        : [];
      const currentOrder = memo.current_signer_order || 1;

      // ใช้ centralized logic จาก approvalWorkflowService (รองรับ parallel group)
      const parallelSigners = memo.parallel_signers || null;
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = signOnBehalfUserId || session?.user?.id || '';

      const result = action === 'approve'
        ? calculateNextSignerOrderWithParallel(currentOrder, signaturePositions, undefined, parallelSigners, currentUserId)
        : calculateRejection();

      const newStatus = result.newStatus;
      const newSignerOrder = result.nextSignerOrder;

      const updateData: any = {
        status: newStatus,
        current_signer_order: newSignerOrder,
        updated_at: new Date().toISOString()
      };

      // อัปเดต parallel_signers.completed_user_ids ถ้ามี
      if ('parallelUpdate' in result && result.parallelUpdate && parallelSigners) {
        updateData.parallel_signers = {
          ...parallelSigners,
          completed_user_ids: result.parallelUpdate.completed_user_ids,
        };
      }

      // If rejecting, add rejected_name_comment and increment revision_count
      if (action === 'reject') {
        let rejectorProfile = profile;

        // If profile not available from context, try to fetch from supabase session
        if (!rejectorProfile) {
          console.log('⚠️ [updateMemoApproval] Profile not in context, fetching from supabase...');
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .single();

            if (profileData) {
              rejectorProfile = profileData as any;
              console.log('✅ [updateMemoApproval] Fetched profile:', `${rejectorProfile?.first_name} ${rejectorProfile?.last_name}`);
            }
          }
        }

        if (rejectorProfile) {
          const rejectedNameComment = {
            name: `${rejectorProfile.first_name} ${rejectorProfile.last_name}`,
            comment: comment || '',
            rejected_at: new Date().toISOString(),
            position: rejectorProfile.current_position || rejectorProfile.job_position || rejectorProfile.position || ''
          };
          updateData.rejected_name_comment = rejectedNameComment;
          console.log('✅ [updateMemoApproval] Set rejected_name_comment:', rejectedNameComment);
        } else {
          console.error('❌ [updateMemoApproval] Could not get profile for rejection');
          // Still set basic rejection info even without profile
          updateData.rejected_name_comment = {
            name: 'ไม่ทราบชื่อ',
            comment: comment || '',
            rejected_at: new Date().toISOString(),
            position: ''
          };
        }

        // Increment revision_count
        const currentRevisionCount = memo.revision_count || 0;
        updateData.revision_count = currentRevisionCount + 1;

        // Reset parallel_signers.completed_user_ids เมื่อตีกลับ
        if (parallelSigners) {
          updateData.parallel_signers = {
            ...parallelSigners,
            completed_user_ids: [],
          };
        }

        // ลบ PDF และเอกสารแนบทันทีเมื่อถูกตีกลับ
        console.log('🗑️ Deleting PDF and attachments due to rejection');

        // ลบ PDF draft
        console.log('📄 memo.pdf_draft_path:', memo.pdf_draft_path);
        if (memo.pdf_draft_path) {
          try {
            const pdfPath = memo.pdf_draft_path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, '');
            console.log('📄 PDF path to delete:', pdfPath);

            const { error: deletePdfError } = await supabase.storage
              .from('documents')
              .remove([pdfPath]);

            if (deletePdfError) {
              console.error('❌ Error deleting PDF:', deletePdfError);
            } else {
              console.log('✅ Deleted PDF:', pdfPath);
            }
          } catch (err) {
            console.error('❌ Error processing PDF deletion:', err);
          }
        } else {
          console.log('📄 No pdf_draft_path found in memo');
        }

        // ลบเอกสารแนบทั้งหมด (attached_files เป็น JSON string จาก database)
        console.log('📎 memo.attached_files:', {
          value: memo.attached_files,
          type: typeof memo.attached_files,
          isArray: Array.isArray(memo.attached_files)
        });

        if (memo.attached_files) {
          try {
            let attachedFilesArr: string[] = [];
            if (typeof memo.attached_files === 'string') {
              try {
                attachedFilesArr = JSON.parse(memo.attached_files);
                console.log('📎 Parsed attached_files from JSON string:', attachedFilesArr);
              } catch {
                attachedFilesArr = memo.attached_files ? [memo.attached_files] : [];
                console.log('📎 Failed to parse, using as single string:', attachedFilesArr);
              }
            } else if (Array.isArray(memo.attached_files)) {
              attachedFilesArr = memo.attached_files;
              console.log('📎 attached_files is already an array:', attachedFilesArr);
            }

            if (attachedFilesArr.length > 0) {
              const attachmentPaths = attachedFilesArr
                .map((url: string) => url?.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, ''))
                .filter(Boolean);

              console.log('📎 Attachment paths to delete:', attachmentPaths);

              if (attachmentPaths.length > 0) {
                const { error: deleteAttachmentsError } = await supabase.storage
                  .from('documents')
                  .remove(attachmentPaths);

                if (deleteAttachmentsError) {
                  console.error('❌ Error deleting attachments:', deleteAttachmentsError);
                } else {
                  console.log(`✅ Deleted ${attachmentPaths.length} attachment(s):`, attachmentPaths);
                }
              }
            } else {
              console.log('📎 No attachments to delete (empty array)');
            }
          } catch (err) {
            console.error('❌ Error processing attachments deletion:', err);
          }
        } else {
          console.log('📎 No attached_files found in memo');
        }

        // ล้างค่า pdf_draft_path และ attached_files ใน database
        updateData.pdf_draft_path = null;
        updateData.attached_files = null;
      }

      // Update signature positions with approval info
      if (memo.signature_positions) {
        const signaturePositions = Array.isArray(memo.signature_positions) 
          ? memo.signature_positions 
          : [];
        
        // หา order ที่จริงๆ ที่กำลังอนุมัติ (ข้าม order 1 ถ้าเป็นผู้เขียน)
        const currentApprovalOrder = memo.current_signer_order === 1 ? 2 : memo.current_signer_order;
        
        const updatedPositions = signaturePositions.map((pos: any) => {
          if (pos.signer?.order === currentApprovalOrder) {
            return {
              ...pos,
              approved_at: action === 'approve' ? new Date().toISOString() : null,
              status: action,
              comment: comment || null
            };
          }
          return pos;
        });
        updateData.signature_positions = updatedPositions;
      }


      const { error } = await supabase
        .from('memos')
        .update(updateData)
        .eq('id', memoId);

      if (error) throw error;


      // Reload memos to get updated data
      await fetchMemos();
      
      return { success: true };
    } catch (error) {
      console.error('Error updating memo approval:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถดำเนินการได้",
        variant: "destructive",
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemos();

    // Realtime subscription for memos table
    const memosSubscription = supabase
      .channel('realtime_memos')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memos'
        },
        (payload) => {
          console.log('🎯 Realtime memos update:', payload.eventType, (payload.new as any)?.id || (payload.old as any)?.id);
          // Refetch all memos when any change is detected
          fetchMemos();
        }
      )
      .subscribe((status) => {
        console.log('📡 Memos realtime status:', status);
      });

    // Listen for smart updates
    const handleMemoUpdated = (event: CustomEvent) => {
      const { memo, action } = event.detail;
      console.log('🔄 Applying smart memo update:', action, memo.id);
      
      setMemos(prevMemos => {
        if (action === 'INSERT') {
          // เพิ่ม memo ใหม่ถ้ายังไม่มี
          const exists = prevMemos.find(m => m.id === memo.id);
          if (!exists) {
            return [memo, ...prevMemos];
          }
          return prevMemos;
        } else if (action === 'UPDATE') {
          // อัพเดท memo ที่มีอยู่
          return prevMemos.map(m => m.id === memo.id ? { ...m, ...memo } : m);
        }
        return prevMemos;
      });
    };

    const handleMemoDeleted = (event: CustomEvent) => {
      const { memoId } = event.detail;
      console.log('�️ Removing deleted memo:', memoId);
      setMemos(prevMemos => prevMemos.filter(m => m.id !== memoId));
    };

    // Add event listeners
    window.addEventListener('memo-updated', handleMemoUpdated as EventListener);
    window.addEventListener('memo-deleted', handleMemoDeleted as EventListener);

    return () => {
      memosSubscription.unsubscribe();
      window.removeEventListener('memo-updated', handleMemoUpdated as EventListener);
      window.removeEventListener('memo-deleted', handleMemoDeleted as EventListener);
    };
  }, [fetchMemos]);

  return {
    memos,
    completedReportMemos,
    loading,
    getMemoById,
    updateMemoStatus,
    updateMemoSigners,
    updateMemoApproval,
    refetch: fetchMemos
  };
};