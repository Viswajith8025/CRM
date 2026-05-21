-- ==============================================================================
-- FIX: ADD IS_ARCHIVED TO FORM TEMPLATES
-- ==============================================================================
-- Adds the missing is_archived column needed for schema versioning logic.
-- This prevents the '404 column not found' error when editing a form template
-- that already has active submissions.

ALTER TABLE public.form_templates ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
