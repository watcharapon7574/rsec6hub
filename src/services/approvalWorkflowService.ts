/**
 * ApprovalWorkflowService - Centralized approval/signing workflow logic
 *
 * รวม logic การเลื่อน current_signer_order ไว้จุดเดียว
 * รองรับการข้ามผู้ลงนาม (เช่น ข้ามผช.ผอ., ข้ามรองผอ., หรือข้ามทั้งคู่)
 *
 * State Machine:
 *   DRAFT (1) → first signer order → ... → COMPLETED (5)
 *                                     ↘ REJECTED (0)
 */

// === Constants ===

export const SIGNER_ORDER = {
  DRAFT: 1,
  REJECTED: 0,
  COMPLETED: 5,
} as const;

// === Types ===

export interface SignerOrderResult {
  nextSignerOrder: number;
  newStatus: 'draft' | 'pending_sign' | 'completed' | 'rejected';
}

export interface SignaturePositionLike {
  order?: number;
  signer?: { order?: number };
  [key: string]: any;
}

// === Pure Functions (ไม่แตะ DB, ทดสอบง่าย) ===

/**
 * ดึง order จาก signature position (รองรับทั้ง pos.order และ pos.signer.order)
 */
export function extractOrder(pos: SignaturePositionLike): number | null {
  const order = pos.signer?.order ?? pos.order ?? null;
  return typeof order === 'number' ? order : null;
}

/**
 * ดึง sorted unique orders จาก signaturePositions array
 */
export function getSortedSignerOrders(signaturePositions: SignaturePositionLike[]): number[] {
  if (!Array.isArray(signaturePositions) || signaturePositions.length === 0) {
    return [];
  }

  const orders = signaturePositions
    .map(extractOrder)
    .filter((o): o is number => o !== null && o > 0)
    .sort((a, b) => a - b);

  // unique
  return [...new Set(orders)];
}

/**
 * หา order แรก (ใช้ตอนส่งเอกสารเข้ากระบวนการ)
 */
export function getFirstSignerOrder(signaturePositions: SignaturePositionLike[]): number {
  const orders = getSortedSignerOrders(signaturePositions);
  return orders.length > 0 ? orders[0] : 2; // fallback to 2 if no positions
}

/**
 * คำนวณ nextSignerOrder หลังจาก approve
 * - หาคนถัดไปจาก positions จริง (ไม่ใช่ +1)
 * - รองรับการข้ามผู้ลงนาม
 * - Director (signingPosition === 'director') → completed ทันที
 */
export function calculateNextSignerOrder(
  currentOrder: number,
  signaturePositions: SignaturePositionLike[],
  signingPosition?: string
): SignerOrderResult {
  // Director shortcut: เสร็จทันที
  if (signingPosition === 'director') {
    return {
      nextSignerOrder: SIGNER_ORDER.COMPLETED,
      newStatus: 'completed',
    };
  }

  const orders = getSortedSignerOrders(signaturePositions);

  if (orders.length === 0) {
    // ไม่มี signer → completed
    return {
      nextSignerOrder: SIGNER_ORDER.COMPLETED,
      newStatus: 'completed',
    };
  }

  // หาคนถัดไปที่มี order > currentOrder
  const nextOrder = orders.find(o => o > currentOrder);

  if (nextOrder === undefined) {
    // ไม่มีคนถัดไป → completed
    return {
      nextSignerOrder: SIGNER_ORDER.COMPLETED,
      newStatus: 'completed',
    };
  }

  return {
    nextSignerOrder: nextOrder,
    newStatus: 'pending_sign',
  };
}

/**
 * คำนวณ result สำหรับ reject
 */
export function calculateRejection(): SignerOrderResult {
  return {
    nextSignerOrder: SIGNER_ORDER.REJECTED,
    newStatus: 'rejected',
  };
}

/**
 * ตรวจสอบว่า user เป็นผู้ลงนามคนปัจจุบันหรือไม่
 */
export function isCurrentSigner(
  userOrder: number,
  currentSignerOrder: number
): boolean {
  return userOrder === currentSignerOrder;
}

/**
 * ตรวจสอบว่าเอกสารอยู่ในสถานะที่ approve/reject ได้หรือไม่
 */
export function canActOnDocument(currentSignerOrder: number): boolean {
  return currentSignerOrder > SIGNER_ORDER.DRAFT
    && currentSignerOrder < SIGNER_ORDER.COMPLETED
    && currentSignerOrder !== SIGNER_ORDER.REJECTED;
}
