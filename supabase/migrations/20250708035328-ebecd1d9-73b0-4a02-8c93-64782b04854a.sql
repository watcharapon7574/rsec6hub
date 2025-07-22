-- Create user sessions table for single device login
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '8 hours'),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own sessions" 
ON public.user_sessions 
FOR SELECT 
USING (user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.phone = 
    (SELECT phone FROM profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Users can insert their own sessions" 
ON public.user_sessions 
FOR INSERT 
WITH CHECK (user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.phone = 
    (SELECT phone FROM profiles WHERE user_id = auth.uid())
));

CREATE POLICY "Users can update their own sessions" 
ON public.user_sessions 
FOR UPDATE 
USING (user_id IN (
  SELECT p.user_id FROM profiles p WHERE p.phone = 
    (SELECT phone FROM profiles WHERE user_id = auth.uid())
));

-- Create function to invalidate old sessions
CREATE OR REPLACE FUNCTION public.invalidate_old_sessions(
  _user_id UUID,
  _current_session_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Deactivate all other sessions for this user
  UPDATE public.user_sessions 
  SET is_active = false, 
      expires_at = now()
  WHERE user_id = _user_id 
    AND session_token != _current_session_token 
    AND is_active = true;
END;
$$;

-- Create function to cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove expired sessions
  DELETE FROM public.user_sessions 
  WHERE expires_at < now() 
    OR is_active = false;
END;
$$;

-- Create index for performance
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON public.user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON public.user_sessions(expires_at);