-- Fix admin multi-device session support
-- Admins can login from multiple devices without invalidating other sessions
-- Non-admins still have single-device restriction

-- Drop the old function first
DROP FUNCTION IF EXISTS public.invalidate_old_sessions(UUID, TEXT);
DROP FUNCTION IF EXISTS public.invalidate_old_sessions(UUID, TEXT, TEXT);

-- Create new function with device fingerprint support and admin check
CREATE OR REPLACE FUNCTION public.invalidate_old_sessions(
  _user_id UUID,
  _current_session_token TEXT,
  _device_fingerprint TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT COALESCE(is_admin, false) INTO _is_admin
  FROM public.profiles
  WHERE user_id = _user_id;

  IF _is_admin THEN
    -- For admin: only invalidate sessions from the SAME device (allow multi-device)
    IF _device_fingerprint IS NOT NULL THEN
      UPDATE public.user_sessions
      SET is_active = false,
          expires_at = now()
      WHERE user_id = _user_id
        AND session_token != _current_session_token
        AND device_fingerprint = _device_fingerprint
        AND is_active = true;
    END IF;
    -- If no device fingerprint provided, don't invalidate any sessions for admin
  ELSE
    -- For non-admin: invalidate ALL other sessions (single device restriction)
    UPDATE public.user_sessions
    SET is_active = false,
        expires_at = now()
    WHERE user_id = _user_id
      AND session_token != _current_session_token
      AND is_active = true;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.invalidate_old_sessions(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_old_sessions(UUID, TEXT, TEXT) TO anon;
