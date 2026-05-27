-- ==============================================================================
-- ADD BROUGHT_BY_ID AND REMARKS TO LEADS
-- ==============================================================================

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS brought_by_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS remarks TEXT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
