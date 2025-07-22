import { supabase } from '@/integrations/supabase/client';
import { AuthResult } from '@/types/auth';
import { clearAuthStorage } from './storage';
import { invalidateSession, getCurrentSessionToken } from '../sessionService';

/**
 * Sign out user and clear all authentication data
 */
export const signOut = async (): Promise<AuthResult> => {
  try {
    console.log('Starting complete sign out process...');
    
    // Invalidate current session first
    const sessionToken = getCurrentSessionToken();
    if (sessionToken) {
      await invalidateSession(sessionToken);
      console.log('Session invalidated successfully');
    }
    
    // Sign out from Supabase Auth
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Supabase sign out error:', error);
    }
    
    // Clear all authentication data from storage
    clearAuthStorage();
    
    console.log('Complete sign out successful - all storage cleared');
    return {};
  } catch (err) {
    console.error('Sign out error:', err);
    return { error: err as Error };
  }
};