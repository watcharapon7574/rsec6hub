import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';

export interface MemoRecord {
  id: string;
  subject: string;
  introduction?: string;
  author_name: string;
  author_position: string;
  status: string;
  created_at: string;
  doc_number: string;
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
}

export const useAllMemos = () => {
  const [memos, setMemos] = useState<MemoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { profile } = useEmployeeAuth();

  const fetchMemos = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const firstDay = `${year}-${month}-01T00:00:00.000Z`;
      const nextMonth = new Date(year, now.getMonth() + 1, 1);
      const lastDay = nextMonth.toISOString();
      const { data, error } = await supabase
        .from('memos')
        .select('*')
        .gte('created_at', firstDay)
        .lt('created_at', lastDay)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching memos:', error);
        throw error;
      }
      
      // Transform data to match MemoRecord type
      const transformedData = data?.map(memo => ({
        ...memo,
        attached_files: (() => {
          try {
            return memo.attached_files ? JSON.parse(memo.attached_files) : [];
          } catch {
            return [];
          }
        })()
      })) || [];
      
      setMemos(transformedData as MemoRecord[]);
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
  };

  const getMemoById = (id: string): MemoRecord | null => {
    return memos.find(memo => memo.id === id) || null;
  };

  const updateMemoStatus = async (memoId: string, status: string, docNumber?: string, rejectionReason?: string, currentSignerOrder?: number, newPdfDraftPath?: string) => {
    try {
      const updates: any = { status };
      if (docNumber) updates.doc_number = docNumber;
      if (typeof currentSignerOrder === 'number') updates.current_signer_order = currentSignerOrder;
      if (newPdfDraftPath) updates.pdf_draft_path = newPdfDraftPath;

      // If there's a rejection reason, store it in form_data and rejected_name_comment
      if (rejectionReason && status === 'rejected' && profile) {
        // Get current memo to preserve existing form_data
        const { data: currentMemo } = await supabase
          .from('memos')
          .select('form_data')
          .eq('id', memoId)
          .single();

        if (currentMemo) {
          const currentFormData = currentMemo.form_data as any || {};
          updates.form_data = {
            ...currentFormData,
            rejection_reason: rejectionReason,
            rejected_at: new Date().toISOString()
          };
        }

        // Add rejected_name_comment JSONB data
        const rejectedNameComment = {
          name: `${profile.first_name} ${profile.last_name}`,
          comment: rejectionReason,
          rejected_at: new Date().toISOString(),
          position: profile.current_position || profile.job_position || profile.position || ''
        };
        updates.rejected_name_comment = JSON.stringify(rejectedNameComment);
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
      const { error } = await supabase
        .from('memos')
        .update({
          signature_positions: signaturePositions,
          status: 'pending_sign',
          current_signer_order: 2 // เมื่อส่งเอกสารเข้ากระบวนการ ให้ set current_signer_order = 2 (หรือ 4 ถ้าเป็นผอ.)
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

  const updateMemoApproval = async (memoId: string, action: 'approve' | 'reject', comment?: string) => {
    try {
      setLoading(true);
      
      // Get current memo to understand the approval flow
      const memo = getMemoById(memoId);
      if (!memo) {
        throw new Error('ไม่พบเอกสาร');
      }

      let newStatus = memo.status;
      let newSignerOrder = memo.current_signer_order || 1;

      if (action === 'approve') {
        // Move to next signer
        const signaturePositions = Array.isArray(memo.signature_positions) 
          ? memo.signature_positions 
          : [];
        const maxOrder = Math.max(...(signaturePositions.map((pos: any) => pos.signer?.order) || [1]));
        
        
        // หา current_signer_order ถัดไป (ข้าม order 1 ถ้าเป็นผู้เขียน)
        const currentOrder = memo.current_signer_order || 1;
        const nextOrder = currentOrder === 1 ? 2 : currentOrder; // ถ้าเป็น 1 (ผู้เขียน) ให้เริ่มที่ 2
        
        
        if (nextOrder < maxOrder) {
          // More approvers needed - ไปคนต่อไป
          newSignerOrder = nextOrder + 1;
          newStatus = 'pending_sign';
        } else {
          // All approvals complete
          newStatus = 'completed';
          newSignerOrder = 5; // เมื่อ approve คนสุดท้าย ให้ set current_signer_order = 5
        }
      } else {
        // Rejection
        newStatus = 'rejected';
        newSignerOrder = 0; // เมื่อ reject ให้ set current_signer_order = 0
      }

      const updateData: any = {
        status: newStatus,
        current_signer_order: newSignerOrder,
        updated_at: new Date().toISOString()
      };

      // If rejecting, add rejected_name_comment
      if (action === 'reject' && profile) {
        const rejectedNameComment = {
          name: `${profile.first_name} ${profile.last_name}`,
          comment: comment || '',
          rejected_at: new Date().toISOString(),
          position: profile.current_position || profile.job_position || profile.position || ''
        };
        updateData.rejected_name_comment = JSON.stringify(rejectedNameComment);
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

    // Real-time subscription for memos changes (TEMPORARILY DISABLED)
    // TODO: Enable after Supabase Realtime is properly configured
    // const subscription = supabase
    //   .channel('memos_realtime_updates')
    //   .on('postgres_changes', 
    //     { 
    //       event: '*', 
    //       schema: 'public', 
    //       table: 'memos' 
    //     }, 
    //     (payload) => {
    //       // Debounce การ refetch เพื่อป้องกันการเรียกบ่อยเกินไป
    //       setTimeout(() => {
    //         fetchMemos();
    //       }, 500);
    //     }
    //   )
    //   .subscribe((status) => {
    //   });

    return () => {
      // subscription.unsubscribe();
    };
  }, []);

  return {
    memos,
    loading,
    getMemoById,
    updateMemoStatus,
    updateMemoSigners,
    updateMemoApproval,
    refetch: fetchMemos
  };
};