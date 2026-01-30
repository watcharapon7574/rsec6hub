-- Fix doc_receive table to match memos functionality

-- First, make doc_number nullable (it should be assigned later by clerk)
ALTER TABLE public.doc_receive 
ALTER COLUMN doc_number DROP NOT NULL;

-- Add doc_number_status column (for tracking document numbering status)
ALTER TABLE public.doc_receive 
ADD COLUMN doc_number_status JSONB;

-- Add clerk_id column (for tracking which clerk processed the document)
ALTER TABLE public.doc_receive 
ADD COLUMN clerk_id UUID REFERENCES auth.users(id);

-- Add foreign key constraint for created_by to ensure it references auth.users
ALTER TABLE public.doc_receive 
ADD CONSTRAINT fk_doc_receive_created_by 
FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Add indexes for better query performance
CREATE INDEX idx_doc_receive_doc_number_status ON public.doc_receive USING GIN (doc_number_status);
CREATE INDEX idx_doc_receive_clerk_id ON public.doc_receive (clerk_id);
CREATE INDEX idx_doc_receive_created_by ON public.doc_receive (created_by);

-- Add comments for clarity
COMMENT ON COLUMN public.doc_receive.doc_number IS 'Document number assigned by clerk (nullable until assigned)';
COMMENT ON COLUMN public.doc_receive.doc_number_status IS 'JSON object storing document number assignment status and metadata';
COMMENT ON COLUMN public.doc_receive.clerk_id IS 'Reference to the clerk who processed this document';