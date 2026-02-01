-- Add revision_count field to memos table to track number of times a document has been revised/rejected
-- This will be displayed in the "ใหม่" badge as "ใหม่(n)" where n is the revision count

ALTER TABLE memos
ADD COLUMN revision_count INTEGER NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN memos.revision_count IS 'Number of times this document has been revised/rejected. Increments each time status changes to rejected.';
