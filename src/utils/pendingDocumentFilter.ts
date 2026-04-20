/**
 * Pure functions for PendingDocumentCard filtering
 * Extract จาก PendingDocumentCard.tsx เพื่อให้ test ได้
 */

export interface PendingFilterProfile {
  user_id: string;
  is_admin?: boolean | null;
  position?: string;
}

/**
 * กรองเอกสาร pending สำหรับ PendingDocumentCard
 * - Executive เห็นทุก pending_sign
 * - Parallel group member เห็นถ้ายังไม่เซ็น
 * - Regular user เห็นเฉพาะที่ถึงคิวตัวเอง + ไม่ใช่เจ้าของเอกสาร
 *
 * NOTE: ใช้ memo.status === 'pending_sign' เป็น gate หลัก
 * ไม่ใช้ current_signer_order === 5 เช็ค completed เพราะชนกับ signer order 5 จริง (ผอ.)
 */
export function filterPendingMemos(
  memos: any[],
  profile: PendingFilterProfile | null
): any[] {
  if (!profile) return [];

  const isAdmin = profile.is_admin === true;
  const isExecutive = isAdmin || ['assistant_director', 'deputy_director', 'director'].includes(profile.position || '');

  return memos.filter(memo => {
    // soft delete
    if (memo.doc_del) return false;

    // ต้องเป็น pending_sign เท่านั้น (ตัด draft/completed/rejected)
    if (memo.status !== 'pending_sign') return false;

    // Executive: ทุก pending_sign (รวม order 5 เช่น ผอ.)
    if (isExecutive) {
      return memo.current_signer_order >= 2;
    }

    // Parallel group check
    const parallelConfig = memo.parallel_signers;
    if (parallelConfig && memo.current_signer_order === parallelConfig.order) {
      const isInGroup = parallelConfig.signers?.some((s: any) => s.user_id === profile.user_id);
      const hasCompleted = (parallelConfig.completed_user_ids || []).includes(profile.user_id);
      if (isInGroup && !hasCompleted) {
        return true;
      }
    }

    // Regular user: ต้องอยู่ใน signer_list_progress + ถึงคิว + ไม่ใช่เจ้าของ
    if (!memo.signer_list_progress) return false;

    const signerList = Array.isArray(memo.signer_list_progress) ? memo.signer_list_progress : [];
    const userSigner = signerList.find((signer: any) => signer.user_id === profile.user_id);
    const nextSignerOrder = memo.current_signer_order === 1 ? 2 : memo.current_signer_order;
    const isCurrentApprover = userSigner && userSigner.order === nextSignerOrder;
    const isNotAuthor = memo.user_id !== profile.user_id;
    return isCurrentApprover && isNotAuthor && memo.current_signer_order >= 2;
  });
}
