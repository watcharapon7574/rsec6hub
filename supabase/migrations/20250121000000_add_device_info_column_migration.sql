-- Add device_info column to memos and doc_receive tables
-- This column stores device fingerprint information when a document is signed
-- Format: { user_agent, ip_address, browser, os, screen_size, timestamp }

-- Add device_info to memos table
ALTER TABLE memos
ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT NULL;

-- Add device_info to doc_receive table
ALTER TABLE doc_receive
ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT NULL;

-- Add comment to explain the purpose
COMMENT ON COLUMN memos.device_info IS 'Device fingerprint information captured during document signing. Used for audit trail and security verification.';
COMMENT ON COLUMN doc_receive.device_info IS 'Device fingerprint information captured during document signing. Used for audit trail and security verification.';

-- Create index for faster queries on device_info
CREATE INDEX IF NOT EXISTS idx_memos_device_info ON memos USING GIN (device_info);
CREATE INDEX IF NOT EXISTS idx_doc_receive_device_info ON doc_receive USING GIN (device_info);

SELECT 'Device info columns added successfully to memos and doc_receive tables' as status;
