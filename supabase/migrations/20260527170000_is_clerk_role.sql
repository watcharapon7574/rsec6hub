-- "ธุรการ" is an assignable role, not a position type. Anyone — regardless of
-- whether they're position='clerk_teacher' or 'government_teacher' or contract —
-- can be assigned ธุรการ duties. The previous code conflated the two by reading
-- position='clerk_teacher' as the gate; this migration introduces an explicit
-- flag, same pattern as is_admin / is_government_official.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_clerk BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: anyone currently position='clerk_teacher' is treated as ธุรการ so
-- existing permissions don't regress on day one.
UPDATE public.profiles
SET is_clerk = TRUE
WHERE position = 'clerk_teacher'
  AND is_clerk = FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_clerk
  ON public.profiles(is_clerk)
  WHERE is_clerk = TRUE;

COMMIT;
