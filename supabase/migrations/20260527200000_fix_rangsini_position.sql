-- รังสินี's official appointment is ข้าราชการครู (position='government_teacher'),
-- assigned to ธุรการ duties — so she should be government_teacher + is_clerk=TRUE,
-- not position='clerk_teacher'. Until last decoupling we used position as the
-- clerk gate, hence the historical mis-labelling.
-- is_clerk is unaffected: it was TRUE under the old position too, stays TRUE.
-- is_government_official is unaffected: explicit flag set in 20260527160000.
--
-- Row-count check: if the profile id doesn't match (e.g. someone changed the
-- id), the migration aborts loud instead of silent no-op (scrutinize Finding 2).

DO $$
DECLARE
  v_rows INTEGER;
BEGIN
  UPDATE public.profiles
  SET position = 'government_teacher'
  WHERE id = 'ce1834a3-8168-4c03-b5f6-9370d8c9b9a8';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'fix_rangsini_position: no profile found for id ce1834a3-…';
  END IF;
  IF v_rows > 1 THEN
    RAISE EXCEPTION 'fix_rangsini_position: matched % rows, expected 1', v_rows;
  END IF;
END $$;
