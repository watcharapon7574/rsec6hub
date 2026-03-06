-- ==================== Payslip Batches ====================
CREATE TABLE IF NOT EXISTS public.payslip_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  matched_records INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(month, year)
);

-- ==================== Payslips ====================
CREATE TABLE IF NOT EXISTS public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.payslip_batches(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id),
  employee_name TEXT NOT NULL,
  employee_position TEXT,
  page_number INTEGER NOT NULL,
  half TEXT NOT NULL CHECK (half IN ('left','right')),
  income_items JSONB NOT NULL DEFAULT '[]',
  deduction_items JSONB NOT NULL DEFAULT '[]',
  total_income NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  net_pay NUMERIC(12,2) DEFAULT 0,
  raw_ocr_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== Indexes ====================
CREATE INDEX IF NOT EXISTS idx_payslips_profile_id ON public.payslips(profile_id);
CREATE INDEX IF NOT EXISTS idx_payslips_batch_id ON public.payslips(batch_id);
CREATE INDEX IF NOT EXISTS idx_payslip_batches_month_year ON public.payslip_batches(month, year);

-- ==================== RLS ====================
ALTER TABLE public.payslip_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read batches" ON public.payslip_batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Uploader manage batches" ON public.payslip_batches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Employee sees own payslips" ON public.payslips
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "Uploader manage payslips" ON public.payslips
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==================== App Settings row ====================
INSERT INTO public.app_settings (key, value, description)
VALUES ('payslip_uploader_employee_id', 'RSEC6061', 'รหัสพนักงานผู้นำเข้าสลิปเงินเดือน')
ON CONFLICT (key) DO NOTHING;
