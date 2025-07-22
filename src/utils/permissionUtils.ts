
import { Profile, isAdmin, isExecutive, isClerk, isTeacher, getPositionDisplayName } from '@/types/database';

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

  return {
    isAdmin: isAdmin(profile),
    isManagement: isExecutive(profile.position),
    isTeacher: isTeacher(profile.position),
    isEmployee: ['government_employee'].includes(profile.position), // Fix: use valid position
    isClerk: isClerk(profile.position),
    position: profile.position,
    displayName: getPositionDisplayName(profile.position)
  };
};
