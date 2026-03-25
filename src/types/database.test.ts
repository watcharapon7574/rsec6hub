import { describe, it, expect } from 'vitest';
import {
  isAdmin,
  isExecutive,
  isClerk,
  isTeacher,
  getPositionDisplayName,
  type Profile,
  type Position,
} from './database';

// Helper: สร้าง profile จำลอง
const makeProfile = (overrides: Partial<Profile> = {}): Profile => ({
  id: '1',
  user_id: 'u1',
  employee_id: 'E001',
  first_name: 'ทดสอบ',
  last_name: 'ระบบ',
  position: 'government_teacher',
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
  ...overrides,
});

describe('isAdmin', () => {
  it('is_admin = true → admin', () => {
    expect(isAdmin(makeProfile({ is_admin: true, position: 'government_teacher' }))).toBe(true);
  });

  it('position = director → admin', () => {
    expect(isAdmin(makeProfile({ position: 'director' }))).toBe(true);
  });

  it('ครูธรรมดา → ไม่ใช่ admin', () => {
    expect(isAdmin(makeProfile({ position: 'government_teacher', is_admin: false }))).toBe(false);
  });

  it('is_admin undefined → ไม่ใช่ admin', () => {
    expect(isAdmin(makeProfile({ position: 'contract_teacher' }))).toBe(false);
  });
});

describe('isExecutive', () => {
  const executives: Position[] = ['director', 'deputy_director', 'assistant_director'];
  const nonExecutives: Position[] = ['government_teacher', 'government_employee', 'contract_teacher', 'clerk_teacher', 'disability_aide'];

  executives.forEach((pos) => {
    it(`${pos} → executive`, () => {
      expect(isExecutive(pos)).toBe(true);
    });
  });

  nonExecutives.forEach((pos) => {
    it(`${pos} → ไม่ใช่ executive`, () => {
      expect(isExecutive(pos)).toBe(false);
    });
  });
});

describe('isClerk', () => {
  it('clerk_teacher → clerk', () => {
    expect(isClerk('clerk_teacher')).toBe(true);
  });

  it('government_teacher → ไม่ใช่ clerk', () => {
    expect(isClerk('government_teacher')).toBe(false);
  });
});

describe('isTeacher', () => {
  it('government_teacher → teacher', () => {
    expect(isTeacher('government_teacher')).toBe(true);
  });

  it('contract_teacher → teacher', () => {
    expect(isTeacher('contract_teacher')).toBe(true);
  });

  it('clerk_teacher → ไม่ใช่ teacher', () => {
    expect(isTeacher('clerk_teacher')).toBe(false);
  });

  it('director → ไม่ใช่ teacher', () => {
    expect(isTeacher('director')).toBe(false);
  });
});

describe('getPositionDisplayName', () => {
  const cases: [Position, string][] = [
    ['director', 'ผู้อำนวยการ'],
    ['deputy_director', 'รองผู้อำนวยการ'],
    ['government_teacher', 'ครูข้าราชการ'],
    ['government_employee', 'ข้าราชการ'],
    ['contract_teacher', 'ครูอัตราจ้าง'],
    ['clerk_teacher', 'ธุรการ'],
    ['disability_aide', 'ผู้ช่วยเหลือคนพิการ'],
  ];

  cases.forEach(([position, expected]) => {
    it(`${position} → ${expected}`, () => {
      expect(getPositionDisplayName(position)).toBe(expected);
    });
  });

  it('assistant_director ไม่มี orgRole → หัวหน้าฝ่าย', () => {
    expect(getPositionDisplayName('assistant_director')).toBe('หัวหน้าฝ่าย');
  });

  it('assistant_director มี orgRole → ใช้ orgRole', () => {
    expect(getPositionDisplayName('assistant_director', 'หัวหน้ากลุ่มบริหารงานบุคคล')).toBe('หัวหน้ากลุ่มบริหารงานบุคคล');
  });
});
