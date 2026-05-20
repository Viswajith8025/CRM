-- ==============================================================================
-- PROJECT MODULES SCHEMA
-- Enables team leads to classify projects into modules & sub-modules,
-- then assign tasks to those modules with deadlines and owners.
-- Run this in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Create project_modules table
CREATE TABLE IF NOT EXISTS project_modules (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  parent_id      UUID REFERENCES project_modules(id) ON DELETE CASCADE,  -- NULL = top-level module
  name           TEXT NOT NULL,
  description    TEXT,
  color          TEXT DEFAULT '#6366f1',
  sort_order     INTEGER DEFAULT 0,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add module_id column to tasks (idempotent)
DO $$ BEGIN
  ALTER TABLE tasks ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES project_modules(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN null; END $$;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_modules_project ON project_modules(project_id);
CREATE INDEX IF NOT EXISTS idx_project_modules_org     ON project_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_modules_parent  ON project_modules(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_module            ON tasks(module_id);

-- 4. RLS — strict org isolation
ALTER TABLE project_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_modules_all" ON project_modules;
CREATE POLICY "project_modules_all" ON project_modules
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- 5. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS project_modules_updated_at ON project_modules;
CREATE TRIGGER project_modules_updated_at
  BEFORE UPDATE ON project_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- DONE. project_modules and tasks.module_id are now live and org-isolated.
-- ==============================================================================
