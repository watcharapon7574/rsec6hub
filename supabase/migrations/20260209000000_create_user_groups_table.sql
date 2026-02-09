-- Create user_groups table for storing assignee groups
CREATE TABLE IF NOT EXISTS public.user_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    members JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.user_groups IS 'Stores groups of users for bulk task assignment';

-- Create index for faster lookups by creator
CREATE INDEX IF NOT EXISTS idx_user_groups_created_by ON public.user_groups(created_by);

-- Enable RLS
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own groups
CREATE POLICY "Users can view own groups"
    ON public.user_groups
    FOR SELECT
    USING (auth.uid() = created_by);

-- Users can create their own groups
CREATE POLICY "Users can create own groups"
    ON public.user_groups
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Users can update their own groups
CREATE POLICY "Users can update own groups"
    ON public.user_groups
    FOR UPDATE
    USING (auth.uid() = created_by);

-- Users can delete their own groups
CREATE POLICY "Users can delete own groups"
    ON public.user_groups
    FOR DELETE
    USING (auth.uid() = created_by);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_groups_updated_at
    BEFORE UPDATE ON public.user_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_user_groups_updated_at();
