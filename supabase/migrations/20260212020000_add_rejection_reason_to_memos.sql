-- Add rejection_reason column to memos table for storing rejection feedback
ALTER TABLE memos ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
