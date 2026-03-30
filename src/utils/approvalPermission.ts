/**
 * Pure functions for ApproveDocumentPage permission checks
 * Extract จาก ApproveDocumentPage.tsx เพื่อให้ test ได้
 */

export interface ApprovalProfile {
  user_id: string;
  is_admin?: boolean | null;
  position?: string;
}

export interface ApprovalMemo {
  status: string;
  current_signer_order: number;
  signer_list_progress?: any[] | null;
  signature_positions?: any[] | null;
  parallel_signers?: {
    order: number;
    signers: { user_id: string }[];
    completed_user_ids?: string[];
  } | null;
}

export type ApprovalAccess =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string; redirect: boolean };

/**
 * ตรวจสอบสิทธิ์การเข้าถึงหน้าอนุมัติเอกสาร
 *
 * Priority:
 * 1. Admin → allowed
 * 2. Parallel group member (ถึงคิว + ยังไม่เซ็น) → allowed
 * 3. ไม่อยู่ใน signer list เลย → denied + redirect
 * 4. Management + มี signature → allowed (อาจยังไม่ถึงคิวแต่ดูได้)
 * 5. Regular user + ถึงคิว → allowed
 * 6. Regular user + ยังไม่ถึงคิว → denied + redirect
 */
export function checkApprovalAccess(
  profile: ApprovalProfile,
  memo: ApprovalMemo
): ApprovalAccess {
  const isAdminUser = profile.is_admin === true;
  const isManagementRole = isAdminUser || ['assistant_director', 'deputy_director', 'director'].includes(profile.position || '');

  // Find user in signer lists
  const signerListProgress = Array.isArray(memo.signer_list_progress) ? memo.signer_list_progress : [];
  const signaturePositions = Array.isArray(memo.signature_positions) ? memo.signature_positions : [];

  const currentUserSigner = signerListProgress.find((s: any) => s.user_id === profile.user_id);
  const currentUserSignature = signaturePositions.find((p: any) => p.signer?.user_id === profile.user_id);
  const hasSignatureInDocument = (currentUserSigner || currentUserSignature) && memo.status === 'pending_sign';

  // 1. Admin bypass
  if (isAdminUser) {
    return { allowed: true, reason: 'admin_bypass' };
  }

  // 2. Parallel group check
  const pc = memo.parallel_signers;
  if (pc) {
    const isInGroup = pc.signers.some(s => s.user_id === profile.user_id);
    const hasCompleted = (pc.completed_user_ids || []).includes(profile.user_id);
    const isTurn = memo.current_signer_order === pc.order;

    if (isInGroup && isTurn && !hasCompleted) {
      return { allowed: true, reason: 'parallel_turn' };
    }
  }

  // 3. Not in any signer list and not parallel member
  const isParallelMember = pc ? pc.signers.some(s => s.user_id === profile.user_id) : false;
  if (!currentUserSigner && !currentUserSignature && !isParallelMember) {
    return { allowed: false, reason: 'not_in_signer_list', redirect: true };
  }

  // 4. Management with signature → allow (can view before turn)
  if (isManagementRole && hasSignatureInDocument) {
    return { allowed: true, reason: 'management_with_signature' };
  }

  // 5/6. Regular user — check signer order
  const userOrder = currentUserSigner?.order || currentUserSignature?.signer?.order;
  const userCanSign = !!(currentUserSigner || currentUserSignature);

  if (userOrder === memo.current_signer_order) {
    return { allowed: true, reason: 'current_signer' };
  }

  // userCanSign but order mismatch — still allow (guarded in original code)
  if (userCanSign) {
    return { allowed: true, reason: 'signer_order_mismatch_but_allowed' };
  }

  return { allowed: false, reason: 'not_current_signer', redirect: true };
}
