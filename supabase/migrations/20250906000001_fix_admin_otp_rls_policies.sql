-- Fix RLS policies for admin_otp_recipients to use user_id instead of id
-- Drop existing policies
DROP POLICY IF EXISTS "Admin can view recipients" ON admin_otp_recipients;
DROP POLICY IF EXISTS "Admin can insert recipients" ON admin_otp_recipients;
DROP POLICY IF EXISTS "Admin can update recipients" ON admin_otp_recipients;

-- Recreate policies with correct user_id check
CREATE POLICY "Admin can view recipients" ON admin_otp_recipients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can insert recipients" ON admin_otp_recipients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admin can update recipients" ON admin_otp_recipients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Also fix admin_login_logs policies
DROP POLICY IF EXISTS "Admin can view logs" ON admin_login_logs;

CREATE POLICY "Admin can view logs" ON admin_login_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );
