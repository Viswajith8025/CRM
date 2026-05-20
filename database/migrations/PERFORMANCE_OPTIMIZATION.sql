-- ==============================================================================
-- ENTERPRISE PERFORMANCE OPTIMIZATION SCHEMA
-- ==============================================================================
-- This script implements server-side aggregations (RPCs) to eliminate
-- client-side over-fetching and improve dashboard performance.

-- 1. DASHBOARD STATS RPC
-- Replaces client-side .reduce() and .filter() on massive datasets.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_org_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_revenue DECIMAL(12, 2);
    v_active_projects INT;
    v_overdue_tasks INT;
    v_utilization INT;
    v_total_minutes INT;
    v_member_count INT;
    v_capacity_minutes INT;
BEGIN
    -- 1. REVENUE (Paid invoices within range)
    SELECT COALESCE(SUM(amount), 0) INTO v_revenue
    FROM invoices
    WHERE organization_id = p_org_id
      AND status = 'paid'
      AND (p_start_date IS NULL OR issued_at >= p_start_date)
      AND (p_end_date IS NULL OR issued_at <= p_end_date);

    -- 2. ACTIVE PROJECTS (In progress projects within range)
    SELECT COUNT(*) INTO v_active_projects
    FROM projects
    WHERE organization_id = p_org_id
      AND status = 'in_progress'
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date);

    -- 3. OVERDUE TASKS (Not done, past due date)
    SELECT COUNT(*) INTO v_overdue_tasks
    FROM tasks
    WHERE organization_id = p_org_id
      AND status != 'done'
      AND due_date < CURRENT_DATE
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date);

    -- 4. UTILIZATION (Logged minutes vs Capacity in last 7 days)
    SELECT COALESCE(SUM(duration_minutes), 0) INTO v_total_minutes
    FROM time_logs
    WHERE organization_id = p_org_id
      AND start_time >= (CURRENT_DATE - INTERVAL '7 days');

    SELECT COUNT(*) INTO v_member_count
    FROM profiles
    WHERE organization_id = p_org_id
      AND status = 'active';

    v_capacity_minutes := GREATEST(v_member_count, 1) * 40 * 60;
    v_utilization := LEAST(ROUND((v_total_minutes::DECIMAL / GREATEST(v_capacity_minutes, 1)) * 100), 100);

    RETURN jsonb_build_object(
        'revenue', v_revenue,
        'active_projects', v_active_projects,
        'overdue_tasks', v_overdue_tasks,
        'utilization', v_utilization,
        'total_minutes', v_total_minutes
    );
END;
$$;

-- 2. REVENUE CHART RPC
-- Aggregates daily revenue on the server.
CREATE OR REPLACE FUNCTION public.get_revenue_chart_data(
    p_org_id UUID,
    p_days INT DEFAULT 7
)
RETURNS TABLE (
    day_name TEXT,
    revenue DECIMAL(12, 2)
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
        to_char(ds.d, 'Dy') as day_name,
        COALESCE(SUM(i.amount), 0) as revenue
    FROM date_series ds
    LEFT JOIN invoices i ON i.issued_at = ds.d 
      AND i.organization_id = p_org_id 
      AND i.status = 'paid'
    GROUP BY ds.d
    ORDER BY ds.d;
END;
$$;

-- 3. ACTIVITY FEED RPC (Lighter Weight)
-- Returns just what is needed for the dashboard feed.
CREATE OR REPLACE FUNCTION public.get_recent_activity_summary(
    p_org_id UUID,
    p_limit INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    actor_name TEXT,
    action_type TEXT,
    target_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        p.full_name as actor_name,
        a.action as action_type,
        a.target_name,
        a.created_at
    FROM activities a
    LEFT JOIN profiles p ON p.id = a.user_id
    WHERE a.organization_id = p_org_id
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 4. KPI TRIGGER (FOR FINANCIAL INTEGRITY)
-- Automatically updates invoice paid_amount when a payment is verified.
CREATE OR REPLACE FUNCTION public.sync_invoice_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status != 'verified' AND NEW.status = 'verified') 
       OR (TG_OP = 'INSERT' AND NEW.status = 'verified') THEN
        
        UPDATE invoices
        SET 
            paid_amount = COALESCE(paid_amount, 0) + NEW.amount,
            status = CASE 
                WHEN (COALESCE(paid_amount, 0) + NEW.amount) >= amount THEN 'paid'::invoice_status
                ELSE 'partially_paid'::invoice_status
            END,
            updated_at = NOW()
        WHERE id = NEW.invoice_id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_verified ON payments;
CREATE TRIGGER on_payment_verified
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_paid_amount();

NOTIFY pgrst, 'reload schema';
