-- Add attached_files column to memos table
ALTER TABLE memos ADD COLUMN IF NOT EXISTS attached_files TEXT[];

-- Update existing memos to have empty array if null
UPDATE memos SET attached_files = '{}' WHERE attached_files IS NULL;
