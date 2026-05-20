-- ==============================================================================
-- DEACTIVATE INACTIVE MODULES FROM SIDEBAR & REGISTRY
-- Run this in your Supabase SQL Editor to clean up the database layer.
-- This sets is_enabled = false for Document Vault & Support modules.
-- ==============================================================================

-- 1. Deactivate inactive modules in the module_registry
UPDATE public.module_registry
SET is_enabled = false
WHERE key IN ('documents', 'support');

-- 2. Notify PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema';
