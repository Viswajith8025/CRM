-- ==============================================================================
-- DASHBOARD PERFORMANCE OVERHAUL: Server-Side KPI Engine (FIXED TYPES)
-- ==============================================================================

-- 1. Optimized Project Health RPC
-- Calculates progress server-side to prevent browser freezes.
CREATE OR REPLACE FUNCTION public.get_project_health_kpis(
    p_org_id UUID,
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    progress INT,
    total_tasks INT,
    completed_tasks INT,
    status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id::UUID,
        p.name::TEXT,
        CASE 
            WHEN COUNT(t.id) = 0 THEN 0 
            ELSE ROUND((COUNT(t.id) FILTER (WHERE t.status = 'done')::DECIMAL / COUNT(t.id)) * 100)::INT 
        END as progress,
        COUNT(t.id)::INT as total_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'done')::INT as completed_tasks,
        p.status::TEXT
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE p.organization_id = p_org_id
      AND p.status = 'in_progress'
      AND p.deleted_at IS NULL
    GROUP BY p.id, p.name, p.status
    ORDER BY p.updated_at DESC
    LIMIT p_limit;
END;
$$;

-- 2. Optimized Critical Deadlines RPC
-- Returns only the most urgent tasks, preventing client-side useMemo overload.
CREATE OR REPLACE FUNCTION public.get_critical_deadlines_kpis(
    p_org_id UUID,
    p_limit INT DEFAULT 4
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    due_date DATE,
    project_name TEXT,
    status TEXT,
    is_overdue BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id::UUID,
        t.title::TEXT,
        t.due_date::DATE,
        p.name::TEXT as project_name,
        t.status::TEXT,
        (t.due_date < CURRENT_DATE)::BOOLEAN as is_overdue
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.organization_id = p_org_id
      AND t.status != 'done'
      AND t.due_date IS NOT NULL
      AND t.deleted_at IS NULL
    ORDER BY t.due_date ASC
    LIMIT p_limit;
END;
$$;

-- 3. Unified Global KPI RPC
-- Atomic fetch of all dashboard numbers.
CREATE OR REPLACE FUNCTION public.get_dashboard_summary_kpis(
    p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH stats AS (
        SELECT
            -- Revenue
            (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE organization_id = p_org_id AND status = 'paid') as revenue,
            -- Active Projects
            (SELECT COUNT(*) FROM projects WHERE organization_id = p_org_id AND status = 'in_progress' AND deleted_at IS NULL) as active_projects,
            -- Overdue Tasks
            (SELECT COUNT(*) FROM tasks WHERE organization_id = p_org_id AND status != 'done' AND due_date < CURRENT_DATE AND deleted_at IS NULL) as overdue_tasks,
            -- Utilization (7-day window)
            (
                SELECT 
                    CASE 
                        WHEN (COUNT(DISTINCT p_inner.id) * 40 * 60) = 0 THEN 0
                        ELSE ROUND((COALESCE(SUM(tl.duration_minutes), 0)::DECIMAL / (COUNT(DISTINCT p_inner.id) * 40 * 60)) * 100)
                    END
                FROM profiles p_inner
                LEFT JOIN time_logs tl ON tl.user_id = p_inner.id AND tl.start_time >= (CURRENT_DATE - INTERVAL '7 days')
                WHERE p_inner.organization_id = p_org_id AND p_inner.status = 'active'
            ) as utilization
    )
    SELECT row_to_json(stats)::JSONB INTO v_result FROM stats;
    RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
