-- ==============================================================================
-- ADD REQUIREMENT COLUMN TO LEADS
-- ==============================================================================

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS requirement TEXT;

NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
