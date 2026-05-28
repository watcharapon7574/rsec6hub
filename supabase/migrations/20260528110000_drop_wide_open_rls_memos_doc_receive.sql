-- =========================================================
-- Drop default wide-open "Enable * for authenticated users" RLS
-- on memos and doc_receive, plus the catch-all "all" policy on doc_receive.
-- Restrictive policies (which already exist) now actually enforce.
-- =========================================================

-- ===== memos =====
-- Restrictive replacements ALREADY EXIST:
--   SELECT: "Public can view memos" (using=true) + "Users can view memos"
--   INSERT: "Users can create memos"  (check=true) — anyone authenticated
--   UPDATE: "Staff and signers can update memos" (clerk/admin/exec/author/signer)
--   DELETE: "Staff can delete memos"   (clerk/admin/director)
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.memos;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.memos;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.memos;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.memos;

-- ===== doc_receive =====
DROP POLICY IF EXISTS "all" ON public.doc_receive;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.doc_receive;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.doc_receive;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.doc_receive;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.doc_receive;

-- doc_receive SELECT: broaden the legitimate-viewer policy to cover clerks/admins
-- and task assignees, since wide-open SELECT is now gone.
DROP POLICY IF EXISTS "Users can view their own doc_receive or docs they need to sign" ON public.doc_receive;
CREATE POLICY "Users can view their own doc_receive or docs they need to sign"
  ON public.doc_receive
  FOR SELECT
  USING (
    (created_by = auth.uid())
    OR (user_id = auth.uid())
    OR public.is_clerk_or_admin()
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(doc_receive.signature_positions) pos(value)
      WHERE ((((pos.value -> 'signer'::text) ->> 'user_id'::text))::uuid = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(doc_receive.signer_list_progress) signer(value)
      WHERE (((signer.value ->> 'user_id'::text))::uuid = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.task_assignments ta
      WHERE ta.doc_receive_id = doc_receive.id
        AND ta.assigned_to = auth.uid()
        AND ta.deleted_at IS NULL
    )
  );

-- doc_receive INSERT: only clerks/admins can create incoming-doc records
CREATE POLICY "Clerks can create doc_receive"
  ON public.doc_receive
  FOR INSERT
  WITH CHECK (public.is_clerk_or_admin());

-- doc_receive DELETE: only clerks/admins can hard-delete (app uses doc_del soft delete)
CREATE POLICY "Clerks can delete doc_receive"
  ON public.doc_receive
  FOR DELETE
  USING (public.is_clerk_or_admin());
