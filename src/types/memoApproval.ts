export interface MemoApprovalData {
  id: string;
  document_title: string;
  content: string;
  created_at: string;
  approvals: ApprovalStep[];
  status: 'pending' | 'approved' | 'rejected';
}

export interface ApprovalStep {
  id: string;
  user_id: string;
  name: string;
  position: string;
  signature_url: string | null;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  step_order: number;
}