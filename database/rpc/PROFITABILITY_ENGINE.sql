-- ==============================================================================
-- PROJECT PROFITABILITY CALCULATION ENGINE
-- Standardized logic for calculating Revenue, Labor, Expenses, and Margins
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_project_profitability(p_project_id UUID DEFAULT NULL)
RETURNS TABLE (
    project_id UUID,
    project_name TEXT,
    total_revenue DECIMAL,
    labor_cost DECIMAL,
    expense_total DECIMAL,
    total_cost DECIMAL,
    profit DECIMAL,
    margin_percentage DECIMAL,
    billable_hours DECIMAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH labor_stats AS (
        -- Calculate labor cost per project based on time logs and member hourly rates
        SELECT 
            t.project_id,
            SUM((tl.duration_minutes / 60.0) * COALESCE(p.hourly_rate, 0)) as labor_cost,
            SUM(tl.duration_minutes / 60.0) as total_hours
        FROM public.tasks t
        JOIN public.task_time_logs tl ON t.id = tl.task_id
        JOIN public.profiles p ON tl.user_id = p.id
        GROUP BY t.project_id
    ),
    expense_stats AS (
        -- Aggregate project-specific expenses
        SELECT 
            pe.project_id,
            SUM(pe.amount) as expense_total
        FROM public.project_expenses pe
        GROUP BY pe.project_id
    ),
    revenue_stats AS (
        -- Sum paid invoices for each project (uses grand_total from enterprise billing schema)
        SELECT 
            i.project_id,
            SUM(i.grand_total) as revenue_total
        FROM public.invoices i
        WHERE i.status = 'paid'
          AND i.deleted_at IS NULL
        GROUP BY i.project_id
    )
    SELECT 
        pj.id as project_id,
        pj.name::TEXT as project_name,
        COALESCE(rs.revenue_total, 0) as total_revenue,
        COALESCE(ls.labor_cost, 0) as labor_cost,
        COALESCE(es.expense_total, 0) as expense_total,
        (COALESCE(ls.labor_cost, 0) + COALESCE(es.expense_total, 0)) as total_cost,
        (COALESCE(rs.revenue_total, 0) - (COALESCE(ls.labor_cost, 0) + COALESCE(es.expense_total, 0))) as profit,
        CASE 
            WHEN COALESCE(rs.revenue_total, 0) > 0 
            THEN ROUND(((COALESCE(rs.revenue_total, 0) - (COALESCE(ls.labor_cost, 0) + COALESCE(es.expense_total, 0))) / rs.revenue_total) * 100, 2)
            ELSE 0 
        END as margin_percentage,
        COALESCE(ls.total_hours, 0) as billable_hours
    FROM public.projects pj
    LEFT JOIN labor_stats ls ON pj.id = ls.project_id
    LEFT JOIN expense_stats es ON pj.id = es.project_id
    LEFT JOIN revenue_stats rs ON pj.id = rs.project_id
    WHERE pj.organization_id = public.get_my_org_id()
      AND (p_project_id IS NULL OR pj.id = p_project_id)
      AND pj.deleted_at IS NULL
    ORDER BY total_revenue DESC;
END;
$$;
