-- ============================================================
-- MIGRATION: Add max_break_minutes to organization_work_settings
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE organization_work_settings
  ADD COLUMN IF NOT EXISTS max_break_minutes INTEGER NOT NULL DEFAULT 60;

-- Update any existing row to have the default 60 minutes
UPDATE organization_work_settings
  SET max_break_minutes = 60
  WHERE max_break_minutes IS NULL;

COMMENT ON COLUMN organization_work_settings.max_break_minutes
  IS 'Total allowed break minutes per shift. Employees cannot start new breaks after this is exhausted.';
