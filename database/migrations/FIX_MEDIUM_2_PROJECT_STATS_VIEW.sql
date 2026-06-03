-- ==============================================================================
-- FIX MEDIUM-2: PROJECT STATS MATERIALIZED VIEW
-- ==============================================================================
-- This view offloads the heavy aggregation of tasks, time logs, and invoices 
-- from the frontend into a single pre-calculated database view.

CREATE OR REPLACE VIEW public.v_project_health_stats AS
WITH task_stats AS (
    SELECT 
        t.project_id,
        COUNT(t.id) as total_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'done') as completed_tasks,
        COUNT(t.id) FILTER (WHERE t.status != 'done' AND t.due_date < CURRENT_DATE) as overdue_tasks,
        COALESCE(SUM(
            (tl.duration_minutes::numeric / 60.0) * COALESCE(p.hourly_rate, 0)
        ), 0) as labor_cost
    FROM public.tasks t
    LEFT JOIN public.time_logs tl ON t.id = tl.task_id
    LEFT JOIN public.profiles p ON tl.user_id = p.id
    GROUP BY t.project_id
),
invoice_stats AS (
    SELECT 
        project_id,
        COALESCE(SUM(grand_total) FILTER (WHERE status = 'paid'), 0) as revenue,
        COALESCE(SUM(grand_total), 0) as total_invoiced
    FROM public.invoices
    GROUP BY project_id
),
expense_stats AS (
    SELECT 
        project_id,
        COALESCE(SUM(amount), 0) as total_expenses
    FROM public.project_expenses
    GROUP BY project_id
),
milestone_stats AS (
    SELECT 
        project_id,
        COUNT(id) FILTER (WHERE is_completed = false AND due_date < CURRENT_DATE) as missed_milestones
    FROM public.project_milestones
    GROUP BY project_id
)
SELECT 
    p.id as project_id,
    COALESCE(ts.total_tasks, 0) as total_tasks,
    COALESCE(ts.completed_tasks, 0) as completed_tasks,
    COALESCE(ts.overdue_tasks, 0) as overdue_tasks,
    COALESCE(ms.missed_milestones, 0) as missed_milestones,
    COALESCE(ts.labor_cost, 0) as labor_cost,
    COALESCE(es.total_expenses, 0) as expense_total,
    COALESCE(ins.revenue, 0) as revenue,
    COALESCE(ins.total_invoiced, 0) as total_invoiced,
    -- Financial Math
    COALESCE(ts.labor_cost, 0) + COALESCE(es.total_expenses, 0) as total_cost,
    COALESCE(ins.revenue, 0) - (COALESCE(ts.labor_cost, 0) + COALESCE(es.total_expenses, 0)) as profit,
    CASE WHEN p.budget > 0 THEN (COALESCE(ins.total_invoiced, 0) / p.budget) * 100 ELSE 0 END as budget_burn
FROM public.projects p
LEFT JOIN task_stats ts ON p.id = ts.project_id
LEFT JOIN invoice_stats ins ON p.id = ins.project_id
LEFT JOIN expense_stats es ON p.id = es.project_id
LEFT JOIN milestone_stats ms ON p.id = ms.project_id;

-- Grant access
GRANT SELECT ON public.v_project_health_stats TO authenticated;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
