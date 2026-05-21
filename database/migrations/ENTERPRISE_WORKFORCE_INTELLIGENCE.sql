-- ==============================================================================
-- ENTERPRISE WORKFORCE INTELLIGENCE ARCHITECTURE
-- Dynamic metadata-driven dashboard engine, scalable performance logs,
-- and role-based KPI registry.
-- ==============================================================================

-- 1. KPI Registry (Master dictionary of all metrics)
CREATE TABLE IF NOT EXISTS public.kpi_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  data_type TEXT CHECK (data_type IN ('number', 'currency', 'percentage', 'time')),
  aggregation_type TEXT CHECK (aggregation_type IN ('sum', 'avg', 'count', 'max', 'min')),
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kpi_registry_code ON public.kpi_registry(code);

-- 2. Graph Registry (Predefined chart components available in the system)
CREATE TABLE IF NOT EXISTS public.graph_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  default_config JSONB DEFAULT '{}'::jsonb,
  supported_data_types TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Dashboard Templates (Role/Department specific templates)
CREATE TABLE IF NOT EXISTS public.dashboard_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  target_role TEXT, -- e.g., 'sales', 'developer', 'designer', 'team_lead', 'hr', 'super_admin'
  target_department_id UUID, -- References departments(id), left untyped FK for simplicity if departments not public
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_templates_org ON public.dashboard_templates(organization_id);

-- 4. Dashboard Layouts (The actual grid placement and widgets for a template)
CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES public.dashboard_templates(id) ON DELETE CASCADE,
  widget_type TEXT CHECK (widget_type IN ('metric_card', 'graph', 'data_table', 'custom_component', 'timeline')),
  widget_code TEXT NOT NULL,
  title TEXT NOT NULL,
  grid_position JSONB NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  graph_id UUID REFERENCES public.graph_registry(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dashboard_layouts_template ON public.dashboard_layouts(template_id);

-- 5. Dashboard Metrics (Mapping KPIs to specific widgets in a layout)
CREATE TABLE IF NOT EXISTS public.dashboard_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  layout_id UUID NOT NULL REFERENCES public.dashboard_layouts(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES public.kpi_registry(id) ON DELETE CASCADE,
  display_name TEXT,
  color_hex TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Employee Performance Logs (The scalable daily/weekly snapshotted metrics)
CREATE TABLE IF NOT EXISTS public.employee_performance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES public.kpi_registry(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value NUMERIC(15, 2) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, kpi_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_perf_logs_org ON public.employee_performance_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_perf_logs_emp ON public.employee_performance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_perf_logs_date ON public.employee_performance_logs(log_date);

-- 7. Department Performance Configs (Targets and settings for departments)
CREATE TABLE IF NOT EXISTS public.department_performance_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  department_id UUID NOT NULL,
  kpi_id UUID NOT NULL REFERENCES public.kpi_registry(id) ON DELETE CASCADE,
  target_value NUMERIC(15, 2) NOT NULL,
  period TEXT CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, kpi_id, period)
);

-- 8. Seed Default System KPIs
INSERT INTO public.kpi_registry (code, name, description, data_type, aggregation_type, category) VALUES
  ('calls_attempted', 'Calls Attempted', 'Total outbound calls made', 'number', 'sum', 'sales'),
  ('calls_connected', 'Calls Connected', 'Total calls successfully connected', 'number', 'sum', 'sales'),
  ('conversion_rate', 'Conversion Rate', 'Lead to customer conversion %', 'percentage', 'avg', 'sales'),
  ('revenue_generated', 'Revenue Generated', 'Total revenue brought in', 'currency', 'sum', 'sales'),
  ('active_leads', 'Active Leads', 'Number of active CRM leads', 'number', 'sum', 'sales'),
  
  ('code_delivery_efficiency', 'Code Delivery Efficiency', 'Ratio of tasks completed vs bugs generated', 'percentage', 'avg', 'developer'),
  ('bug_count', 'Bug Count', 'Total bugs reported', 'number', 'sum', 'developer'),
  ('project_completion_pct', 'Project Completion %', 'Overall progress on assigned projects', 'percentage', 'avg', 'developer'),
  
  ('revisions_count', 'Revisions Count', 'Total design revisions requested', 'number', 'sum', 'designer'),
  ('client_approval_rate', 'Client Approval Rate', 'Percentage of designs approved first time', 'percentage', 'avg', 'designer'),
  
  ('ranking_improvements', 'Ranking Improvements', 'Number of keywords that improved position', 'number', 'sum', 'seo'),
  ('backlinks_created', 'Backlinks Created', 'Number of quality backlinks established', 'number', 'sum', 'seo'),
  
  ('articles_assigned', 'Articles Assigned', 'Number of content articles assigned', 'number', 'sum', 'content_writer'),
  ('word_count', 'Word Count Tracked', 'Total words written and approved', 'number', 'sum', 'content_writer'),
  
  ('time_logged', 'Time Logged', 'Total time tracked in Time Desk', 'time', 'sum', 'general'),
  ('active_hours', 'Active Hours', 'Total productive hours tracked', 'time', 'sum', 'general')
ON CONFLICT (code) DO NOTHING;

-- 9. Seed Default Graph Registry
INSERT INTO public.graph_registry (code, name, supported_data_types) VALUES
  ('line_chart', 'Line Chart Trend', ARRAY['number', 'currency', 'percentage']),
  ('bar_chart', 'Bar Chart Comparison', ARRAY['number', 'currency', 'percentage']),
  ('pie_chart', 'Pie Chart Distribution', ARRAY['number', 'currency']),
  ('funnel_chart', 'Funnel Stages', ARRAY['number']),
  ('gauge_chart', 'Gauge Target', ARRAY['percentage', 'number'])
ON CONFLICT (code) DO NOTHING;

-- 10. Enable RLS
ALTER TABLE public.kpi_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_performance_configs ENABLE ROW LEVEL SECURITY;

-- 11. Policies
CREATE POLICY kpi_registry_read ON public.kpi_registry FOR SELECT USING (true);
CREATE POLICY graph_registry_read ON public.graph_registry FOR SELECT USING (true);

CREATE POLICY dashboard_templates_all ON public.dashboard_templates FOR ALL USING (organization_id = public.get_my_org_id());
CREATE POLICY dashboard_layouts_all ON public.dashboard_layouts FOR ALL USING (
  template_id IN (SELECT id FROM public.dashboard_templates WHERE organization_id = public.get_my_org_id())
);
CREATE POLICY dashboard_metrics_all ON public.dashboard_metrics FOR ALL USING (
  layout_id IN (SELECT id FROM public.dashboard_layouts WHERE template_id IN (SELECT id FROM public.dashboard_templates WHERE organization_id = public.get_my_org_id()))
);

CREATE POLICY perf_logs_admin_read ON public.employee_performance_logs FOR SELECT USING (organization_id = public.get_my_org_id());
CREATE POLICY perf_logs_self_read ON public.employee_performance_logs FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY perf_logs_all_write ON public.employee_performance_logs FOR ALL USING (organization_id = public.get_my_org_id());

CREATE POLICY dept_perf_configs_all ON public.department_performance_configs FOR ALL USING (organization_id = public.get_my_org_id());

-- Reload schema notification
NOTIFY pgrst, 'reload schema';
