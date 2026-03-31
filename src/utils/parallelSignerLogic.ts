/**
 * Logic สำหรับจัดการ parallel signers + admin dropdown
 * แยกออกจาก DocumentManagePage เพื่อให้ test ได้
 */

export interface Profile {
  user_id: string;
  prefix?: string;
  first_name: string;
  last_name: string;
  position: string;
  job_position?: string;
  current_position?: string;
  org_structure_role?: string;
  academic_rank?: string;
  signature_url?: string;
}

export interface ParallelSigner {
  user_id: string;
  name: string;
  position?: string;
  org_structure_role?: string;
  require_annotation: boolean;
}

export interface ParallelSignerConfig {
  enabled: boolean;
  signer_user_ids: string[];
  annotation_required_for?: string[];
}

export interface SplitResult {
  parallelSigners: ParallelSigner[];
  selectedAssistant: string;
  selectedDeputy: string;
  annotationRequiredUserIds: string[];
}

/**
 * แยกผู้บริหาร (deputy/assistant/director) ออกจาก parallel signers
 * ผู้บริหาร → ไป dropdown, ที่เหลือ → เป็น parallel signers
 */
export function splitParallelAndAdmins(
  config: ParallelSignerConfig,
  profiles: Profile[],
  currentAssistant: string = '',
  currentDeputy: string = ''
): SplitResult {
  const parallelSigners: ParallelSigner[] = [];
  let selectedAssistant = currentAssistant;
  let selectedDeputy = currentDeputy;
  const annotationRequiredUserIds = config.annotation_required_for || [];

  for (const uid of config.signer_user_ids) {
    const p = profiles.find(pr => pr.user_id === uid);
    if (!p) continue;

    // ผู้บริหาร → ย้ายไป dropdown
    if (p.position === 'deputy_director' && !selectedDeputy) {
      selectedDeputy = uid;
    } else if ((p.position === 'assistant_director' || p.org_structure_role?.includes('หัวหน้าฝ่าย')) && !selectedAssistant) {
      selectedAssistant = uid;
    } else if (p.position === 'director') {
      // director มีอยู่แล้ว ข้าม
    } else {
      // ไม่ใช่ผู้บริหาร → เป็น parallel signer
      parallelSigners.push({
        user_id: uid,
        name: `${p.prefix || ''}${p.first_name} ${p.last_name}`.trim(),
        position: p.job_position || p.current_position || '',
        org_structure_role: p.org_structure_role || '',
        require_annotation: annotationRequiredUserIds.includes(uid),
      });
    }
  }

  return { parallelSigners, selectedAssistant, selectedDeputy, annotationRequiredUserIds };
}

export interface Signer {
  order: number;
  user_id: string;
  name: string;
  position: string;
  role: string;
  [key: string]: any;
}

/**
 * รวม signers (จาก dropdown) + parallel signers เป็น allSigners
 * กรอง parallel ที่ซ้ำกับ admin ออก
 */
export function buildAllSigners(
  signers: Signer[],
  parallelSigners: ParallelSigner[],
  profiles: Profile[]
): Signer[] {
  // user_ids ของผู้บริหารใน dropdown
  const adminUserIds = new Set(signers.filter(s => s.role !== 'author').map(s => s.user_id));
  const filteredParallel = parallelSigners.filter(ps => !adminUserIds.has(ps.user_id));

  if (filteredParallel.length === 0) return signers;

  const result: Signer[] = [];
  let orderCounter = 1;

  for (const signer of signers) {
    result.push({ ...signer, order: orderCounter++ });

    // แทรก parallel signers หลัง author
    if (signer.role === 'author') {
      const parallelOrder = orderCounter;
      for (const ps of filteredParallel) {
        const p = profiles.find(pr => pr.user_id === ps.user_id);
        result.push({
          order: parallelOrder,
          user_id: ps.user_id,
          name: ps.name,
          position: p?.current_position || p?.position || ps.position || '',
          role: 'parallel_signer',
        });
      }
      orderCounter++;
    }
  }

  return result;
}

/**
 * หา index ของผู้บริหารคนแรกใน allSigners (สำหรับ default selection)
 */
export function findFirstAdminIndex(allSigners: Signer[]): number {
  const adminRoles = ['assistant_director', 'deputy_director', 'director'];
  return allSigners.findIndex(s => adminRoles.includes(s.role));
}
