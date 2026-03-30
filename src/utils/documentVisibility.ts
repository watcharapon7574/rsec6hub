import { isPDFUploadMemo } from './memoUtils';

/**
 * Parse org_structure_role เพื่อเช็คว่าเป็นเลขาฝ่ายหรือไม่
 * เช่น "เลขาฝ่ายบริหารทั่วไป" → { isSecretary: true, department: "ฝ่ายบริหารทั่วไป" }
 */
export function parseSecretaryRole(orgStructureRole: string | null | undefined): {
  isSecretary: boolean;
  department: string | null;
} {
  const role = orgStructureRole || '';
  if (role.startsWith('เลขา')) {
    return { isSecretary: true, department: role.replace('เลขา', '') };
  }
  return { isSecretary: false, department: null };
}

export interface DocumentVisibilityParams {
  permissions: {
    isAdmin: boolean;
    isClerk: boolean;
    position: string;
  };
  userId: string | undefined;
  isSecretary: boolean;
  secretaryDepartment: string | null;
}

/**
 * ตรวจสอบว่าเอกสารควรแสดงใน DocumentList หรือไม่ ตาม role ของ user
 * - Admin/Clerk: เห็นทุกฉบับ
 * - เลขาฝ่าย: เห็นเฉพาะเอกสารของฝ่ายตัวเอง (ไม่รวมเอกสารตัวเอง)
 * - ผช.ผอ/รองผอ: เห็นเฉพาะเอกสารที่ตัวเองอยู่ใน signer list หรือ PDF Upload
 * - ผอ: เห็นทุกฉบับ
 * - คนอื่น: เห็นเฉพาะเอกสารตัวเอง
 */
export const shouldShowMemo = (memo: any, params: DocumentVisibilityParams): boolean => {
  const { permissions, userId, isSecretary, secretaryDepartment } = params;

  // Admin เห็นเอกสารทุกฉบับ
  if (permissions.isAdmin) {
    return true;
  }

  // Clerk เห็นเอกสารทุกฉบับ
  if (permissions.isClerk) {
    return true;
  }

  // เลขาฝ่าย: เอกสารที่ stamp_department ตรงกับฝ่าย (รวมเอกสารตัวเองด้วย)
  if (isSecretary && secretaryDepartment) {
    return memo.stamp_department === secretaryDepartment;
  }

  // ผช.ผอ/รองผอ: เฉพาะเอกสารที่ตัวเองอยู่ใน signer list หรือ PDF Upload
  if (['assistant_director', 'deputy_director'].includes(permissions.position)) {
    if (isPDFUploadMemo(memo)) {
      return true;
    }
    if (memo.signer_list_progress && Array.isArray(memo.signer_list_progress)) {
      return memo.signer_list_progress.some((signer: any) => signer.user_id === userId);
    }
    if (memo.signature_positions && Array.isArray(memo.signature_positions)) {
      return memo.signature_positions.some((pos: any) => pos.signer?.user_id === userId);
    }
    return false;
  }

  // ผอ เห็นทุกฉบับ
  if (permissions.position === 'director') {
    return true;
  }

  // คนอื่น: เฉพาะเอกสารตัวเอง
  return memo.user_id === userId;
};
