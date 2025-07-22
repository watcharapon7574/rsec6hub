import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook สำหรับ Smart Realtime Updates - อัพเดทแค่จุดที่เปลี่ยนแปลง
 */
export const useSmartRealtime = () => {
  
  // อัพเดทแค่ memo ที่เปลี่ยน
  const updateSingleMemo = useCallback(async (memoId: string, payload: any) => {
    console.log('🎯 Smart update memo:', memoId, payload.eventType);
    
    // ถ้าเป็น INSERT หรือ UPDATE ให้ fetch แค่ memo นั้น
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      try {
        const { data, error } = await supabase
          .from('memos')
          .select('*')
          .eq('id', memoId)
          .single();
          
        if (!error && data) {
          // Trigger event เพื่อ update local state
          window.dispatchEvent(new CustomEvent('memo-updated', { 
            detail: { memo: data, action: payload.eventType } 
          }));
        }
      } catch (error) {
        console.error('Error fetching updated memo:', error);
      }
    }
    
    // ถ้าเป็น DELETE ให้ remove จาก local state
    if (payload.eventType === 'DELETE') {
      window.dispatchEvent(new CustomEvent('memo-deleted', { 
        detail: { memoId, action: 'DELETE' } 
      }));
    }
  }, []);

  // อัพเดทแค่ document ที่เปลี่ยน
  const updateSingleDocument = useCallback(async (docId: string, payload: any) => {
    console.log('🎯 Smart update document:', docId, payload.eventType);
    
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      try {
        const { data, error } = await supabase
          .from('official_documents')
          .select('*')
          .eq('id', docId)
          .single();
          
        if (!error && data) {
          window.dispatchEvent(new CustomEvent('document-updated', { 
            detail: { document: data, action: payload.eventType } 
          }));
        }
      } catch (error) {
        console.error('Error fetching updated document:', error);
      }
    }
    
    if (payload.eventType === 'DELETE') {
      window.dispatchEvent(new CustomEvent('document-deleted', { 
        detail: { docId, action: 'DELETE' } 
      }));
    }
  }, []);

  // อัพเดท approval step
  const updateApprovalStep = useCallback(async (stepId: string, payload: any) => {
    console.log('🎯 Smart update approval step:', stepId, payload.eventType);
    
    // อัพเดท memo ที่เกี่ยวข้องเพื่อให้ status เปลี่ยน
    const workflowId = payload.new?.workflow_id || payload.old?.workflow_id;
    if (workflowId) {
      window.dispatchEvent(new CustomEvent('approval-step-updated', { 
        detail: { workflowId, action: payload.eventType } 
      }));
    }
  }, []);

  return {
    updateSingleMemo,
    updateSingleDocument,
    updateApprovalStep
  };
};
