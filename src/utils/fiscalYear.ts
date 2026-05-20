// ปีงบประมาณไทย: เริ่ม 1 ตุลาคม - 30 กันยายน
// ครึ่งแรก ต.ค. - มี.ค. = 1 / ครึ่งหลัง เม.ย. - ก.ย. = 2

export type FiscalHalf = 1 | 2;

export interface FiscalPeriod {
  year: number;
  half: FiscalHalf;
  start: Date;
  end: Date;
}

export function getFiscalYear(date: Date): number {
  const month = date.getMonth();
  const ceYear = date.getFullYear();
  const fiscalCe = month >= 9 ? ceYear + 1 : ceYear;
  return fiscalCe + 543;
}

export function getFiscalHalf(date: Date): FiscalHalf {
  const month = date.getMonth();
  if (month >= 9 || month <= 2) return 1;
  return 2;
}

export function getFiscalPeriod(date: Date = new Date()): FiscalPeriod {
  const year = getFiscalYear(date);
  const half = getFiscalHalf(date);
  const ceYear = year - 543;
  if (half === 1) {
    return {
      year,
      half,
      start: new Date(ceYear - 1, 9, 1),
      end: new Date(ceYear, 2, 31, 23, 59, 59),
    };
  }
  return {
    year,
    half,
    start: new Date(ceYear, 3, 1),
    end: new Date(ceYear, 8, 30, 23, 59, 59),
  };
}

export function formatFiscalPeriod(year: number, half: FiscalHalf): string {
  const ceYear = year - 543;
  if (half === 1) {
    const beStart = (ceYear - 1 + 543) % 100;
    const beEnd = year % 100;
    return `ครึ่งแรก ปีงบ ${year} (ต.ค. ${String(beStart).padStart(2, '0')} - มี.ค. ${String(beEnd).padStart(2, '0')})`;
  }
  const be = year % 100;
  return `ครึ่งหลัง ปีงบ ${year} (เม.ย. ${String(be).padStart(2, '0')} - ก.ย. ${String(be).padStart(2, '0')})`;
}

export function calculateLeaveDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 3600 * 24)) + 1);
}
