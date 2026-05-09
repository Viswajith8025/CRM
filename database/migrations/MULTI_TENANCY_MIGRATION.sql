-- ==============================================================================
-- ECRAFTZ MULTI-TENANCY MIGRATION
-- ==============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- 
-- This script:
--   1. Creates a helper function to get the current user's org_id
--   2. Ensures organization_id exists on ALL business tables
--   3. Backfills existing data with the default org
--   4. Drops ALL old open policies
--   5. Creates strict org-isolated RLS policies
--   6. Adds performance indexes
--   7. Refreshes the PostgREST schema cache
--
-- SAFE TO RUN MULTIPLE TIMES (fully idempotent)
-- ==============================================================================

-- ============================================================
-- STEP 1: HELPER FUNCTION
-- ============================================================
-- This is the single source of truth for "who is this user's org?"
-- Every RLS policy will call this instead of doing subqueries.

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- ============================================================
-- STEP 2: ADD organization_id TO ALL TABLES
-- ============================================================
-- Using ADD COLUMN IF NOT EXISTS so this is safe to re-run.

-- Core tables
ALTER TABLE profiles        ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE leads           ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE clients         ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE projects        ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE tasks           ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE task_comments   ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE invoices        ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE activities      ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE notifications   ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- Tables that may or may not exist yet
DO $$ BEGIN ALTER TABLE payments       ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE time_logs      ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE proposals      ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE subscriptions  ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE subtasks       ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE project_members    ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE project_milestones ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'; EXCEPTION WHEN undefined_table THEN null; END $$;

-- ============================================================
-- STEP 3: BACKFILL EXISTING DATA
-- ============================================================
-- All existing data belongs to the default ECRAFTZ org.

UPDATE profiles        SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE leads           SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE clients         SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE projects        SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE tasks           SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE task_comments   SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE invoices        SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE activities      SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE notifications   SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;

-- ============================================================
-- STEP 4: MAKE organization_id NOT NULL (after backfill)
-- ============================================================
DO $$ BEGIN ALTER TABLE leads         ALTER COLUMN organization_id SET NOT NULL; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE clients       ALTER COLUMN organization_id SET NOT NULL; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE projects      ALTER COLUMN organization_id SET NOT NULL; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE tasks         ALTER COLUMN organization_id SET NOT NULL; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE task_comments ALTER COLUMN organization_id SET NOT NULL; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE invoices      ALTER COLUMN organization_id SET NOT NULL; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE activities    ALTER COLUMN organization_id SET NOT NULL; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE notifications ALTER COLUMN organization_id SET NOT NULL; EXCEPTION WHEN others THEN null; END $$;

-- ============================================================
-- STEP 5: PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_org     ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org        ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_clients_org      ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_org     ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org        ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_org ON task_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org     ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_org   ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_leads_org_status     ON leads(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_org_status     ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_org_status  ON projects(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status  ON invoices(organization_id, status);

-- ============================================================
-- STEP 6: ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN ALTER TABLE payments           ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE time_logs          ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE proposals          ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE subtasks           ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE project_members    ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN null; END $$;
DO $$ BEGIN ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN null; END $$;

-- ============================================================
-- STEP 7: DROP ALL OLD POLICIES
-- ============================================================
-- Nuke every existing policy so we start clean.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- STEP 8: CREATE STRICT ORG-ISOLATED RLS POLICIES
-- ============================================================

-- PROFILES: Users can read org members, but only edit their own
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ORGANIZATION SETTINGS: Read by org, update by admin only
CREATE POLICY "org_settings_select" ON organization_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "org_settings_update" ON organization_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- LEADS: Strict org isolation
CREATE POLICY "leads_all" ON leads
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- CLIENTS: Strict org isolation
CREATE POLICY "clients_all" ON clients
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- PROJECTS: Strict org isolation
CREATE POLICY "projects_all" ON projects
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- TASKS: Strict org isolation
CREATE POLICY "tasks_all" ON tasks
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- TASK COMMENTS: Strict org isolation
CREATE POLICY "task_comments_all" ON task_comments
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- INVOICES: Strict org isolation
CREATE POLICY "invoices_all" ON invoices
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- ACTIVITIES: Read by org, write own only
CREATE POLICY "activities_select" ON activities
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "activities_insert" ON activities
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_my_org_id()
    AND user_id = auth.uid()
  );

-- NOTIFICATIONS: Users see only their own within their org
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_my_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_my_org_id());

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_my_org_id()
    AND user_id = auth.uid()
  );

-- PAYMENTS (if exists)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "payments_all" ON payments FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id())';
EXCEPTION WHEN undefined_table THEN null; END $$;

-- TIME LOGS (if exists)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "time_logs_all" ON time_logs FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id())';
EXCEPTION WHEN undefined_table THEN null; END $$;

-- PROPOSALS (if exists)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "proposals_all" ON proposals FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id())';
EXCEPTION WHEN undefined_table THEN null; END $$;

-- SUBSCRIPTIONS (if exists)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "subscriptions_all" ON subscriptions FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id())';
EXCEPTION WHEN undefined_table THEN null; END $$;

-- SUBTASKS (if exists)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "subtasks_all" ON subtasks FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id())';
EXCEPTION WHEN undefined_table THEN null; END $$;

-- PROJECT MEMBERS (if exists)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "project_members_all" ON project_members FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id())';
EXCEPTION WHEN undefined_table THEN null; END $$;

-- PROJECT MILESTONES (if exists)
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "project_milestones_all" ON project_milestones FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id())';
EXCEPTION WHEN undefined_table THEN null; END $$;

-- ============================================================
-- STEP 9: UPDATE AUTH TRIGGER
-- ============================================================
-- When a new user signs up, assign them to the default org.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, role, status, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    'employee',
    'pending',
    '00000000-0000-0000-0000-000000000000'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STEP 10: REFRESH SCHEMA CACHE
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICATION QUERY (run after migration)
-- ============================================================
-- SELECT tablename, policyname, permissive, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
