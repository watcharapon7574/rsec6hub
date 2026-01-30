-- Add missing fields to doc_receive table to match memos table functionality
-- Created: 2026-01-12

-- Add user_id column (alias for created_by for consistency with memos table)
ALTER TABLE public.doc_receive
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add rejected_name_comment column (for storing rejection information)
ALTER TABLE public.doc_receive
ADD COLUMN IF NOT EXISTS rejected_name_comment TEXT;

-- Add signer_list_progress column (CRITICAL: tracks signer progress like memos table)
ALTER TABLE public.doc_receive
ADD COLUMN IF NOT EXISTS signer_list_progress JSONB DEFAULT '[]'::jsonb;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_doc_receive_user_id ON public.doc_receive (user_id);
CREATE INDEX IF NOT EXISTS idx_doc_receive_signer_list_progress ON public.doc_receive USING GIN (signer_list_progress);

-- Add comments for clarity
COMMENT ON COLUMN public.doc_receive.user_id IS 'User ID of document creator (mirrors created_by for consistency with memos table)';
COMMENT ON COLUMN public.doc_receive.rejected_name_comment IS 'JSON string storing rejection information (name, comment, position, timestamp)';
COMMENT ON COLUMN public.doc_receive.signer_list_progress IS 'JSONB array tracking all signers and their progress - critical for approval workflow';

-- Update RLS policy to include user_id in addition to created_by
DROP POLICY IF EXISTS "Users can view their own doc_receive or docs they need to sign" ON public.doc_receive;

CREATE POLICY "Users can view their own doc_receive or docs they need to sign"
ON public.doc_receive
FOR SELECT
USING (
  created_by = auth.uid() OR
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(signature_positions) AS pos
    WHERE (pos->'signer'->>'user_id')::uuid = auth.uid()
  ) OR
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(signer_list_progress) AS signer
    WHERE (signer->>'user_id')::uuid = auth.uid()
  )
);
