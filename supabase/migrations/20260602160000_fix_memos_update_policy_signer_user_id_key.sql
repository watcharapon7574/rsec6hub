-- Fix regression introduced by 20260528110000_drop_wide_open_rls_memos_doc_receive.sql
--
-- The "Staff and signers can update memos" UPDATE policy (created 20260202000001)
-- gated the signer branch on (signer.value ->> 'userId'), but signer_list_progress
-- stores the key as 'user_id'. While the wide-open "Enable update for authenticated
-- users" policy still existed, the typo was masked (permissive policies OR together).
-- 20260528110000 dropped the wide-open policy, so the dead 'userId' clause became the
-- only signer path -> non-clerk/non-author/non-exec signers (e.g. parallel_signer
-- teachers, position=government_teacher) could no longer update memos. Symptom: a
-- parallel signer's signature was stamped into the PDF (sign-document runs as
-- service_role) but parallel_signers.completed_user_ids was never written (client
-- update at ApproveDocumentPage.tsx:991 silently RLS-denied) -> progress stuck at 0/N.
--
-- Verified 198/198 memos use 'user_id' (0 use 'userId'). The sibling doc_receive
-- policy in 20260528110000 already uses the correct 'user_id' key; this aligns memos.
ALTER POLICY "Staff and signers can update memos" ON public.memos
USING (
  is_clerk_or_admin()
  OR (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles."position" = ANY (ARRAY['assistant_director'::position_type, 'deputy_director'::position_type, 'director'::position_type, 'government_employee'::position_type])
  ))
  OR (user_id = auth.uid())
  OR (EXISTS (
    SELECT 1 FROM jsonb_array_elements(memos.signer_list_progress) signer(value)
    WHERE ((signer.value ->> 'user_id'))::uuid = auth.uid()
  ))
);
