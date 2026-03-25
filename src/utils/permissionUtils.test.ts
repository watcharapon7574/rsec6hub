import { describe, it, expect } from 'vitest';
import { getPermissions } from './permissionUtils';
import type { Profile } from '@/types/database';

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

describe('getPermissions', () => {
  it('null profile → ทุก field เป็น false', () => {
    const perms = getPermissions(null);
    expect(perms.isAdmin).toBe(false);
    expect(perms.isManagement).toBe(false);
    expect(perms.isTeacher).toBe(false);
    expect(perms.isEmployee).toBe(false);
    expect(perms.isClerk).toBe(false);
    expect(perms.position).toBe('');
    expect(perms.displayName).toBe('');
  });

  it('admin (is_admin=true) → ทุก field เป็น true', () => {
    const perms = getPermissions(makeProfile({ is_admin: true }));
    expect(perms.isAdmin).toBe(true);
    expect(perms.isManagement).toBe(true);
    expect(perms.isTeacher).toBe(true);
    expect(perms.isEmployee).toBe(true);
    expect(perms.isClerk).toBe(true);
  });

  it('director → admin + ทุก field เป็น true', () => {
    const perms = getPermissions(makeProfile({ position: 'director' }));
    expect(perms.isAdmin).toBe(true);
    expect(perms.isManagement).toBe(true);
  });

  it('deputy_director → management แต่ไม่ใช่ admin', () => {
    const perms = getPermissions(makeProfile({ position: 'deputy_director' }));
    expect(perms.isAdmin).toBe(false);
    expect(perms.isManagement).toBe(true);
    expect(perms.isTeacher).toBe(false);
  });

  it('government_teacher → teacher เท่านั้น', () => {
    const perms = getPermissions(makeProfile({ position: 'government_teacher' }));
    expect(perms.isAdmin).toBe(false);
    expect(perms.isManagement).toBe(false);
    expect(perms.isTeacher).toBe(true);
    expect(perms.isClerk).toBe(false);
  });

  it('clerk_teacher → clerk เท่านั้น', () => {
    const perms = getPermissions(makeProfile({ position: 'clerk_teacher' }));
    expect(perms.isClerk).toBe(true);
    expect(perms.isTeacher).toBe(false);
    expect(perms.isManagement).toBe(false);
  });

  it('government_employee → employee เท่านั้น', () => {
    const perms = getPermissions(makeProfile({ position: 'government_employee' }));
    expect(perms.isEmployee).toBe(true);
    expect(perms.isTeacher).toBe(false);
    expect(perms.isClerk).toBe(false);
  });

  it('position + displayName ถูกต้อง', () => {
    const perms = getPermissions(makeProfile({ position: 'clerk_teacher' }));
    expect(perms.position).toBe('clerk_teacher');
    expect(perms.displayName).toBe('ธุรการ');
  });
});
