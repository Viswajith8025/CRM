-- ==============================================================================
-- MASTER MIGRATION: ADD ALL NEW LEADS COLUMNS
-- Run this in Supabase SQL Editor
-- ==============================================================================

ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS requirement    TEXT,
  ADD COLUMN IF NOT EXISTS brought_by_id  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS remarks        TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
