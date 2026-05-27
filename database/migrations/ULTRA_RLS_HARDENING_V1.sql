-- ==============================================================================
-- ULTRA RLS & MULTI-TENANT HARDENING (PHASE 1)
-- ==============================================================================
-- This migration removes frontend trust and implements mathematically sound
-- cross-tenant isolation for high-risk tables.
-- ==============================================================================

-- 1. CREATE SECURE TENANT HELPER
-- This function extracts the organization_id from the authenticated user's profile.
-- SECURITY DEFINER ensures it can read the profiles table even if RLS is strict.
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id 
  FROM public.profiles 
  WHERE id = auth.uid();
$$;

-- ==============================================================================
-- 2. HARDEN HIGH RISK TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- TABLE: invoices
-- ------------------------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict Tenant Isolation: Select Invoices" ON public.invoices;
CREATE POLICY "Strict Tenant Isolation: Select Invoices" ON public.invoices
FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Insert Invoices" ON public.invoices;
CREATE POLICY "Strict Tenant Isolation: Insert Invoices" ON public.invoices
FOR INSERT WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Update Invoices" ON public.invoices;
CREATE POLICY "Strict Tenant Isolation: Update Invoices" ON public.invoices
FOR UPDATE USING (organization_id = get_my_org_id()) WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Delete Invoices" ON public.invoices;
CREATE POLICY "Strict Tenant Isolation: Delete Invoices" ON public.invoices
FOR DELETE USING (organization_id = get_my_org_id());

-- ------------------------------------------------------------------------------
-- TABLE: leads
-- ------------------------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict Tenant Isolation: Select CRM Leads" ON public.leads;
CREATE POLICY "Strict Tenant Isolation: Select CRM Leads" ON public.leads
FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Insert CRM Leads" ON public.leads;
CREATE POLICY "Strict Tenant Isolation: Insert CRM Leads" ON public.leads
FOR INSERT WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Update CRM Leads" ON public.leads;
CREATE POLICY "Strict Tenant Isolation: Update CRM Leads" ON public.leads
FOR UPDATE USING (organization_id = get_my_org_id()) WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Delete CRM Leads" ON public.leads;
CREATE POLICY "Strict Tenant Isolation: Delete CRM Leads" ON public.leads
FOR DELETE USING (organization_id = get_my_org_id());

-- ------------------------------------------------------------------------------
-- TABLE: work_sessions
-- ------------------------------------------------------------------------------
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict Tenant Isolation: Select Work Sessions" ON public.work_sessions;
CREATE POLICY "Strict Tenant Isolation: Select Work Sessions" ON public.work_sessions
FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Insert Work Sessions" ON public.work_sessions;
CREATE POLICY "Strict Tenant Isolation: Insert Work Sessions" ON public.work_sessions
FOR INSERT WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Update Work Sessions" ON public.work_sessions;
CREATE POLICY "Strict Tenant Isolation: Update Work Sessions" ON public.work_sessions
FOR UPDATE USING (organization_id = get_my_org_id()) WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Delete Work Sessions" ON public.work_sessions;
CREATE POLICY "Strict Tenant Isolation: Delete Work Sessions" ON public.work_sessions
FOR DELETE USING (organization_id = get_my_org_id());

-- ------------------------------------------------------------------------------
-- TABLE: tasks
-- ------------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict Tenant Isolation: Select Tasks" ON public.tasks;
CREATE POLICY "Strict Tenant Isolation: Select Tasks" ON public.tasks
FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Insert Tasks" ON public.tasks;
CREATE POLICY "Strict Tenant Isolation: Insert Tasks" ON public.tasks
FOR INSERT WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Update Tasks" ON public.tasks;
CREATE POLICY "Strict Tenant Isolation: Update Tasks" ON public.tasks
FOR UPDATE USING (organization_id = get_my_org_id()) WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Delete Tasks" ON public.tasks;
CREATE POLICY "Strict Tenant Isolation: Delete Tasks" ON public.tasks
FOR DELETE USING (organization_id = get_my_org_id());

-- ------------------------------------------------------------------------------
-- TABLE: projects
-- ------------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict Tenant Isolation: Select Projects" ON public.projects;
CREATE POLICY "Strict Tenant Isolation: Select Projects" ON public.projects
FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Insert Projects" ON public.projects;
CREATE POLICY "Strict Tenant Isolation: Insert Projects" ON public.projects
FOR INSERT WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Update Projects" ON public.projects;
CREATE POLICY "Strict Tenant Isolation: Update Projects" ON public.projects
FOR UPDATE USING (organization_id = get_my_org_id()) WITH CHECK (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Strict Tenant Isolation: Delete Projects" ON public.projects;
CREATE POLICY "Strict Tenant Isolation: Delete Projects" ON public.projects
FOR DELETE USING (organization_id = get_my_org_id());

-- ==============================================================================
-- VALIDATION CHECK
-- ==============================================================================
-- To test this, you can attempt to run the following in Supabase SQL editor
-- under an authenticated user's role (not postgres superuser):
-- 
-- INSERT INTO invoices (organization_id, ...) 
-- VALUES ('<ANOTHER_ORG_UUID>', ...);
-- 
-- It should immediately fail with: "new row violates row-level security policy"
