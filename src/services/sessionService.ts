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
// Returns: { valid: true } - session is valid OR no session tracking needed (backward compat)
//          { valid: false, reason: 'invalidated' } - session was explicitly invalidated (kicked)
export const validateSession = async (sessionToken: string): Promise<{ valid: boolean; userId?: string; reason?: string }> => {
  try {
    const deviceFingerprint = generateDeviceFingerprint();
    const storedFingerprint = localStorage.getItem('device_fingerprint');

    // Check if session exists (regardless of is_active status)
    const { data: anySession, error: anyError } = await supabase
      .from('user_sessions')
      .select('user_id, expires_at, is_active, device_fingerprint')
      .eq('session_token', sessionToken)
      .maybeSingle();

    // No session record found - might be old login before session tracking
    // Allow through for backward compatibility
    if (anyError || !anySession) {
      console.log('No session record found (backward compatibility mode)');
      return { valid: true, reason: 'no_record' };
    }

    // Session was explicitly invalidated (single device restriction triggered)
    // This is the ONLY case where we should kick the user out
    if (!anySession.is_active) {
      console.log('Session was invalidated by another login');
      return { valid: false, reason: 'invalidated', userId: anySession.user_id };
    }

    // Session expired
    if (new Date(anySession.expires_at) < new Date()) {
      console.log('Session expired');
      return { valid: false, reason: 'expired', userId: anySession.user_id };
    }

    // Check if user is admin (admins can use multiple devices)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', anySession.user_id)
      .single();

    const isAdmin = profileData?.is_admin === true;

    // For admins: skip fingerprint validation (allow multi-device)
    if (isAdmin) {
      return { valid: true, userId: anySession.user_id };
    }

    // For non-admins: validate device fingerprint
    if (storedFingerprint && storedFingerprint !== deviceFingerprint) {
      console.warn('Device fingerprint mismatch (local)');
      return { valid: false, reason: 'fingerprint', userId: anySession.user_id };
    }

    if (anySession.device_fingerprint && anySession.device_fingerprint !== deviceFingerprint) {
      console.warn('Device fingerprint mismatch (database)');
      return { valid: false, reason: 'fingerprint', userId: anySession.user_id };
    }

    return { valid: true, userId: anySession.user_id };
  } catch (error) {
    console.error('Error validating session:', error);
    // On error, allow through to prevent locking users out due to network issues
    return { valid: true, reason: 'error' };
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