-- ROLLBACK of part of 20260528110000_drop_wide_open_rls_memos_doc_receive.sql
-- Restrictive "Clerks can create doc_receive" broke ธุรการสร้างหนังสือรับ
-- when staff who aren't yet flagged is_clerk=true needed to create incoming
-- doc records. Restore prior behavior: any authenticated user can INSERT.
-- (UPDATE/DELETE/SELECT restrictions from 20260528110000 remain in effect.)

DROP POLICY IF EXISTS "Clerks can create doc_receive" ON public.doc_receive;

CREATE POLICY "Authenticated users can create doc_receive"
  ON public.doc_receive
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
