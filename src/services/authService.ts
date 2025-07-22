// Re-export all auth functions from their respective modules
export { signIn } from './auth/signIn';
export { sendOTP } from './auth/otp';
export { signOut } from './auth/signOut';
export { getCurrentProfile, isAuthenticated, getSessionTimeRemaining } from './auth/session';
export { refreshProfile } from './auth/profile';

// Re-export types for backward compatibility
export type { AuthResult, OTPResult, SessionTimeRemaining } from '@/types/auth';