export interface OfficialDocument {
  id: string;
  subject: string;
  content: string;
  document_date: string;
  document_number?: string;
  recipient: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_progress';
  user_id: string;
  created_at: string;
  updated_at: string;
  current_approver_level?: number;
  pdf_path?: string;
  rejection_reason?: string;
  creator_profile?: {
    first_name: string;
    last_name: string;
    position: string;
  } | null;
}