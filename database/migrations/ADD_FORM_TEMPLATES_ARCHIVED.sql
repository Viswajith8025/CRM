-- ==============================================================================
-- ADD IS_ARCHIVED TO FORM TEMPLATES (C-4 FIX)
-- ==============================================================================
-- This fixes the 404 / column not found error in Supabase when editing form templates
-- that have existing submissions, as the versioning logic expects is_archived to exist.

ALTER TABLE public.form_templates 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create an index to quickly filter out archived templates
CREATE INDEX IF NOT EXISTS idx_form_templates_archived ON public.form_templates(is_archived);

-- Refresh cache
NOTIFY pgrst, 'reload schema';
