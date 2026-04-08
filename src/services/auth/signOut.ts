import { supabase } from '@/integrations/supabase/client';
import { AuthResult } from '@/types/auth';
import { clearAuthStorage } from './storage';
import { invalidateSession, getCurrentSessionToken } from '../sessionService';

/**
 * Sign out user and clear all authentication data
 */
export const signOut = async (): Promise<AuthResult> => {
  try {
    // Invalidate current session first
    const sessionToken = getCurrentSessionToken();
    if (sessionToken) {
      await invalidateSession(sessionToken);
    }

    // Sign out from Supabase Auth
    await supabase.auth.signOut();

    // Clear all authentication data from storage
    clearAuthStorage();

    return {};
  } catch (err) {
    console.error('Sign out error:', err);
    return { error: err as Error };
  }
};