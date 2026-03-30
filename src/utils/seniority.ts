/**
 * หาผู้อาวุโสที่สุดจาก employee_id (RSECxxx - ตัวเลขน้อยสุด = อาวุโสสุด)
 * Extract จาก TaskAssignmentService.getMostSeniorUser เพื่อให้ test ได้
 */
export function getMostSeniorUser(users: { userId: string; employeeId?: string }[]): string | null {
  if (users.length === 0) return null;
  if (users.length === 1) return users[0].userId;

  const sorted = [...users].sort((a, b) => {
    const numA = parseInt((a.employeeId || '').replace(/\D/g, ''), 10) || 999999;
    const numB = parseInt((b.employeeId || '').replace(/\D/g, ''), 10) || 999999;
    return numA - numB;
  });

  return sorted[0].userId;
}
