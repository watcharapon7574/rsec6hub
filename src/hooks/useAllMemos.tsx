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

const INITIAL_LIMIT = 60;
const LOAD_MORE_LIMIT = 60;

const MEMO_SELECT = `
  *,
  task_assignments!task_assignments_memo_id_fkey(
    id,
    status,
    deleted_at
  )
`;

const transformMemoRow = (memo: any): MemoRecord => {
  const tasks = memo.task_assignments || [];
  const hasInProgressTask = tasks.some((task: any) =>
    task.status === 'in_progress' && task.deleted_at === null
  );
  const hasActiveTasks = tasks.some((task: any) =>
    (task.status === 'pending' || task.status === 'in_progress') && task.deleted_at === null
  );
  const { task_assignments, ...rest } = memo;
  return {
    ...rest,
    attached_files: (() => {
      try {
        return rest.attached_files ? JSON.parse(rest.attached_files) : [];
      } catch {
        return [];
      }
    })(),
    has_in_progress_task: hasInProgressTask,
    has_active_tasks: hasActiveTasks,
  } as MemoRecord;
};

export const useAllMemos = () => {
  const [memos, setMemos] = useState<MemoRecord[]>([]);
  const [completedReportMemos, setCompletedReportMemos] = useState<MemoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const { toast } = useToast();
  const { profile } = useEmployeeAuth();

  // ใช้ useCallback เพื่อให้ fetchMemos stable และไม่เป็น stale closure
  const fetchMemos = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await (supabase as any)
        .from('memos')
        .select(MEMO_SELECT)
        .is('doc_del', null)
        .order('created_at', { ascending: false })
        .limit(INITIAL_LIMIT);
      if (error) {
        console.error('Error fetching memos:', error);
        throw error;
      }

      const transformedData = (data || []).map(transformMemoRow);

      setMemos(transformedData as MemoRecord[]);
      setHasMore(transformedData.length === INITIAL_LIMIT);

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

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    const cursor = memos[memos.length - 1]?.created_at;
    if (!cursor) {
      setHasMore(false);
      return;
    }
    try {
      setIsLoadingMore(true);
      const { data, error } = await (supabase as any)
        .from('memos')
        .select(MEMO_SELECT)
        .is('doc_del', null)
        .lt('created_at', cursor)
        .order('created_at', { ascending: false })
        .limit(LOAD_MORE_LIMIT);
      if (error) throw error;
      const transformed = (data || []).map(transformMemoRow);
      setMemos(prev => {
        const seen = new Set(prev.map(m => m.id));
        return [...prev, ...transformed.filter((m: MemoRecord) => !seen.has(m.id))];
      });
      setHasMore(transformed.length === LOAD_MORE_LIMIT);
    } catch (error) {
      console.error('Error loading more memos:', error);
      toast({
        title: 'โหลดเอกสารเก่าไม่สำเร็จ',
        description: 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [memos, hasMore, isLoadingMore, toast]);

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
          if (currentMemo.pdf_draft_path) {
            try {
              const pdfPath = currentMemo.pdf_draft_path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, '');

              const { error: deletePdfError } = await supabase.storage
                .from('documents')
                .remove([pdfPath]);

              if (deletePdfError) {
                console.error('Error deleting PDF:', deletePdfError);
              }
            } catch (err) {
              console.error('Error processing PDF deletion:', err);
            }
          }

          // ลบเอกสารแนบทั้งหมด
          if (currentMemo.attached_files) {
            try {
              let attachedFilesArr: string[] = [];
              if (typeof currentMemo.attached_files === 'string') {
                try {
                  attachedFilesArr = JSON.parse(currentMemo.attached_files);
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

                if (attachmentPaths.length > 0) {
                  const { error: deleteAttachmentsError } = await supabase.storage
                    .from('documents')
                    .remove(attachmentPaths);

                  if (deleteAttachmentsError) {
                    console.error('Error deleting attachments:', deleteAttachmentsError);
                  }
                }
              }
            } catch (err) {
              console.error('Error processing attachments deletion:', err);
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
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .single();

            if (profileData) {
              rejectorProfile = profileData as any;
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
        if (memo.pdf_draft_path) {
          try {
            const pdfPath = memo.pdf_draft_path.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, '');

            const { error: deletePdfError } = await supabase.storage
              .from('documents')
              .remove([pdfPath]);

            if (deletePdfError) {
              console.error('Error deleting PDF:', deletePdfError);
            }
          } catch (err) {
            console.error('Error processing PDF deletion:', err);
          }
        }

        // ลบเอกสารแนบทั้งหมด (attached_files เป็น JSON string จาก database)

        if (memo.attached_files) {
          try {
            let attachedFilesArr: string[] = [];
            if (typeof memo.attached_files === 'string') {
              try {
                attachedFilesArr = JSON.parse(memo.attached_files);
              } catch {
                attachedFilesArr = memo.attached_files ? [memo.attached_files] : [];
              }
            } else if (Array.isArray(memo.attached_files)) {
              attachedFilesArr = memo.attached_files;
            }

            if (attachedFilesArr.length > 0) {
              const attachmentPaths = attachedFilesArr
                .map((url: string) => url?.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/documents\//, ''))
                .filter(Boolean);

              if (attachmentPaths.length > 0) {
                const { error: deleteAttachmentsError } = await supabase.storage
                  .from('documents')
                  .remove(attachmentPaths);

                if (deleteAttachmentsError) {
                  console.error('Error deleting attachments:', deleteAttachmentsError);
                }
              }
            }
          } catch (err) {
            console.error('Error processing attachments deletion:', err);
          }
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

    // Realtime subscription for memos table — update in-place เพื่อไม่ reset chunks ที่ lazy-loaded มาแล้ว
    const memosSubscription = supabase
      .channel('realtime_memos')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'memos'
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as MemoRecord;
            setMemos(prev => {
              if (prev.some(m => m.id === row.id)) return prev;
              const next = [row, ...prev];
              next.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              );
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as MemoRecord;
            setMemos(prev =>
              prev.map(m => (m.id === row.id ? { ...m, ...row } : m))
            );
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as any)?.id;
            if (id) setMemos(prev => prev.filter(m => m.id !== id));
          }
        }
      )
      .subscribe();

    // Listen for smart updates
    const handleMemoUpdated = (event: CustomEvent) => {
      const { memo, action } = event.detail;
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
    isLoadingMore,
    hasMore,
    loadMore,
    getMemoById,
    updateMemoStatus,
    updateMemoSigners,
    updateMemoApproval,
    refetch: fetchMemos
  };
};