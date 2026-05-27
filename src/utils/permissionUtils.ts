
import { Profile, isAdmin, isExecutive, isTeacher, getPositionDisplayName } from '@/types/database';

export interface UserPermissions {
  isAdmin: boolean;
  isManagement: boolean;
  isTeacher: boolean;
  isEmployee: boolean;
  isClerk: boolean;
  position: string;
  displayName: string;
}

export const getPermissions = (profile: Profile | null): UserPermissions => {
  if (!profile) return {
    isAdmin: false,
    isManagement: false,
    isTeacher: false,
    isEmployee: false,
    isClerk: false,
    position: '',
    displayName: ''
  };

  const userIsAdmin = isAdmin(profile);

  // Admin gets ALL permissions for testing convenience
  if (userIsAdmin) {
    return {
      isAdmin: true,
      isManagement: true,
      isTeacher: true,
      isEmployee: true,
      isClerk: true,
      position: profile.position,
      displayName: getPositionDisplayName(profile.position)
    };
  }

  return {
    isAdmin: false,
    isManagement: isExecutive(profile.position),
    isTeacher: isTeacher(profile.position),
    isEmployee: ['government_employee'].includes(profile.position),
    // ธุรการ คือ role ที่มอบหมายได้ ไม่ผูกกับ position — ใช้ flag is_clerk ที่ตั้งใน DB
    isClerk: profile.is_clerk === true,
    position: profile.position,
    displayName: getPositionDisplayName(profile.position)
  };
};

// Re-export for convenience
export { getPositionDisplayName };
