-- ==============================================================================
-- FIX: CRITICAL RLS SUBQUERY PERFORMANCE BLOCKER
-- ==============================================================================
-- As identified in the CTO Audit, using a raw subquery:
-- (SELECT organization_id FROM profiles WHERE id = auth.uid())
-- in every RLS policy forces Postgres to execute a table scan per row evaluated.
--
-- This script replaces all raw subqueries with public.get_my_org_id(),
-- which is declared STABLE and therefore cached per query execution.
-- ==============================================================================

-- 1. Ensure the helper function is STABLE and highly optimized
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

-- 2. Purge and Recreate Policies for Core High-Traffic Tables

DO $$
BEGIN
  -- ==========================================
  -- 1. LEADS
  -- ==========================================
  DROP POLICY IF EXISTS "leads_all" ON public.leads;
  DROP POLICY IF EXISTS "Orgs can view their own leads" ON public.leads;
  DROP POLICY IF EXISTS "leads_tenant_isolation" ON public.leads;
  
  CREATE POLICY "leads_tenant_isolation" ON public.leads
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

  -- ==========================================
  -- 2. TASKS
  -- ==========================================
  DROP POLICY IF EXISTS "tasks_all" ON public.tasks;
  DROP POLICY IF EXISTS "Orgs can view their own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Orgs can insert their own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "Orgs can update their own tasks" ON public.tasks;
  DROP POLICY IF EXISTS "tasks_tenant_isolation" ON public.tasks;
  
  CREATE POLICY "tasks_tenant_isolation" ON public.tasks
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

  -- ==========================================
  -- 3. PROJECTS
  -- ==========================================
  DROP POLICY IF EXISTS "projects_all" ON public.projects;
  DROP POLICY IF EXISTS "Orgs can view their own projects" ON public.projects;
  DROP POLICY IF EXISTS "Orgs can insert their own projects" ON public.projects;
  DROP POLICY IF EXISTS "Orgs can update their own projects" ON public.projects;
  DROP POLICY IF EXISTS "projects_tenant_isolation" ON public.projects;

  CREATE POLICY "projects_tenant_isolation" ON public.projects
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

  -- ==========================================
  -- 4. CLIENTS
  -- ==========================================
  DROP POLICY IF EXISTS "clients_all" ON public.clients;
  DROP POLICY IF EXISTS "clients_tenant_isolation" ON public.clients;

  CREATE POLICY "clients_tenant_isolation" ON public.clients
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

  -- ==========================================
  -- 5. DEPARTMENTS & MAPPINGS
  -- ==========================================
  DROP POLICY IF EXISTS "tenant_departments_access" ON public.departments;
  DROP POLICY IF EXISTS "departments_tenant_isolation" ON public.departments;
  CREATE POLICY "departments_tenant_isolation" ON public.departments
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

  DROP POLICY IF EXISTS "tenant_employee_team_mapping_all" ON public.employee_team_mapping;
  DROP POLICY IF EXISTS "employee_team_mapping_isolation" ON public.employee_team_mapping;
  CREATE POLICY "employee_team_mapping_isolation" ON public.employee_team_mapping
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

  -- ==========================================
  -- 6. CLIENT STATEMENTS & BILLING
  -- ==========================================
  DROP POLICY IF EXISTS "tenant_client_statements_all" ON public.client_statements;
  DROP POLICY IF EXISTS "client_statements_tenant_isolation" ON public.client_statements;
  CREATE POLICY "client_statements_tenant_isolation" ON public.client_statements
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id());

  DROP POLICY IF EXISTS "tenant_client_balance_summary_all" ON public.client_balance_summary;
  DROP POLICY IF EXISTS "client_balance_summary_tenant_isolation" ON public.client_balance_summary;
  CREATE POLICY "client_balance_summary_tenant_isolation" ON public.client_balance_summary
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

  DROP POLICY IF EXISTS "invoices_all" ON public.invoices;
  DROP POLICY IF EXISTS "invoices_tenant_isolation" ON public.invoices;
  CREATE POLICY "invoices_tenant_isolation" ON public.invoices
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

END $$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
