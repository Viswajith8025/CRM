-- ==============================================================================
-- ENTERPRISE PROJECT WORKFLOW & TASK DELEGATION SCHEMA
-- ==============================================================================

-- 1. EXTEND PROJECTS TABLE
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC DEFAULT 0;

-- 2. CREATE PROJECT MODULES TABLE (Recursive parent-child structure)
CREATE TABLE IF NOT EXISTS public.project_modules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  parent_id       UUID REFERENCES public.project_modules(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT DEFAULT '#6366f1',
  sort_order      INTEGER DEFAULT 0,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_modules_project ON public.project_modules(project_id);
CREATE INDEX IF NOT EXISTS idx_project_modules_org ON public.project_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_modules_parent ON public.project_modules(parent_id);

-- 3. EXTEND TASKS TABLE
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS actual_hours NUMERIC DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.project_modules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_module ON public.tasks(module_id);

-- 4. MULTI-ASSIGNEE / TASK COLLABORATION TABLE
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_task_assignee UNIQUE(task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON public.task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_org ON public.task_assignments(organization_id);

-- 5. TASK DEPENDENCIES TABLE
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id            UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  organization_id    UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_task_dependency UNIQUE(task_id, depends_on_task_id),
  CONSTRAINT prevent_self_dependency CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends ON public.task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_org ON public.task_dependencies(organization_id);

-- 6. ENTERPRISE TASK ACTIVITY AUDIT LOG
CREATE TABLE IF NOT EXISTS public.task_activity_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          VARCHAR(100) NOT NULL, -- 'CREATE', 'UPDATE', 'STATUS_CHANGE', 'ASSIGN', 'UNASSIGN', 'BLOCK', 'UNBLOCK'
  details         TEXT NOT NULL,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_logs_task ON public.task_activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_logs_org ON public.task_activity_logs(organization_id);

-- 7. ENABLE RLS (ROW LEVEL SECURITY) FOR MULTI-TENANT ISOLATION
ALTER TABLE public.project_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity_logs ENABLE ROW LEVEL SECURITY;

-- 8. DEFINE STRICT TENANT RLS POLICIES
DROP POLICY IF EXISTS "project_modules_all" ON public.project_modules;
CREATE POLICY "project_modules_all" ON public.project_modules
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "task_assignments_all" ON public.task_assignments;
CREATE POLICY "task_assignments_all" ON public.task_assignments
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "task_dependencies_all" ON public.task_dependencies;
CREATE POLICY "task_dependencies_all" ON public.task_dependencies
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "task_activity_logs_all" ON public.task_activity_logs;
CREATE POLICY "task_activity_logs_all" ON public.task_activity_logs
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- 9. TASK DEPENDENCY VALIDATION ENGINE (Trigger to enforce completion sequence)
CREATE OR REPLACE FUNCTION public.check_task_dependencies()
RETURNS TRIGGER AS $$
DECLARE
  unresolved_dep_title TEXT;
BEGIN
  -- If trying to mark task as completed or done
  IF (NEW.status = 'completed' OR NEW.status = 'done') AND (OLD.status IS NULL OR OLD.status <> NEW.status) THEN
    SELECT t.title INTO unresolved_dep_title
    FROM public.task_dependencies td
    JOIN public.tasks t ON t.id = td.depends_on_task_id
    WHERE td.task_id = NEW.id
      AND t.status <> 'completed'
      AND t.status <> 'done'
    LIMIT 1;

    IF unresolved_dep_title IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot complete task. It depends on unresolved task: %', unresolved_dep_title;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_task_dependencies ON public.tasks;
CREATE TRIGGER tr_check_task_dependencies
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_dependencies();

-- 10. SYNCHRONIZE LEGACY SINGLE ASSIGNEE COLUMN WITH TASK ASSIGNMENTS
CREATE OR REPLACE FUNCTION public.sync_task_assignee_assignments()
RETURNS TRIGGER AS $$
BEGIN
  -- If assigned_to was updated
  IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.task_assignments (task_id, user_id, organization_id)
    VALUES (NEW.id, NEW.assigned_to, NEW.organization_id)
    ON CONFLICT DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    -- Keep assignments synchronized with the legacy assigned_to
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.task_assignments (task_id, user_id, organization_id)
      VALUES (NEW.id, NEW.assigned_to, NEW.organization_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_task_assignee ON public.tasks;
CREATE TRIGGER tr_sync_task_assignee
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_assignee_assignments();

-- Reload schema notification
NOTIFY pgrst, 'reload schema';
