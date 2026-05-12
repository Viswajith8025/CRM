-- ==============================================================================
-- ENTERPRISE GLOBAL SEARCH (Unified Index)
-- Fast, optimized searching across multi-tenant tables
-- ==============================================================================

-- 1. Optimized Global Search Function
-- Returns unified results with enough metadata for navigation
CREATE OR REPLACE FUNCTION public.global_search(
  p_query TEXT,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id          UUID,
  type        TEXT, -- 'lead', 'client', 'project', 'task', 'invoice', 'employee'
  title       TEXT,
  subtitle    TEXT,
  status      TEXT,
  link        TEXT,
  metadata    JSONB
) 
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_query TEXT;
  v_is_super_admin BOOLEAN;
BEGIN
  -- Get caller's context
  v_org_id := public.get_my_org_id();
  v_query := '%' || p_query || '%';
  
  SELECT (role = 'super_admin') INTO v_is_super_admin 
  FROM public.profiles 
  WHERE id = auth.uid();

  IF p_query IS NULL OR length(p_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  -- 1. LEADS
  SELECT 
    l.id, 
    'lead'::text as type, 
    l.first_name || ' ' || l.last_name as title,
    l.company as subtitle,
    l.status::text as status,
    '/crm?lead=' || l.id as link,
    jsonb_build_object('email', l.email) as metadata
  FROM public.leads l
  WHERE (v_is_super_admin OR l.organization_id = v_org_id)
    AND (l.first_name ILIKE v_query OR l.last_name ILIKE v_query OR l.company ILIKE v_query OR l.email ILIKE v_query)
  
  UNION ALL

  -- 2. CLIENTS
  SELECT 
    c.id, 
    'client'::text as type, 
    c.name as title,
    c.email as subtitle,
    'active'::text as status,
    '/clients?id=' || c.id as link,
    jsonb_build_object('email', c.email) as metadata
  FROM public.clients c
  WHERE (v_is_super_admin OR c.organization_id = v_org_id)
    AND (c.name ILIKE v_query OR c.email ILIKE v_query)

  UNION ALL

  -- 3. PROJECTS
  SELECT 
    p.id, 
    'project'::text as type, 
    p.name as title,
    'Project' as subtitle,
    p.status::text as status,
    '/projects/' || p.id as link,
    jsonb_build_object('budget', p.budget) as metadata
  FROM public.projects p
  WHERE (v_is_super_admin OR p.organization_id = v_org_id)
    AND (p.name ILIKE v_query OR p.description ILIKE v_query)

  UNION ALL

  -- 4. TASKS
  SELECT 
    t.id, 
    'task'::text as type, 
    t.title as title,
    'Task' as subtitle,
    t.status::text as status,
    '/tasks' as link,
    jsonb_build_object('priority', t.priority) as metadata
  FROM public.tasks t
  WHERE (v_is_super_admin OR t.organization_id = v_org_id)
    AND (t.title ILIKE v_query OR t.description ILIKE v_query)

  UNION ALL

  -- 5. INVOICES
  SELECT 
    i.id, 
    'invoice'::text as type, 
    i.invoice_number as title,
    'Invoice' as subtitle,
    i.status::text as status,
    '/billing/' || i.id as link,
    jsonb_build_object('amount', i.amount) as metadata
  FROM public.invoices i
  WHERE (v_is_super_admin OR i.organization_id = v_org_id)
    AND (i.invoice_number ILIKE v_query)

  UNION ALL

  -- 6. EMPLOYEES
  SELECT 
    prof.id, 
    'employee'::text as type, 
    prof.full_name as title,
    prof.email as subtitle,
    prof.role::text as status,
    '/profile' as link,
    jsonb_build_object('role', prof.role) as metadata
  FROM public.profiles prof
  WHERE (v_is_super_admin OR prof.organization_id = v_org_id)
    AND (prof.full_name ILIKE v_query OR prof.email ILIKE v_query)

  LIMIT p_limit;
END;
$$;

-- 2. Indexing for search performance
-- Adding GIN indexes for Trigram search (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_leads_search_trgm ON public.leads USING gin ((first_name || ' ' || last_name || ' ' || COALESCE(company, '') || ' ' || COALESCE(email, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_search_trgm ON public.clients USING gin ((name || ' ' || COALESCE(email, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON public.projects USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON public.tasks USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm ON public.profiles USING gin (full_name gin_trgm_ops);

-- Permissions
GRANT EXECUTE ON FUNCTION public.global_search(TEXT, INT) TO authenticated;

-- ==============================================================================
-- DONE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
