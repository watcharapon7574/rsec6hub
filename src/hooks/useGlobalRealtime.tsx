import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook สำหรับตั้งค่า Realtime subscriptions ทุกตารางที่เกี่ยวข้องกับ Document และ Approval
 */
export const useGlobalRealtime = (callbacks: {
  onMemosChange?: () => void;
  onDocumentsChange?: () => void;
  onApprovalStepsChange?: () => void;
  onWorkflowsChange?: () => void;
  onProfilesChange?: () => void;
}) => {
  useEffect(() => {
    console.log('🚀 Setting up global realtime subscriptions...');

    // Memos table
    const memosChannel = supabase
      .channel('global_memos_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'memos'
      }, (payload) => {
        console.log('🔔 Global Memos update:', payload.eventType, (payload.new as any)?.id);
        callbacks.onMemosChange?.();
      })
      .subscribe();

    // Official Documents table
    const docsChannel = supabase
      .channel('global_docs_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'official_documents'
      }, (payload) => {
        console.log('🔔 Global Documents update:', payload.eventType, (payload.new as any)?.id);
        callbacks.onDocumentsChange?.();
      })
      .subscribe();

    // Memo Approval Steps table
    const approvalStepsChannel = supabase
      .channel('global_approval_steps_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'memo_approval_steps'
      }, (payload) => {
        console.log('🔔 Global Approval Steps update:', payload.eventType, (payload.new as any)?.id);
        callbacks.onApprovalStepsChange?.();
      })
      .subscribe();

    // Memo Workflows table
    const workflowsChannel = supabase
      .channel('global_workflows_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'memo_workflows'
      }, (payload) => {
        console.log('🔔 Global Workflows update:', payload.eventType, (payload.new as any)?.id);
        callbacks.onWorkflowsChange?.();
      })
      .subscribe();

    // Employee Profiles table
    const profilesChannel = supabase
      .channel('global_profiles_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'employee_profiles'
      }, (payload) => {
        console.log('🔔 Global Profiles update:', payload.eventType, (payload.new as any)?.id);
        callbacks.onProfilesChange?.();
      })
      .subscribe();

    // Monitor subscription status
    const checkStatus = () => {
      const channels = [memosChannel, docsChannel, approvalStepsChannel, workflowsChannel, profilesChannel];
      const subscribedCount = channels.filter(ch => ch.state === 'joined').length;
      console.log(`📊 Global Realtime Status: ${subscribedCount}/${channels.length} channels connected`);
    };

    const statusTimer = setInterval(checkStatus, 5000);

    return () => {
      console.log('🧹 Cleaning up global realtime subscriptions...');
      clearInterval(statusTimer);
      memosChannel.unsubscribe();
      docsChannel.unsubscribe();
      approvalStepsChannel.unsubscribe();
      workflowsChannel.unsubscribe();
      profilesChannel.unsubscribe();
    };
  }, [callbacks.onMemosChange, callbacks.onDocumentsChange, callbacks.onApprovalStepsChange, callbacks.onWorkflowsChange, callbacks.onProfilesChange]);
};
