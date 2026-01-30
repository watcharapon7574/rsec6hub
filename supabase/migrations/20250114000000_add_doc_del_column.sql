-- Add doc_del column to memos table for soft delete tracking
-- Structure: { deleted_at: timestamp, deleted_by: user_id, deleted_by_name: string }
ALTER TABLE memos
ADD COLUMN IF NOT EXISTS doc_del jsonb DEFAULT NULL;

-- Add doc_del column to doc_receive table for soft delete tracking
-- Structure: { deleted_at: timestamp, deleted_by: user_id, deleted_by_name: string }
ALTER TABLE doc_receive
ADD COLUMN IF NOT EXISTS doc_del jsonb DEFAULT NULL;

-- Add index for faster queries filtering out deleted documents
CREATE INDEX IF NOT EXISTS idx_memos_doc_del ON memos ((doc_del IS NULL));
CREATE INDEX IF NOT EXISTS idx_doc_receive_doc_del ON doc_receive ((doc_del IS NULL));

-- Add comments for documentation
COMMENT ON COLUMN memos.doc_del IS 'Soft delete metadata: { deleted_at: timestamp, deleted_by: user_id, deleted_by_name: string }';
COMMENT ON COLUMN doc_receive.doc_del IS 'Soft delete metadata: { deleted_at: timestamp, deleted_by: user_id, deleted_by_name: string }';
