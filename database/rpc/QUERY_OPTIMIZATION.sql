-- ==============================================================================
-- ENTERPRISE QUERY OPTIMIZATION & SEARCH ENGINE
-- Implements O(log n) indexing and high-performance aggregation RPCs
-- ==============================================================================

-- 1. CRITICAL PERFORMANCE INDEXES
-- Index foreign keys to eliminate full table scans on joins
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_task_time_logs_task_id ON public.task_time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);

-- 2. FUZZY SEARCH ENGINE (GIN TRGM)
-- Enables fast search across core entities
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_leads_search_trgm ON public.leads USING gin (first_name gin_trgm_ops, last_name gin_trgm_ops, email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_search_trgm ON public.projects USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tasks_search_trgm ON public.tasks USING gin (title gin_trgm_ops);

-- 3. OPTIMIZED GLOBAL SEARCH RPC
-- Search everything in a single blazingly fast call
CREATE OR REPLACE FUNCTION public.global_search(search_query TEXT)
RETURNS TABLE (
    id UUID,
    type TEXT,
    title TEXT,
    subtitle TEXT,
    relevance REAL
) AS $$
DECLARE
    v_org_id UUID;
BEGIN
    v_org_id := public.get_my_org_id();

    RETURN QUERY
    -- Search Leads
    SELECT l.id, 'lead'::TEXT, l.first_name || ' ' || COALESCE(l.last_name, ''), l.email, word_similarity(search_query, l.first_name || ' ' || l.last_name)
    FROM public.leads l
    WHERE l.organization_id = v_org_id AND (l.first_name % search_query OR l.last_name % search_query OR l.email % search_query)
    
    UNION ALL

    -- Search Projects
    SELECT p.id, 'project'::TEXT, p.name, c.name as subtitle, word_similarity(search_query, p.name)
    FROM public.projects p
    LEFT JOIN public.clients c ON p.client_id = c.id
    WHERE p.organization_id = v_org_id AND p.name % search_query
    
    UNION ALL

    -- Search Tasks
    SELECT t.id, 'task'::TEXT, t.title, p.name as subtitle, word_similarity(search_query, t.title)
    FROM public.tasks t
    LEFT JOIN public.projects p ON t.project_id = p.id
    WHERE t.organization_id = v_org_id AND t.title % search_query
    
    ORDER BY relevance DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. EXECUTIVE ANALYTICS AGGREGATOR
-- Fetches the entire dashboard state in ONE trip
CREATE OR REPLACE FUNCTION public.get_executive_overview()
RETURNS JSON AS $$
DECLARE
    v_org_id UUID;
    v_result JSON;
BEGIN
    v_org_id := public.get_my_org_id();

    SELECT json_build_object(
        'total_revenue', (SELECT COALESCE(SUM(amount), 0) FROM public.invoices WHERE organization_id = v_org_id AND status = 'paid'),
        'active_projects', (SELECT COUNT(*) FROM public.projects WHERE organization_id = v_org_id AND status = 'active'),
        'pending_tasks', (SELECT COUNT(*) FROM public.tasks WHERE organization_id = v_org_id AND status != 'done'),
        'revenue_by_month', (
            SELECT json_agg(t) FROM (
                SELECT to_char(created_at, 'Mon') as month, SUM(amount) as total
                FROM public.invoices
                WHERE organization_id = v_org_id AND created_at > NOW() - INTERVAL '6 months'
                GROUP BY month, date_trunc('month', created_at)
                ORDER BY date_trunc('month', created_at)
            ) t
        ),
        'top_clients', (
            SELECT json_agg(c) FROM (
                SELECT cl.name, COUNT(p.id) as project_count
                FROM public.clients cl
                LEFT JOIN public.projects p ON p.client_id = cl.id
                WHERE cl.organization_id = v_org_id
                GROUP BY cl.name
                ORDER BY project_count DESC
                LIMIT 5
            ) c
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
