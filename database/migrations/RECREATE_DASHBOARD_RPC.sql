-- ==============================================================================
-- RECREATE BROKEN RPCS AFTER DROPPING time_logs
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_aggregated_dashboard_data(
    p_org_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats JSONB;
    v_health JSONB;
    v_deadlines JSONB;
    v_activities JSONB;
    v_chart JSONB;
    
    v_total_revenue DECIMAL;
    v_active_projects INT;
    v_overdue_tasks INT;
    v_utilization DECIMAL;
    v_total_minutes INT;
BEGIN
    -- 1. Get Stats
    SELECT COALESCE(SUM(grand_total), 0) INTO v_total_revenue
    FROM public.invoices
    WHERE organization_id = p_org_id
      AND status = 'paid'
      AND deleted_at IS NULL
      AND (p_start_date IS NULL OR date >= p_start_date)
      AND (p_end_date IS NULL OR date <= p_end_date);

    SELECT COUNT(*) INTO v_active_projects
    FROM public.projects
    WHERE organization_id = p_org_id
      AND deleted_at IS NULL
      AND (is_archived IS NULL OR is_archived = false)
      AND (p_start_date IS NULL OR created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR created_at::date <= p_end_date);

    SELECT COUNT(*) INTO v_overdue_tasks
    FROM public.tasks
    WHERE organization_id = p_org_id
      AND deleted_at IS NULL
      AND status != 'done'
      AND due_date < CURRENT_DATE
      AND (p_start_date IS NULL OR created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR created_at::date <= p_end_date);

    -- Use work_sessions instead of time_logs
    WITH employee_count AS (
        SELECT COUNT(id) as count FROM public.profiles 
        WHERE organization_id = p_org_id AND status = 'active'
    ),
    logged_time AS (
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, CURRENT_TIMESTAMP) - start_time))/60), 0) as total_mins
        FROM public.work_sessions ws
        JOIN public.profiles p ON ws.user_id = p.id
        WHERE ws.start_time >= (CURRENT_DATE - INTERVAL '7 days')
          AND p.organization_id = p_org_id
    )
    SELECT 
        logged_time.total_mins,
        CASE 
            WHEN employee_count.count = 0 THEN 0
            ELSE ROUND((logged_time.total_mins::DECIMAL / (employee_count.count * 40 * 60)) * 100, 1)
        END
    INTO v_total_minutes, v_utilization
    FROM employee_count, logged_time;

    v_stats := jsonb_build_object(
        'revenue', v_total_revenue,
        'active_projects', v_active_projects,
        'overdue_tasks', v_overdue_tasks,
        'utilization', v_utilization,
        'total_minutes', v_total_minutes
    );

    SELECT COALESCE(jsonb_agg(health_data), '[]'::jsonb) INTO v_health
    FROM (
        SELECT 
            p.id, p.name, p.status,
            COUNT(t.id) as total_tasks,
            COUNT(t.id) FILTER (WHERE t.status = 'done') as completed_tasks,
            CASE WHEN COUNT(t.id) = 0 THEN 0 ELSE ROUND((COUNT(t.id) FILTER (WHERE t.status = 'done')::DECIMAL / COUNT(t.id)) * 100) END as progress
        FROM public.projects p
        LEFT JOIN public.tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
        WHERE p.organization_id = p_org_id AND p.deleted_at IS NULL AND p.status IN ('planning', 'in_progress', 'on_hold')
        GROUP BY p.id, p.name, p.status
        ORDER BY p.updated_at DESC
        LIMIT 5
    ) health_data;

    SELECT COALESCE(jsonb_agg(deadline_data), '[]'::jsonb) INTO v_deadlines
    FROM (
        SELECT 
            t.id, t.title, t.due_date, t.status, p.name as project_name, (t.due_date < CURRENT_DATE) as is_overdue
        FROM public.tasks t
        LEFT JOIN public.projects p ON t.project_id = p.id
        WHERE t.organization_id = p_org_id AND t.deleted_at IS NULL AND t.status != 'done' AND t.due_date IS NOT NULL
        ORDER BY t.due_date ASC
        LIMIT 4
    ) deadline_data;

    SELECT COALESCE(jsonb_agg(activity_data), '[]'::jsonb) INTO v_activities
    FROM (
        SELECT 
            a.id, a.action as action_type, a.target_name, a.created_at, COALESCE(p.full_name, 'System') as actor_name
        FROM public.activities a
        LEFT JOIN public.profiles p ON a.user_id = p.id
        WHERE a.organization_id = p_org_id
        ORDER BY a.created_at DESC
        LIMIT 5
    ) activity_data;

    WITH months AS (SELECT date_trunc('month', CURRENT_DATE - interval '1 month' * generate_series(0, 5)) as month),
    monthly_revenue AS (
        SELECT date_trunc('month', date) as month, SUM(grand_total) as revenue
        FROM public.invoices
        WHERE organization_id = p_org_id AND status = 'paid' AND deleted_at IS NULL
        GROUP BY date_trunc('month', date)
    )
    SELECT COALESCE(jsonb_agg(chart_row), '[]'::jsonb) INTO v_chart
    FROM (
        SELECT to_char(m.month, 'Mon') as name, COALESCE(mr.revenue, 0) as revenue, COALESCE(mr.revenue, 0) * 1.1 as projected
        FROM months m LEFT JOIN monthly_revenue mr ON m.month = mr.month ORDER BY m.month ASC
    ) chart_row;

    RETURN jsonb_build_object('stats', v_stats, 'health', v_health, 'deadlines', v_deadlines, 'activities', v_activities, 'chart', v_chart);
END;
$$;

-- Fix get_dashboard_summary_kpis as well
CREATE OR REPLACE FUNCTION public.get_dashboard_summary_kpis(p_org_id UUID)
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
            (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE organization_id = p_org_id AND status = 'paid') as revenue,
            (SELECT COUNT(*) FROM projects WHERE organization_id = p_org_id AND status = 'in_progress' AND deleted_at IS NULL) as active_projects,
            (SELECT COUNT(*) FROM tasks WHERE organization_id = p_org_id AND status != 'done' AND due_date < CURRENT_DATE AND deleted_at IS NULL) as overdue_tasks,
            (
                SELECT 
                    CASE 
                        WHEN (COUNT(DISTINCT p_inner.id) * 40 * 60) = 0 THEN 0
                        ELSE ROUND((COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ws.end_time, CURRENT_TIMESTAMP) - ws.start_time))/60), 0)::DECIMAL / (COUNT(DISTINCT p_inner.id) * 40 * 60)) * 100)
                    END
                FROM profiles p_inner
                LEFT JOIN work_sessions ws ON ws.user_id = p_inner.id AND ws.start_time >= (CURRENT_DATE - INTERVAL '7 days')
                WHERE p_inner.organization_id = p_org_id AND p_inner.status = 'active'
            ) as utilization
    )
    SELECT row_to_json(stats)::JSONB INTO v_result FROM stats;
    RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
