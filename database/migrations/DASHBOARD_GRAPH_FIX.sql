-- ==============================================================================
-- DASHBOARD GRAPH FIX: Robust Date Comparison
-- ==============================================================================
-- Fixes the revenue chart being empty due to timestamp/date comparison mismatch.
-- 1. Drop existing version first to allow return type change
DROP FUNCTION IF EXISTS public.get_revenue_chart_data(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_revenue_chart_data(
    p_org_id UUID,
    p_days INT DEFAULT 7
)
RETURNS TABLE (
    name TEXT,
    revenue NUMERIC,
    projected NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            CURRENT_DATE - (p_days - 1) * INTERVAL '1 day',
            CURRENT_DATE,
            '1 day'::interval
        )::date AS d
    )
    SELECT 
        to_char(ds.d, 'Dy')::TEXT as name,
        COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0)::NUMERIC as revenue,
        COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'sent'), 0)::NUMERIC as projected
    FROM date_series ds
    LEFT JOIN invoices i ON i.issued_at::DATE = ds.d 
      AND i.organization_id = p_org_id 
      AND i.deleted_at IS NULL
    GROUP BY ds.d
    ORDER BY ds.d;
END;
$$;


NOTIFY pgrst, 'reload schema';
