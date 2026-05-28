-- Re-apply restrictive INSERT on doc_receive per user intent:
-- "หน้าที่นี้มีแค่ธุรการเท่านั้นที่ทำได้ และห้อยadminเข้าไปด้วยเพื่อคอยทดสอบ"
--
-- Earlier rollback (20260528130000) was a false diagnosis — the hang the user
-- saw was at the Railway /receive_num API step, not at this RLS check.
-- รังสินี had already created docs 0566/69 and 0567/69 while the restrictive
-- policy was active. Adding client-side timeout in CreateDocReceivePage so
-- hangs surface as toast errors instead of infinite modal.

DROP POLICY IF EXISTS "Authenticated users can create doc_receive" ON public.doc_receive;

CREATE POLICY "Clerks can create doc_receive"
  ON public.doc_receive
  FOR INSERT
  WITH CHECK (public.is_clerk_or_admin());
