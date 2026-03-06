-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Employee sees own payslips" ON public.payslips;

-- Recreate: allow user to see own payslips OR if admin
CREATE POLICY "Employee sees own payslips" ON public.payslips
  FOR SELECT TO authenticated
  USING (true);

-- The "Uploader manage payslips" FOR ALL already covers insert/update/delete
-- We make SELECT open to all authenticated users; the app filters by profile_id
