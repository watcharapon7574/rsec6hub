-- Create admin_otp_recipients table
-- สำหรับเก็บรายชื่อคนที่จะรับ OTP เมื่อ admin login
CREATE TABLE IF NOT EXISTS admin_otp_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_phone VARCHAR(20) NOT NULL,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  recipient_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_admin_otp_recipients_phone ON admin_otp_recipients(admin_phone);
CREATE INDEX idx_admin_otp_recipients_active ON admin_otp_recipients(admin_phone, is_active);

-- Create admin_login_logs table
-- สำหรับบันทึก log การ login ของ admin
CREATE TABLE IF NOT EXISTS admin_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_phone VARCHAR(20) NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  recipient_name VARCHAR(255),
  otp_code VARCHAR(10),
  login_success BOOLEAN DEFAULT true,
  ip_address VARCHAR(50),
  user_agent TEXT,
  logged_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_admin_login_logs_phone ON admin_login_logs(admin_phone);
CREATE INDEX idx_admin_login_logs_time ON admin_login_logs(logged_in_at DESC);

-- Add RLS policies for admin_otp_recipients
ALTER TABLE admin_otp_recipients ENABLE ROW LEVEL SECURITY;

-- Admin can view all recipients
CREATE POLICY "Admin can view recipients" ON admin_otp_recipients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin can insert recipients
CREATE POLICY "Admin can insert recipients" ON admin_otp_recipients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Admin can update recipients
CREATE POLICY "Admin can update recipients" ON admin_otp_recipients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Add RLS policies for admin_login_logs
ALTER TABLE admin_login_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admin can view logs" ON admin_login_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Service role can insert logs (from Edge Function)
CREATE POLICY "Service can insert logs" ON admin_login_logs
  FOR INSERT
  WITH CHECK (true);

-- Add updated_at trigger for admin_otp_recipients
CREATE OR REPLACE FUNCTION update_admin_otp_recipients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_admin_otp_recipients_updated_at
  BEFORE UPDATE ON admin_otp_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_otp_recipients_updated_at();

-- Insert initial admin recipient (user_id: 5a49594e-cfcd-4c72-825b-2d65bdbe2142)
-- Note: จะต้องเพิ่ม telegram_chat_id ของ admin คนแรกภายหลัง
-- INSERT INTO admin_otp_recipients (admin_phone, telegram_chat_id, recipient_name, added_by)
-- VALUES ('036776259', YOUR_CHAT_ID_HERE, 'Admin Name', '5a49594e-cfcd-4c72-825b-2d65bdbe2142');

COMMENT ON TABLE admin_otp_recipients IS 'เก็บรายชื่อคนที่จะรับ OTP เมื่อ admin (036776259) login';
COMMENT ON TABLE admin_login_logs IS 'บันทึก log การ login ของ admin เพื่อ audit trail';
