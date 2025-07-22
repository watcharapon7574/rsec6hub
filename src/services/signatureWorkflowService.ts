
export interface SignaturePosition {
  page: number;
  x: number;
  y: number;
}

export interface ApprovalStep {
  id: string;
  name: string;
  position: string;
  order: number;
  approved: boolean;
  approvedAt?: string;
  comment?: string;
  signatureUrl?: string;
}

export interface DocumentWorkflow {
  id: string;
  fileName: string;
  fileUrl: string;
  originalFileBlob: Blob;
  signaturePositions: SignaturePosition[];
  approvalSteps: ApprovalStep[];
  currentStepIndex: number;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  createdAt: string;
  completedAt?: string;
}

class SignatureWorkflowService {
  private workflows: Map<string, DocumentWorkflow> = new Map();

  createWorkflow(
    fileName: string,
    fileBlob: Blob,
    signaturePositions: SignaturePosition[],
    approvalSteps: ApprovalStep[]
  ): DocumentWorkflow {
    const workflow: DocumentWorkflow = {
      id: crypto.randomUUID(),
      fileName,
      fileUrl: URL.createObjectURL(fileBlob),
      originalFileBlob: fileBlob,
      signaturePositions,
      approvalSteps,
      currentStepIndex: 0,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  approveStep(
    workflowId: string,
    stepId: string,
    comment: string,
    signatureUrl?: string
  ): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const step = workflow.approvalSteps.find(s => s.id === stepId);
    if (!step) return false;

    step.approved = true;
    step.approvedAt = new Date().toISOString();
    step.comment = comment;
    step.signatureUrl = signatureUrl;

    // Move to next step if this was the current step
    if (workflow.approvalSteps[workflow.currentStepIndex]?.id === stepId) {
      workflow.currentStepIndex++;
      
      if (workflow.currentStepIndex >= workflow.approvalSteps.length) {
        workflow.status = 'completed';
        workflow.completedAt = new Date().toISOString();
      } else {
        workflow.status = 'in_progress';
      }
    }

    return true;
  }

  rejectWorkflow(workflowId: string, reason: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    workflow.status = 'rejected';
    return true;
  }

  async generateSignedPDF(workflowId: string): Promise<Blob | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'completed') return null;

    try {
      // This is a placeholder for PDF-lib integration
      // In a real implementation, you would:
      // 1. Load the original PDF with PDF-lib
      // 2. Add signatures and comments at specified positions
      // 3. Generate the final signed PDF
      
      // Mock signed PDF generation
      const signedPdfBlob = new Blob([workflow.originalFileBlob], { 
        type: 'application/pdf' 
      });

      return signedPdfBlob;
    } catch (error) {
      console.error('Error generating signed PDF:', error);
      return null;
    }
  }

  getWorkflow(workflowId: string): DocumentWorkflow | undefined {
    return this.workflows.get(workflowId);
  }

  getAllWorkflows(): DocumentWorkflow[] {
    return Array.from(this.workflows.values());
  }

  getCurrentApprover(workflowId: string): ApprovalStep | null {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.currentStepIndex >= workflow.approvalSteps.length) {
      return null;
    }

    return workflow.approvalSteps[workflow.currentStepIndex];
  }

  isUserCurrentApprover(workflowId: string, userPosition: string): boolean {
    const currentApprover = this.getCurrentApprover(workflowId);
    return currentApprover?.position === userPosition;
  }
}

export const signatureWorkflowService = new SignatureWorkflowService();
