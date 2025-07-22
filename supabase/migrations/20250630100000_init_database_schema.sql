
-- สร้าง enum สำหรับตำแหน่งงาน
CREATE TYPE public.position_type AS ENUM (
  'director', -- ผอ
  'deputy_director', -- รอง
  'assistant_director', -- ผู้ช่วย ผอ
  'government_teacher', -- ข้าราชการครู
  'government_employee', -- พนักงานราชการ
  'contract_teacher', -- ครูอัตราจ้าง
  'clerk_teacher', -- ครูธุรการ
  'disability_aide' -- พี่เลี้ยงเด็กพิการ
);

-- สร้าง enum สำหรับสถานะการอนุมัติ
CREATE TYPE public.approval_status AS ENUM (
  'pending', -- รอดำเนินการ
  'approved', -- อนุมัติ
  'rejected', -- ปฏิเสธ
  'in_progress' -- กำลังดำเนินการ
);

-- สร้าง enum สำหรับประเภทการลา
CREATE TYPE public.leave_type AS ENUM (
  'sick_leave', -- ลาป่วย
  'personal_leave', -- ลากิจ
  'annual_leave', -- ลาพักผ่อน
  'maternity_leave', -- ลาคลอด
  'ordination_leave' -- ลาบวช
);

-- ตารางโปรไฟล์ผู้ใช้
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  position position_type NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  nickname VARCHAR(50),
  birth_date DATE,
  age INTEGER,
  nationality VARCHAR(50) DEFAULT 'ไทย',
  ethnicity VARCHAR(50) DEFAULT 'ไทย',
  religion VARCHAR(50) DEFAULT 'พุทธ',
  education TEXT,
  address TEXT,
  postal_code VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(100),
  father_name VARCHAR(100),
  father_occupation VARCHAR(100),
  mother_name VARCHAR(100),
  mother_occupation VARCHAR(100),
  start_work_date DATE,
  current_position VARCHAR(100),
  workplace VARCHAR(100),
  work_experience_years INTEGER,
  job_position VARCHAR(100),
  academic_rank VARCHAR(100),
  org_structure_role VARCHAR(100),
  education_history JSONB,
  work_history JSONB,
  signature_url TEXT,
  documents JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- ตารางการขอลา
CREATE TABLE public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  leave_type leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status approval_status DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ตารางรายงานการปฏิบัติงานประจำวัน
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_date DATE NOT NULL,
  description TEXT NOT NULL,
  images JSONB,
  location JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ตารางหนังสือราชการ
CREATE TABLE public.official_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_number VARCHAR(50), -- เลขหนังสือ (จะได้หลังอนุมัติ)
  document_date DATE NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status approval_status DEFAULT 'pending',
  current_approver_level INTEGER DEFAULT 1, -- 1=ธุรการ, 2=ผช.ผอ, 3=รอง, 4=ผอ
  clerk_approved_at TIMESTAMP WITH TIME ZONE,
  clerk_approved_by UUID REFERENCES auth.users(id),
  assistant_approved_at TIMESTAMP WITH TIME ZONE,
  assistant_approved_by UUID REFERENCES auth.users(id),
  deputy_approved_at TIMESTAMP WITH TIME ZONE,
  deputy_approved_by UUID REFERENCES auth.users(id),
  director_approved_at TIMESTAMP WITH TIME ZONE,
  director_approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ตารางสำหรับเก็บ workflow การลงนาม
CREATE TABLE public.memo_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_number VARCHAR UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  content JSONB NOT NULL, -- เก็บ introduction, facts, recommendation
  document_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users NOT NULL,
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  current_step INTEGER DEFAULT 1,
  signature_positions JSONB NOT NULL, -- เก็บตำแหน่งลายเซ็นของแต่ละคน
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ตารางสำหรับเก็บขั้นตอนการลงนาม
CREATE TABLE public.memo_approval_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.memo_workflows(id) ON DELETE CASCADE NOT NULL,
  step_order INTEGER NOT NULL,
  approver_id UUID REFERENCES auth.users NOT NULL,
  approver_name VARCHAR NOT NULL,
  approver_position VARCHAR NOT NULL,
  signature_position JSONB NOT NULL, -- ตำแหน่ง x, y ของลายเซ็น
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comment TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

-- ตารางประกาศ
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  priority INTEGER DEFAULT 1, -- 1=ปกติ, 2=สำคัญ, 3=เร่งด่วน
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ตารางการแจ้งเตือน
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- leave_request, document_approval, announcement
  reference_id UUID, -- อ้างอิงไปยัง id ของตารางอื่น
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- เปิดใช้งาน Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- สร้าง RLS policies สำหรับ profiles (แก้ไขเพื่อป้องกัน recursive issues)
CREATE POLICY "Enable read access for own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Enable insert for authenticated users" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable update for own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

-- สร้าง RLS policies สำหรับ leave_requests
CREATE POLICY "Users can view their own leave requests" ON public.leave_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own leave requests" ON public.leave_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leave requests" ON public.leave_requests
  FOR UPDATE USING (auth.uid() = user_id);

-- สร้าง RLS policies สำหรับ daily_reports
CREATE POLICY "Users can view their own daily reports" ON public.daily_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily reports" ON public.daily_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily reports" ON public.daily_reports
  FOR UPDATE USING (auth.uid() = user_id);

-- สร้าง RLS policies สำหรับ official_documents
CREATE POLICY "Users can view their own documents" ON public.official_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents" ON public.official_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON public.official_documents
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies สำหรับ memo_workflows (แก้ไขเพื่อป้องกัน recursive issues)
CREATE POLICY "Enable read access for workflow creators" ON public.memo_workflows
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Enable insert for authenticated users" ON public.memo_workflows
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Enable update for workflow creators" ON public.memo_workflows
  FOR UPDATE USING (created_by = auth.uid());

-- RLS policies สำหรับ memo_approval_steps
CREATE POLICY "Enable read access for approval steps" ON public.memo_approval_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memo_workflows 
      WHERE memo_workflows.id = memo_approval_steps.workflow_id 
      AND memo_workflows.created_by = auth.uid()
    )
    OR approver_id = auth.uid()
  );

CREATE POLICY "Enable insert for approval steps" ON public.memo_approval_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memo_workflows 
      WHERE memo_workflows.id = memo_approval_steps.workflow_id 
      AND memo_workflows.created_by = auth.uid()
    )
  );

-- สร้าง RLS policies สำหรับ announcements
CREATE POLICY "All authenticated users can view announcements" ON public.announcements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only admins can manage announcements" ON public.announcements
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND position IN ('director', 'deputy_director', 'assistant_director')
    )
  );

-- สร้าง RLS policies สำหรับ notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- สร้าง function สำหรับอัปเดต updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง triggers สำหรับอัปเดต updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_leave_requests
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_daily_reports
  BEFORE UPDATE ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_official_documents
  BEFORE UPDATE ON public.official_documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.memo_workflows
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER set_updated_at_announcements
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- สร้าง storage bucket สำหรับไฟล์
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true);

-- สร้าง storage policies
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('documents', 'signatures', 'reports'));

CREATE POLICY "Users can view files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id IN ('documents', 'signatures', 'reports'));

CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id IN ('documents', 'signatures', 'reports'));

CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id IN ('documents', 'signatures', 'reports'));
