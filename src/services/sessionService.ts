import { supabase } from '@/integrations/supabase/client';

// Generate device fingerprint
const generateDeviceFingerprint = (): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('fingerprint', 10, 10);
  const canvasData = canvas.toDataURL();
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvasData.slice(0, 100),
    navigator.platform,
    navigator.hardwareConcurrency || 0
  ].join('|');
  
  return btoa(fingerprint).slice(0, 64);
};

// Generate session token
const generateSessionToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Store session in database
export const createSession = async (userId: string): Promise<{ sessionToken: string; error?: Error }> => {
  try {
    const sessionToken = generateSessionToken();
    const deviceFingerprint = generateDeviceFingerprint();

    // Invalidate old sessions
    // For admin: only invalidate sessions from the SAME device (allow multi-device)
    // For non-admin: invalidate ALL other sessions
    const { error: invalidateError } = await supabase.rpc('invalidate_old_sessions', {
      _user_id: userId,
      _current_session_token: sessionToken,
      _device_fingerprint: deviceFingerprint
    });

    if (invalidateError) {
      console.error('Error invalidating old sessions:', invalidateError);
    }
    
    // Create new session
    const { error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        device_fingerprint: deviceFingerprint,
        ip_address: null, // Will be set by server if needed
        user_agent: navigator.userAgent
      });
    
    if (error) {
      throw error;
    }
    
    // Store session token in localStorage
    localStorage.setItem('session_token', sessionToken);
    localStorage.setItem('device_fingerprint', deviceFingerprint);
    
    return { sessionToken };
  } catch (error) {
    console.error('Error creating session:', error);
    return { sessionToken: '', error: error as Error };
  }
};

// Validate session
export const validateSession = async (sessionToken: string): Promise<{ valid: boolean; userId?: string }> => {
  try {
    const deviceFingerprint = generateDeviceFingerprint();
    const storedFingerprint = localStorage.getItem('device_fingerprint');

    // First, check if session exists and is active
    const { data, error } = await supabase
      .from('user_sessions')
      .select('user_id, expires_at, is_active, device_fingerprint')
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return { valid: false };
    }

    // Check if user is admin (admins can use multiple devices)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', data.user_id)
      .single();

    const isAdmin = profileData?.is_admin === true;

    // For admins: skip fingerprint validation (allow multi-device)
    if (isAdmin) {
      return { valid: true, userId: data.user_id };
    }

    // For non-admins: validate device fingerprint
    // Check local stored fingerprint vs generated fingerprint
    if (storedFingerprint && storedFingerprint !== deviceFingerprint) {
      console.warn('Device fingerprint mismatch (local)');
      return { valid: false };
    }

    // Check database fingerprint vs generated fingerprint
    if (data.device_fingerprint && data.device_fingerprint !== deviceFingerprint) {
      console.warn('Device fingerprint mismatch (database)');
      return { valid: false };
    }

    return { valid: true, userId: data.user_id };
  } catch (error) {
    console.error('Error validating session:', error);
    return { valid: false };
  }
};

// Invalidate current session
export const invalidateSession = async (sessionToken: string): Promise<void> => {
  try {
    await supabase
      .from('user_sessions')
      .update({ 
        is_active: false, 
        expires_at: new Date().toISOString() 
      })
      .eq('session_token', sessionToken);
    
    localStorage.removeItem('session_token');
    localStorage.removeItem('device_fingerprint');
  } catch (error) {
    console.error('Error invalidating session:', error);
  }
};

// Get current session token
export const getCurrentSessionToken = (): string | null => {
  return localStorage.getItem('session_token');
};

// Cleanup expired sessions (call periodically)
export const cleanupExpiredSessions = async (): Promise<void> => {
  try {
    await supabase.rpc('cleanup_expired_sessions');
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  }
};