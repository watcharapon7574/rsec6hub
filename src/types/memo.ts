export interface MemoFormData {
  doc_number: string;
  date: string;
  subject: string;
  attachment_title?: string;
  introduction?: string;
  author_name: string;
  author_position: string;
  fact?: string;
  proposal?: string;
  attached_files?: string[];
}

export interface SignaturePosition {
  user_id: string;
  name: string;
  position: string;
  order: number;
  x: number;
  y: number;
  page: number;
  signature_url?: string;
  prefix?: string; // คำนำหน้าชื่อ
  academic_rank?: string; // ตำแหน่งทางวิชาการ
  org_structure_role?: string; // ตำแหน่งโครงสร้าง
}

export interface MemoSignature {
  user_id: string;
  name: string;
  position: string;
  comment: string;
  signed_at: string;
  signature_url: string;
  status: 'approved' | 'rejected';
  order: number;
  prefix?: string; // คำนำหน้าชื่อ
  academic_rank?: string; // ตำแหน่งทางวิชาการ
  org_structure_role?: string; // ตำแหน่งโครงสร้าง
}

export interface Memo {
  id: string;
  doc_number: string;
  subject: string;
  date: string;
  attachment_title?: string;
  introduction?: string;
  author_name: string;
  author_position: string;
  fact?: string;
  proposal?: string;
  document_summary?: string; // สรุปเนื้อหาเอกสาร
  status: 'draft' | 'pending_sign' | 'approved' | 'rejected';
  created_by: string;
  created_at: string;
  updated_at: string;
  form_data: MemoFormData;
  pdf_draft_path?: string;
  pdf_final_path?: string;
  signature_positions: SignaturePosition[];
  signatures: MemoSignature[];
  current_signer_order: number;
  attached_files?: string[];
}

export interface MemoNotification {
  id: string;
  memo_id: string;
  user_id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}