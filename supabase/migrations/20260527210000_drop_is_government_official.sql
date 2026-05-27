-- Drop is_government_official: it's a pure function of position now that
-- รังสินี (the only ambiguous case we knew of) is moved to position=
-- 'government_teacher'. ข้าราชการ = position IN (director, deputy_director,
-- assistant_director, government_teacher); everything else = not.
-- Code uses isGovernmentOfficial(position) helper instead of the column.

BEGIN;

DROP INDEX IF EXISTS public.idx_profiles_is_government_official;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_government_official;

COMMIT;
