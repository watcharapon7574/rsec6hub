import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSmartRealtime = () => {
  const updateSingleMemo = (memoId: string, payload: any) => {
    // Simple memo update for DocumentList only
    console.log('🔄 DocumentList memo update:', memoId, payload.eventType);
    
    // Dispatch custom event for DocumentList to handle
    const event = new CustomEvent('memo-updated', {
      detail: { memoId, payload }
    });
    window.dispatchEvent(event);
  };

  return {
    updateSingleMemo
  };
};

// Default export as well for compatibility
export default useSmartRealtime;
