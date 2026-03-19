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

// === Parallel Signing Support ===

import { ParallelSignerConfig } from '@/types/memo';

export interface ParallelSignerOrderResult extends SignerOrderResult {
  parallelUpdate?: { completed_user_ids: string[] };
}

/**
 * คำนวณ nextSignerOrder สำหรับระบบที่มี parallel group
 * - ถ้าอยู่ใน parallel group → อัปเดต completed_user_ids, คง order เดิมจนครบ
 * - ถ้าไม่มี parallel → fallback ไปฟังก์ชันเดิม
 */
export function calculateNextSignerOrderWithParallel(
  currentOrder: number,
  signaturePositions: SignaturePositionLike[],
  signingPosition: string | undefined,
  parallelSigners: ParallelSignerConfig | null | undefined,
  currentUserId: string
): ParallelSignerOrderResult {
  // ถ้ามี parallel config และ order ตรงกับ parallel group
  if (parallelSigners && currentOrder === parallelSigners.order) {
    const completedIds = [...(parallelSigners.completed_user_ids || [])];
    if (!completedIds.includes(currentUserId)) {
      completedIds.push(currentUserId);
    }

    const allSignerIds = parallelSigners.signers.map(s => s.user_id);
    const allComplete = allSignerIds.every(id => completedIds.includes(id));

    if (!allComplete) {
      // ยังไม่ครบ → คง order เดิม, อัปเดต completed list
      return {
        nextSignerOrder: currentOrder,
        newStatus: 'pending_sign',
        parallelUpdate: { completed_user_ids: completedIds },
      };
    }
    // ครบทุกคนแล้ว → หาคนถัดไป + ส่ง parallelUpdate ด้วย
    const nextResult = calculateNextSignerOrder(currentOrder, signaturePositions, signingPosition);
    return {
      ...nextResult,
      parallelUpdate: { completed_user_ids: completedIds },
    };
  }

  // Fallback ไปฟังก์ชันเดิม (ไม่มี parallel)
  const result = calculateNextSignerOrder(currentOrder, signaturePositions, signingPosition);
  return { ...result };
}

/**
 * ตรวจสอบว่า parallel group เสร็จครบหรือยัง
 */
export function isParallelGroupComplete(
  parallelSigners: ParallelSignerConfig | null | undefined
): boolean {
  if (!parallelSigners) return true;
  const allIds = parallelSigners.signers.map(s => s.user_id);
  return allIds.every(id => (parallelSigners.completed_user_ids || []).includes(id));
}

/**
 * ตรวจสอบว่า user อยู่ใน parallel group หรือไม่
 */
export function isInParallelGroup(
  userId: string,
  parallelSigners: ParallelSignerConfig | null | undefined
): boolean {
  if (!parallelSigners) return false;
  return parallelSigners.signers.some(s => s.user_id === userId);
}

/**
 * ตรวจสอบว่า user เป็นผู้ลงนามคนปัจจุบันหรือไม่ (รองรับ parallel)
 */
export function isCurrentSignerWithParallel(
  userId: string,
  userOrder: number,
  currentSignerOrder: number,
  parallelSigners: ParallelSignerConfig | null | undefined
): boolean {
  // เช็ค parallel group ก่อน
  if (parallelSigners
    && currentSignerOrder === parallelSigners.order
    && isInParallelGroup(userId, parallelSigners)
    && !(parallelSigners.completed_user_ids || []).includes(userId)) {
    return true; // อยู่ใน parallel group และยังไม่ได้เซ็น
  }
  // Fallback เดิม
  return isCurrentSigner(userOrder, currentSignerOrder);
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
