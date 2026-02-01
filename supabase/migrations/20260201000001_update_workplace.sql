-- Update workplace field for all profiles to ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี
-- This migration updates the workplace information for all staff members

UPDATE profiles
SET workplace = 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี'
WHERE workplace IS NULL OR workplace != 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี';

-- Add comment for documentation
COMMENT ON COLUMN profiles.workplace IS 'สถานที่ทำงานของบุคลากร - ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี';
