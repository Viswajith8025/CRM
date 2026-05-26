-- ==============================================================================
-- SEED DASHBOARD TEMPLATES
-- Provisions standard dashboard templates for different roles (Sales, Dev, etc.)
-- Run this in Supabase SQL Editor AFTER ENTERPRISE_WORKFORCE_INTELLIGENCE.sql
-- ==============================================================================

DO $$
DECLARE
    v_org_id UUID;
    v_sales_template UUID;
    v_dev_template UUID;
    v_layout_id UUID;
    
    -- KPIs
    v_kpi_calls UUID;
    v_kpi_conv UUID;
    v_kpi_rev UUID;
    v_kpi_leads UUID;
    v_kpi_code UUID;
    v_kpi_bugs UUID;
    v_kpi_proj UUID;
BEGIN
    -- 1. Determine Organization
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
    IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.profiles LIMIT 1;
    END IF;
    IF v_org_id IS NULL THEN 
        RAISE NOTICE 'No organization found to seed templates into.';
        RETURN; 
    END IF;

    -- 2. Fetch KPI IDs
    SELECT id INTO v_kpi_calls FROM public.kpi_registry WHERE code = 'calls_attempted';
    SELECT id INTO v_kpi_conv FROM public.kpi_registry WHERE code = 'conversion_rate';
    SELECT id INTO v_kpi_rev FROM public.kpi_registry WHERE code = 'revenue_generated';
    SELECT id INTO v_kpi_leads FROM public.kpi_registry WHERE code = 'active_leads';
    SELECT id INTO v_kpi_code FROM public.kpi_registry WHERE code = 'code_delivery_efficiency';
    SELECT id INTO v_kpi_bugs FROM public.kpi_registry WHERE code = 'bug_count';
    SELECT id INTO v_kpi_proj FROM public.kpi_registry WHERE code = 'project_completion_pct';

    -- ==========================================
    -- SALES DASHBOARD TEMPLATE
    -- ==========================================
    IF NOT EXISTS (SELECT 1 FROM public.dashboard_templates WHERE target_role = 'sales' AND organization_id = v_org_id) THEN
        INSERT INTO public.dashboard_templates (organization_id, name, target_role, is_default)
        VALUES (v_org_id, 'Sales Performance Intelligence', 'sales', false)
        RETURNING id INTO v_sales_template;

        -- Layout 1: Revenue
        INSERT INTO public.dashboard_layouts (template_id, widget_type, widget_code, title, grid_position, sort_order)
        VALUES (v_sales_template, 'metric_card', 'metric_card', 'Revenue Generated', '{"w": 1, "h": 1, "x": 0, "y": 0}'::jsonb, 1)
        RETURNING id INTO v_layout_id;
        INSERT INTO public.dashboard_metrics (layout_id, kpi_id, display_name, color_hex) VALUES (v_layout_id, v_kpi_rev, 'Revenue (INR)', '#10b981');

        -- Layout 2: Active Leads
        INSERT INTO public.dashboard_layouts (template_id, widget_type, widget_code, title, grid_position, sort_order)
        VALUES (v_sales_template, 'metric_card', 'metric_card', 'Active Leads Pipeline', '{"w": 1, "h": 1, "x": 1, "y": 0}'::jsonb, 2)
        RETURNING id INTO v_layout_id;
        INSERT INTO public.dashboard_metrics (layout_id, kpi_id, display_name, color_hex) VALUES (v_layout_id, v_kpi_leads, 'Active Leads', '#3b82f6');

        -- Layout 3: Calls
        INSERT INTO public.dashboard_layouts (template_id, widget_type, widget_code, title, grid_position, sort_order)
        VALUES (v_sales_template, 'metric_card', 'metric_card', 'Outbound Calls', '{"w": 1, "h": 1, "x": 2, "y": 0}'::jsonb, 3)
        RETURNING id INTO v_layout_id;
        INSERT INTO public.dashboard_metrics (layout_id, kpi_id, display_name, color_hex) VALUES (v_layout_id, v_kpi_calls, 'Calls Attempted', '#f59e0b');

        -- Layout 4: Conversion Rate
        INSERT INTO public.dashboard_layouts (template_id, widget_type, widget_code, title, grid_position, sort_order)
        VALUES (v_sales_template, 'metric_card', 'metric_card', 'Conversion Win Rate', '{"w": 1, "h": 1, "x": 3, "y": 0}'::jsonb, 4)
        RETURNING id INTO v_layout_id;
        INSERT INTO public.dashboard_metrics (layout_id, kpi_id, display_name, color_hex) VALUES (v_layout_id, v_kpi_conv, 'Win Rate %', '#8b5cf6');
    END IF;

    -- ==========================================
    -- DEVELOPER DASHBOARD TEMPLATE
    -- ==========================================
    IF NOT EXISTS (SELECT 1 FROM public.dashboard_templates WHERE target_role = 'developer' AND organization_id = v_org_id) THEN
        INSERT INTO public.dashboard_templates (organization_id, name, target_role, is_default)
        VALUES (v_org_id, 'Engineering Analytics', 'developer', false)
        RETURNING id INTO v_dev_template;

        -- Layout 1: Code Efficiency
        INSERT INTO public.dashboard_layouts (template_id, widget_type, widget_code, title, grid_position, sort_order)
        VALUES (v_dev_template, 'metric_card', 'metric_card', 'Delivery Efficiency', '{"w": 1, "h": 1, "x": 0, "y": 0}'::jsonb, 1)
        RETURNING id INTO v_layout_id;
        INSERT INTO public.dashboard_metrics (layout_id, kpi_id, display_name, color_hex) VALUES (v_layout_id, v_kpi_code, 'Efficiency %', '#10b981');

        -- Layout 2: Bug Count
        INSERT INTO public.dashboard_layouts (template_id, widget_type, widget_code, title, grid_position, sort_order)
        VALUES (v_dev_template, 'metric_card', 'metric_card', 'Active Bugs Assigned', '{"w": 1, "h": 1, "x": 1, "y": 0}'::jsonb, 2)
        RETURNING id INTO v_layout_id;
        INSERT INTO public.dashboard_metrics (layout_id, kpi_id, display_name, color_hex) VALUES (v_layout_id, v_kpi_bugs, 'Bug Count', '#ef4444');

        -- Layout 3: Project Completion
        INSERT INTO public.dashboard_layouts (template_id, widget_type, widget_code, title, grid_position, sort_order)
        VALUES (v_dev_template, 'metric_card', 'metric_card', 'Sprint Progress', '{"w": 1, "h": 1, "x": 2, "y": 0}'::jsonb, 3)
        RETURNING id INTO v_layout_id;
        INSERT INTO public.dashboard_metrics (layout_id, kpi_id, display_name, color_hex) VALUES (v_layout_id, v_kpi_proj, 'Completion %', '#3b82f6');
    END IF;

END $$;
