/**
 * Pure functions for DocumentList search/filter/sort
 * Extract จาก DocumentList.tsx เพื่อให้ test ได้
 */

/**
 * กรองเอกสารตามคำค้นหา (subject, author_name, doc_number, form_data.to)
 */
export function filterBySearch(memos: any[], searchTerm: string): any[] {
  if (!searchTerm) return memos;
  const term = searchTerm.toLowerCase();
  return memos.filter(memo =>
    memo.subject?.toLowerCase().includes(term) ||
    memo.creator_name?.toLowerCase().includes(term) ||
    memo.doc_number?.toLowerCase().includes(term) ||
    memo.form_data?.to?.toLowerCase().includes(term)
  );
}

/**
 * กรองเอกสารตามสถานะ — ใช้ memo.status เป็น source of truth
 * (เลี่ยงการชนระหว่าง sentinel COMPLETED=5 กับ signer order 5 จริง เช่น ผอ.)
 */
export function filterByStatus(memos: any[], statusFilter: string): any[] {
  if (statusFilter === 'all') return memos;

  return memos.filter(memo => {
    switch (statusFilter) {
      case 'draft': return memo.status === 'draft';
      case 'pending_sign': return memo.status === 'pending_sign';
      case 'completed': return memo.status === 'completed';
      case 'rejected': return memo.status === 'rejected';
      default: return true;
    }
  });
}

/**
 * กรองเอกสารตามประเภท (memo vs doc_receive)
 */
export function filterByType(memos: any[], typeFilter: string): any[] {
  if (typeFilter === 'all') return memos;

  return memos.filter(memo => {
    if (typeFilter === 'memo') return memo.__source_table !== 'doc_receive';
    if (typeFilter === 'doc_receive') return memo.__source_table === 'doc_receive';
    return true;
  });
}

/**
 * กรองเอกสารตามการมอบหมาย
 */
export function filterByAssignment(memos: any[], assignmentFilter: string): any[] {
  if (assignmentFilter === 'all') return memos;

  return memos.filter(memo => {
    if (assignmentFilter === 'assigned') return memo.is_assigned === true;
    if (assignmentFilter === 'not_assigned') return memo.status === 'completed' && !memo.is_assigned;
    return true;
  });
}

/**
 * เรียงเอกสารตามเงื่อนไข
 */
export function sortMemos(memos: any[], sortBy: string, sortOrder: 'asc' | 'desc'): any[] {
  const sorted = [...memos];

  sorted.sort((a, b) => {
    let aValue: any, bValue: any;

    switch (sortBy) {
      case 'subject':
        aValue = a.subject || '';
        bValue = b.subject || '';
        break;
      case 'status':
        aValue = a.current_signer_order || 0;
        bValue = b.current_signer_order || 0;
        break;
      case 'doc_number':
        aValue = a.doc_number || '';
        bValue = b.doc_number || '';
        break;
      case 'created_at':
        aValue = new Date(a.created_at || 0).getTime();
        bValue = new Date(b.created_at || 0).getTime();
        break;
      case 'updated_at':
      default:
        aValue = new Date(a.updated_at || a.created_at || 0).getTime();
        bValue = new Date(b.updated_at || b.created_at || 0).getTime();
        break;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  return sorted;
}
