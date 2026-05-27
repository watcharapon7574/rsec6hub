-- รังสินี is a clerk_teacher (ครูธุรการ) that *is* ข้าราชการ — flip the flag
-- so the leave-quota system applies to her profile.
-- (The default backfill from 20260527150500 left all clerk_teacher rows at
-- FALSE because position alone can't distinguish official vs contract hire.)

UPDATE public.profiles
SET is_government_official = TRUE
WHERE id = 'ce1834a3-8168-4c03-b5f6-9370d8c9b9a8';
