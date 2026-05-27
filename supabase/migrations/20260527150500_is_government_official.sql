-- Add is_government_official flag to profiles.
-- position alone isn't enough: 'clerk_teacher' (ครูธุรการ) can be either
-- ข้าราชการ or a contract hire, and the distinction matters for whether
-- the leave quota system applies to that profile.
--
-- Backfill TRUE only for the 4 positions that are unambiguously ข้าราชการ;
-- everyone else stays FALSE until manually flipped (incl. ครูธุรการ that
-- are actually ข้าราชการ).

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_government_official BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.profiles
SET is_government_official = TRUE
WHERE position IN (
  'director',
  'deputy_director',
  'assistant_director',
  'government_teacher'
)
AND is_government_official = FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_government_official
  ON public.profiles(is_government_official)
  WHERE is_government_official = TRUE;

COMMIT;
