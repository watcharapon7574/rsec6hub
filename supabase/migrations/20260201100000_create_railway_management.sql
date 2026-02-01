-- Create app_settings table for storing Railway API token
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create railway_schedules table
CREATE TABLE IF NOT EXISTS railway_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  start_time TEXT NOT NULL, -- HH:MM format
  stop_time TEXT NOT NULL,  -- HH:MM format
  days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5], -- 0=Sunday, 1=Monday, etc.
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create railway_logs table for tracking operations
CREATE TABLE IF NOT EXISTS railway_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES railway_schedules(id) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  service_name TEXT,
  action TEXT NOT NULL, -- 'start' or 'stop'
  status TEXT NOT NULL, -- 'success', 'failed'
  error_message TEXT,
  triggered_by TEXT DEFAULT 'schedule', -- 'schedule', 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_railway_schedules_enabled ON railway_schedules(enabled);
CREATE INDEX idx_railway_schedules_next_run ON railway_schedules(next_run_at) WHERE enabled = true;
CREATE INDEX idx_railway_logs_created_at ON railway_logs(created_at DESC);
CREATE INDEX idx_railway_logs_service_id ON railway_logs(service_id);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE railway_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE railway_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (ให้ทุกคนที่ authenticated อ่านและเขียนได้)
CREATE POLICY "Allow authenticated users to read app_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage app_settings"
  ON app_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read railway_schedules"
  ON railway_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage railway_schedules"
  ON railway_schedules FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read railway_logs"
  ON railway_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert railway_logs"
  ON railway_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for app_settings
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for railway_schedules
CREATE TRIGGER update_railway_schedules_updated_at
  BEFORE UPDATE ON railway_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default comment
COMMENT ON TABLE railway_schedules IS 'ตารางเวลาสำหรับเปิดปิด Railway services อัตโนมัติ';
COMMENT ON TABLE railway_logs IS 'บันทึกการเปิดปิด Railway services';
COMMENT ON TABLE app_settings IS 'การตั้งค่าแอปพลิเคชัน เช่น Railway API Token';
