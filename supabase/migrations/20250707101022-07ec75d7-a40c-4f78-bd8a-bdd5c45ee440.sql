-- Create memos table for document workflow
CREATE TABLE public.memos (
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
  current_signer_order INTEGER DEFAULT 1
);

-- Enable RLS
ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create memos" 
ON public.memos 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their own memos or memos they need to sign" 
ON public.memos 
FOR SELECT 
USING (
  created_by = auth.uid() OR 
  id IN (
    SELECT memo_id 
    FROM jsonb_array_elements(signature_positions) AS pos 
    WHERE (pos->>'user_id')::uuid = auth.uid()
  )
);

CREATE POLICY "Creators and clerks can update memos" 
ON public.memos 
FOR UPDATE 
USING (
  created_by = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND position IN ('government_employee', 'clerk_teacher')
  ) OR
  id IN (
    SELECT memo_id 
    FROM jsonb_array_elements(signature_positions) AS pos 
    WHERE (pos->>'user_id')::uuid = auth.uid()
  )
);

-- Create updated_at trigger
CREATE TRIGGER update_memos_updated_at
BEFORE UPDATE ON public.memos
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create notifications table if not exists (for memo workflow)
CREATE TABLE IF NOT EXISTS public.memo_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  memo_id UUID NOT NULL REFERENCES public.memos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type VARCHAR NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.memo_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memo notifications" 
ON public.memo_notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own memo notifications" 
ON public.memo_notifications 
FOR UPDATE 
USING (auth.uid() = user_id);