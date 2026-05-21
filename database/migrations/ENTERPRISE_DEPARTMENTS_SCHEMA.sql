-- ==============================================================================
-- ENTERPRISE DEPARTMENTS OPERATIONS SCHEMA
-- normalized department structures, dynamic metrics, configuration bindings, 
-- multi-tenant row-level security (RLS), and database trigger automation.
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Departments Registry
CREATE TABLE IF NOT EXISTS departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  leader_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- Indexing for high-performance multi-tenant filtering
CREATE INDEX IF NOT EXISTS idx_departments_organization ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_slug ON departments(slug);

-- 2. Normalised Department Members Mapping (supports primary and secondary assignments)
CREATE TABLE IF NOT EXISTS department_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary    BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_members_profile ON department_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_dept ON department_members(department_id);

-- 3. Dynamic Department Settings
CREATE TABLE IF NOT EXISTS department_settings (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id          UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE UNIQUE,
  weekly_hours_capacity  INTEGER DEFAULT 40 CHECK (weekly_hours_capacity > 0),
  escalation_email       TEXT,
  sla_threshold_hours    INTEGER DEFAULT 24 CHECK (sla_threshold_hours >= 0),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Dynamic KPI Catalog
CREATE TABLE IF NOT EXISTS department_kpis (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  metric_key    TEXT NOT NULL,
  target_value  NUMERIC(12, 2) NOT NULL,
  current_value NUMERIC(12, 2) DEFAULT 0.00,
  unit          TEXT DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_kpis_dept ON department_kpis(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_kpis_key ON department_kpis(metric_key);

-- 5. Dashboard Configuration Layout Bindings (Layout Engine configurations)
CREATE TABLE IF NOT EXISTS department_dashboards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id   UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE UNIQUE,
  layout_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled_widgets TEXT[] NOT NULL DEFAULT '{}'::text[],
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Isolated Department Operational Reports Archive
CREATE TABLE IF NOT EXISTS department_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  report_type   TEXT NOT NULL CHECK (report_type IN ('productivity', 'attendance', 'workload', 'utilization')),
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_reports_dept ON department_reports(department_id);

-- ==============================================================================
-- AUTOMATION TRIGGER: Dynamic provisioning of Dashboard & Settings models
-- ==============================================================================

CREATE OR REPLACE FUNCTION provision_department_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default SLA & Capacity rules into Settings
  INSERT INTO department_settings (department_id, weekly_hours_capacity, escalation_email, sla_threshold_hours)
  VALUES (
    NEW.id, 
    40, 
    LOWER(CONCAT(NEW.slug, '-leads@enterprise.com')), 
    24
  ) ON CONFLICT (department_id) DO NOTHING;

  -- Insert standard layout template bindings depending on department type
  INSERT INTO department_dashboards (department_id, layout_config, enabled_widgets)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.slug = 'web_developing' THEN '{"columns": 3, "widgets": [{"name": "active_sprints", "h": 2}, {"name": "bug_backlog", "h": 1}]}'::jsonb
      WHEN NEW.slug = 'bde' THEN '{"columns": 3, "widgets": [{"name": "pipeline_value", "h": 2}, {"name": "deal_tracker", "h": 1}]}'::jsonb
      WHEN NEW.slug = 'digital_marketing' THEN '{"columns": 3, "widgets": [{"name": "campaign_status", "h": 2}, {"name": "keywords_tracked", "h": 1}]}'::jsonb
      ELSE '{"columns": 3, "widgets": [{"name": "activity_log", "h": 2}, {"name": "general_tasks", "h": 1}]}'::jsonb
    END,
    CASE
      WHEN NEW.slug = 'web_developing' THEN ARRAY['development_projects', 'sprint_tasks', 'bug_tracker', 'resource_workload']
      WHEN NEW.slug = 'bde' THEN ARRAY['sales_pipeline', 'conversion_metrics', 'proposal_tracker', 'revenue_gauge']
      WHEN NEW.slug = 'digital_marketing' THEN ARRAY['seo_campaigns', 'keyword_ranks', 'content_deadlines', 'deliverables_grid']
      ELSE ARRAY['general_metrics', 'task_distribution', 'activity_stream']
    END
  ) ON CONFLICT (department_id) DO NOTHING;

  -- Insert standard dynamic KPI entries as bootstrapping seeds
  INSERT INTO department_kpis (department_id, name, metric_key, target_value, current_value, unit)
  VALUES 
    (NEW.id, 'Task Completion Rate', 'completion_rate', 90.00, 0.00, '%'),
    (NEW.id, 'Resource Capacity Logged', 'logged_capacity', 160.00, 0.00, 'hrs');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_provision_department_defaults
AFTER INSERT ON departments
FOR EACH ROW
EXECUTE FUNCTION provision_department_defaults();

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_reports ENABLE ROW LEVEL SECURITY;

-- 1. Policy for Departments
CREATE POLICY tenant_departments_access ON departments
  FOR ALL
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 2. Policy for Department Members mapping
CREATE POLICY tenant_members_access ON department_members
  FOR ALL
  USING (
    department_id IN (
      SELECT id FROM departments 
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 3. Policy for Settings
CREATE POLICY tenant_settings_access ON department_settings
  FOR ALL
  USING (
    department_id IN (
      SELECT id FROM departments 
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 4. Policy for KPIs
CREATE POLICY tenant_kpis_access ON department_kpis
  FOR ALL
  USING (
    department_id IN (
      SELECT id FROM departments 
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 5. Policy for Dashboards Layout
CREATE POLICY tenant_dashboards_access ON department_dashboards
  FOR ALL
  USING (
    department_id IN (
      SELECT id FROM departments 
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 6. Policy for Reports
CREATE POLICY tenant_reports_access ON department_reports
  FOR ALL
  USING (
    department_id IN (
      SELECT id FROM departments 
      WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ==============================================================================
-- ENTERPRISE HELPER RPC FUNCTIONS
-- ==============================================================================

-- Reassign User to Department RPC
CREATE OR REPLACE FUNCTION reassign_user_department(
  p_profile_id UUID,
  p_new_department_id UUID,
  p_is_primary BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  -- Delete existing primary mappings if this reassignment is primary
  IF p_is_primary THEN
    DELETE FROM department_members
    WHERE profile_id = p_profile_id AND is_primary = TRUE;
  END IF;

  -- Insert or Update new member relation
  INSERT INTO department_members (department_id, profile_id, is_primary)
  VALUES (p_new_department_id, p_profile_id, p_is_primary)
  ON CONFLICT (department_id, profile_id)
  DO UPDATE SET is_primary = p_is_primary;
  
  -- Update the legacy profile department column to match denormalized queries
  UPDATE profiles
  SET department = (SELECT name FROM departments WHERE id = p_new_department_id)
  WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
