import { Profile } from '@/types/database';
import { SessionData } from '@/types/auth';
import { STORAGE_KEYS, SESSION_DURATION } from './constants';

/**
 * Store authentication data with 8-hour expiration
 */
export const storeAuthData = (profile: Profile): void => {
  const loginTime = new Date().getTime();
  const expirationTime = loginTime + SESSION_DURATION;
  
  const authData: SessionData = {
    profile,
    loginTime,
    expirationTime
  };
  
  localStorage.setItem(STORAGE_KEYS.EMPLOYEE_AUTH, JSON.stringify(authData));
  localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, 'true');
  sessionStorage.setItem(STORAGE_KEYS.EMPLOYEE_AUTH, JSON.stringify(authData));
  sessionStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, 'true');
};

/**
 * Get stored authentication data
 */
export const getStoredAuthData = (): SessionData | null => {
  try {
    const storedAuth = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_AUTH) || 
                     sessionStorage.getItem(STORAGE_KEYS.EMPLOYEE_AUTH);
    
    if (storedAuth) {
      return JSON.parse(storedAuth);
    }
    return null;
  } catch (err) {
    console.error('Error parsing stored auth data:', err);
    return null;
  }
};

/**
 * Update stored profile data
 */
export const updateStoredProfile = (profile: Profile): void => {
  const storedAuth = localStorage.getItem(STORAGE_KEYS.EMPLOYEE_AUTH) || 
                    sessionStorage.getItem(STORAGE_KEYS.EMPLOYEE_AUTH);
  
  if (storedAuth) {
    const authData = JSON.parse(storedAuth);
    authData.profile = profile;
    
    localStorage.setItem(STORAGE_KEYS.EMPLOYEE_AUTH, JSON.stringify(authData));
    sessionStorage.setItem(STORAGE_KEYS.EMPLOYEE_AUTH, JSON.stringify(authData));
  }
};

/**
 * Clear all authentication data from storage
 */
export const clearAuthStorage = (): void => {
  const authKeys = [
    STORAGE_KEYS.EMPLOYEE_PROFILE,
    STORAGE_KEYS.EMPLOYEE_AUTH,
    STORAGE_KEYS.IS_AUTHENTICATED,
    STORAGE_KEYS.AUTH_SESSION_TIMER
  ];
  
  authKeys.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  
  // Clear any Supabase related storage
  try {
    const supabaseKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('supabase.') || key.includes('auth')
    );
    supabaseKeys.forEach(key => localStorage.removeItem(key));
    
    const sessionSupabaseKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith('supabase.') || key.includes('auth')
    );
    sessionSupabaseKeys.forEach(key => sessionStorage.removeItem(key));
  } catch (clearError) {
    console.warn('Error clearing additional storage:', clearError);
  }
};