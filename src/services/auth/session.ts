import { Profile } from '@/types/database';
import { SessionTimeRemaining } from '@/types/auth';
import { getStoredAuthData, clearAuthStorage } from './storage';
import { SESSION_EXPIRY_WARNING } from './constants';
import { validateSession, getCurrentSessionToken, cleanupExpiredSessions } from '../sessionService';

/**
 * Get current authenticated profile
 */
export const getCurrentProfile = (): Profile | null => {
  try {
    const authData = getStoredAuthData();
    if (!authData) return null;
    
    // Check if session has expired
    const currentTime = new Date().getTime();
    if (currentTime > authData.expirationTime) {
      console.log('Session expired, clearing auth data');
      clearAuthStorage(); // Clear expired session
      return null;
    }
    
    // Return profile with proper type casting
    return {
      ...authData.profile,
      marital_status: authData.profile.marital_status as Profile['marital_status'],
      position: authData.profile.position as Profile['position']
    };
  } catch (err) {
    console.error('Error getting current profile:', err);
    return null;
  }
};

/**
 * Check if user is authenticated and session is valid (with single device validation)
 */
export const isAuthenticated = (): boolean => {
  const authStatus = localStorage.getItem('isAuthenticated') || sessionStorage.getItem('isAuthenticated');
  const authData = getStoredAuthData();
  const sessionToken = getCurrentSessionToken();

  // Basic auth check - don't require sessionToken for backward compatibility
  if (authStatus !== 'true' || !authData) {
    return false;
  }

  try {
    const currentTime = new Date().getTime();

    // Check if session has expired
    if (currentTime > authData.expirationTime) {
      console.log('Authentication expired');
      clearAuthStorage(); // Clear expired session
      return false;
    }

    // Only validate session if sessionToken exists (new login system)
    // Skip validation for users who logged in before session tracking was implemented
    if (sessionToken) {
      // Validate session in background (don't block authentication check)
      validateSession(sessionToken).then(({ valid, reason }) => {
        if (!valid) {
          console.log('Session validation failed, reason:', reason);
          // Only kick out if session was explicitly invalidated (another login from different device)
          // Don't kick out for: no_record (old login), expired (natural), fingerprint mismatch, error
          if (reason === 'invalidated') {
            console.log('Session was invalidated by another login, logging out...');
            clearAuthStorage();
            setTimeout(() => window.location.reload(), 100);
          }
        }
      }).catch(err => {
        // Don't kick out users on validation errors (network issues, etc.)
        console.error('Error validating session (ignored):', err);
      });

      // Cleanup expired sessions in background
      cleanupExpiredSessions().catch(err => {
        console.error('Error cleaning up sessions:', err);
      });
    }

    return true;
  } catch (err) {
    console.error('Error checking authentication:', err);
    return false;
  }
};

/**
 * Get remaining session time
 */
export const getSessionTimeRemaining = (): SessionTimeRemaining | null => {
  try {
    const authData = getStoredAuthData();
    if (!authData) return null;
    
    const currentTime = new Date().getTime();
    const timeRemaining = authData.expirationTime - currentTime;
    
    if (timeRemaining <= 0) return null;
    
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    
    // Consider session as expiring when less than 30 minutes remain
    const isExpiring = timeRemaining < SESSION_EXPIRY_WARNING;
    
    return { hours, minutes, seconds, isExpiring };
  } catch (err) {
    console.error('Error getting session time remaining:', err);
    return null;
  }
};