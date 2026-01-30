-- Create doc_receive table with same structure as memos table
-- This table will be used specifically for PDF upload documents
CREATE TABLE public.doc_receive (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_number VARCHAR NOT NULL,
  subject TEXT NOT NULL,
  date DATE NOT NULL,
  attachment_title TEXT,
  introduction TEXT,
  author_name VARCHAR NOT NULL,
  author_position VARCHAR NOT NULL,
  fact TEXT,
  proposal TEXT,
  status VARCHAR NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  form_data JSONB NOT NULL,
  pdf_draft_path TEXT,
  pdf_final_path TEXT,
  signature_positions JSONB DEFAULT '[]'::jsonb,
  signatures JSONB DEFAULT '[]'::jsonb,
  current_signer_order INTEGER DEFAULT 1,
  attached_files TEXT[],
  document_summary TEXT
);

-- Enable RLS
ALTER TABLE public.doc_receive ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create doc_receive" 
ON public.doc_receive 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their own doc_receive or docs they need to sign" 
ON public.doc_receive 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(signature_positions) AS pos 
    WHERE (pos->>'user_id')::uuid = auth.uid()
  )
);

CREATE POLICY "Creators and clerks can update doc_receive" 
ON public.doc_receive 
FOR UPDATE 
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND position IN ('government_employee', 'clerk_teacher')
  ) OR
  EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(signature_positions) AS pos 
    WHERE (pos->>'user_id')::uuid = auth.uid()
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_doc_receive_updated_at
BEFORE UPDATE ON public.doc_receive
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create notifications table for doc_receive workflow
CREATE TABLE public.doc_receive_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_receive_id UUID NOT NULL REFERENCES public.doc_receive(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type VARCHAR NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.doc_receive_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own doc_receive notifications" 
ON public.doc_receive_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own doc_receive notifications" 
ON public.doc_receive_notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add comment to distinguish this table's purpose
COMMENT ON TABLE public.doc_receive IS 'Table for storing PDF upload documents - separate from regular memo creation workflow';