
import { supabase } from '@/integrations/supabase/client';

export interface MemoWorkflowData {
  document_number: string;
  subject: string;
  content: {
    introduction: string;
    facts: string;
    recommendation: string;
  };
  document_date: string;
  created_by: string;
  signature_positions: {
    assistant?: { x: number; y: number };
    deputy?: { x: number; y: number };
    director: { x: number; y: number };
  };
}

export interface ApprovalStepData {
  step_order: number;
  approver_id: string;
  approver_name: string;
  approver_position: string;
  signature_position: { x: number; y: number };
}

class MemoWorkflowService {
  async createWorkflow(
    workflowData: MemoWorkflowData,
    approvalSteps: ApprovalStepData[]
  ) {
    try {

      // Create workflow
      const { data: workflow, error: workflowError } = await supabase
        .from('memo_workflows')
        .insert({
          document_number: workflowData.document_number,
          subject: workflowData.subject,
          content: workflowData.content,
          document_date: workflowData.document_date,
          created_by: workflowData.created_by,
          signature_positions: workflowData.signature_positions,
          status: 'pending',
          current_step: 1
        })
        .select()
        .single();

      if (workflowError) {
        console.error('Error creating workflow:', workflowError);
        throw workflowError;
      }


      // Create approval steps
      if (approvalSteps.length > 0) {
        const stepsToInsert = approvalSteps.map(step => ({
          workflow_id: workflow.id,
          step_order: step.step_order,
          approver_id: step.approver_id,
          approver_name: step.approver_name,
          approver_position: step.approver_position,
          signature_position: step.signature_position,
          status: 'pending'
        }));

        const { error: stepsError } = await supabase
          .from('memo_approval_steps')
          .insert(stepsToInsert);

        if (stepsError) {
          console.error('Error creating approval steps:', stepsError);
          throw stepsError;
        }
      }

      return workflow;
    } catch (error) {
      console.error('Error in createWorkflow:', error);
      throw error;
    }
  }

  async getWorkflowById(workflowId: string) {
    try {
      const { data: workflow, error: workflowError } = await supabase
        .from('memo_workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (workflowError) throw workflowError;

      const { data: steps, error: stepsError } = await supabase
        .from('memo_approval_steps')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('step_order');

      if (stepsError) throw stepsError;

      return { workflow, steps: steps || [] };
    } catch (error) {
      console.error('Error getting workflow:', error);
      throw error;
    }
  }

  async getUserWorkflows(userId: string) {
    try {
      const { data, error } = await supabase
        .from('memo_workflows')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user workflows:', error);
      throw error;
    }
  }

  async getPendingApprovals(userId: string) {
    try {
      const { data, error } = await supabase
        .from('memo_approval_steps')
        .select(`
          *,
          memo_workflows (
            id,
            document_number,
            subject,
            document_date,
            status,
            current_step
          )
        `)
        .eq('approver_id', userId)
        .eq('status', 'pending');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting pending approvals:', error);
      throw error;
    }
  }
}

export const memoWorkflowService = new MemoWorkflowService();
