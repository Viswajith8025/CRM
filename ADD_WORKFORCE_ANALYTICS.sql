-- ============================================================
-- Migration: Add Workforce Analytics Tables
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Dynamic KPI Definitions
CREATE TABLE IF NOT EXISTS department_kpi_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  department VARCHAR NOT NULL,
  kpi_key VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  data_source_rpc VARCHAR NOT NULL,
  visualization_type VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Department specific layout configurations
CREATE TABLE IF NOT EXISTS department_dashboard_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  department VARCHAR NOT NULL,
  layout_config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Snapshots for historical rendering
CREATE TABLE IF NOT EXISTS employee_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  department_id UUID,
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_kpi_org_dept ON department_kpi_registry(organization_id, department);
CREATE INDEX IF NOT EXISTS idx_dash_org_dept ON department_dashboard_views(organization_id, department);
CREATE INDEX IF NOT EXISTS idx_snapshot_org_user_date ON employee_performance_snapshots(organization_id, user_id, snapshot_date);

-- Add sample KPIs for different departments
-- Note: Replace 'your_org_id' with the actual organization_id in practice, 
-- or handle seeding via the application.
