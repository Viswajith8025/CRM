-- ==============================================================================
-- EXECUTIVE ANALYTICS ENGINE
-- Optimized server-side aggregations for strategic KPIs
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_executive_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id UUID;
    v_now TIMESTAMPTZ := now();
    v_last_month TIMESTAMPTZ := now() - INTERVAL '1 month';
    
    v_monthly_revenue DECIMAL;
    v_prev_month_revenue DECIMAL;
    v_revenue_growth DECIMAL;
    
    v_total_leads INTEGER;
    v_converted_leads INTEGER;
    v_conversion_rate DECIMAL;
    
    v_overdue_invoices_count INTEGER;
    v_overdue_amount DECIMAL;
    
    v_at_risk_projects INTEGER;
    v_total_projects INTEGER;
    
    v_team_size INTEGER;
    v_org_growth_rate DECIMAL;
BEGIN
    v_org_id := public.get_my_org_id();

    -- 1. REVENUE METRICS
    SELECT COALESCE(SUM(amount), 0) INTO v_monthly_revenue
    FROM public.invoices
    WHERE organization_id = v_org_id 
      AND status = 'paid' 
      AND issued_at >= date_trunc('month', v_now);

    SELECT COALESCE(SUM(amount), 0) INTO v_prev_month_revenue
    FROM public.invoices
    WHERE organization_id = v_org_id 
      AND status = 'paid' 
      AND issued_at >= date_trunc('month', v_last_month)
      AND issued_at < date_trunc('month', v_now);

    IF v_prev_month_revenue > 0 THEN
        v_revenue_growth := ((v_monthly_revenue - v_prev_month_revenue) / v_prev_month_revenue) * 100;
    ELSE
        v_revenue_growth := 0;
    END IF;

    -- 2. CLIENT CONVERSION RATE (Leads to Clients)
    SELECT COUNT(*) INTO v_total_leads FROM public.leads WHERE organization_id = v_org_id;
    SELECT COUNT(*) INTO v_converted_leads FROM public.leads WHERE organization_id = v_org_id AND status = 'active_client';
    
    IF v_total_leads > 0 THEN
        v_conversion_rate := (v_converted_leads::DECIMAL / v_total_leads) * 100;
    ELSE
        v_conversion_rate := 0;
    END IF;

    -- 3. OVERDUE METRICS
    SELECT COUNT(*), COALESCE(SUM(amount), 0) 
    INTO v_overdue_invoices_count, v_overdue_amount
    FROM public.invoices
    WHERE organization_id = v_org_id 
      AND (status = 'overdue' OR (status = 'sent' AND due_date < v_now));

    -- 4. PROJECT RISK
    -- This relies on the health scores calculated by projectsStore or stored in DB
    -- For now, we'll use a simplified check
    SELECT COUNT(*) INTO v_total_projects FROM public.projects WHERE organization_id = v_org_id AND deleted_at IS NULL;
    SELECT COUNT(*) INTO v_at_risk_projects 
    FROM public.projects 
    WHERE organization_id = v_org_id 
      AND deleted_at IS NULL 
      AND (
        status = 'on_hold' 
        OR (status = 'in_progress' AND end_date < v_now)
      );

    -- 5. ORG GROWTH (New Clients this month)
    SELECT COUNT(*) INTO v_team_size FROM public.profiles WHERE organization_id = v_org_id AND status = 'active';

    RETURN jsonb_build_object(
        'revenue', jsonb_build_object(
            'current_month', v_monthly_revenue,
            'prev_month', v_prev_month_revenue,
            'growth', ROUND(v_revenue_growth, 2)
        ),
        'sales', jsonb_build_object(
            'conversion_rate', ROUND(v_conversion_rate, 2),
            'total_leads', v_total_leads,
            'converted_leads', v_converted_leads
        ),
        'billing', jsonb_build_object(
            'overdue_count', v_overdue_invoices_count,
            'overdue_amount', v_overdue_amount
        ),
        'projects', jsonb_build_object(
            'total', v_total_projects,
            'at_risk', v_at_risk_projects,
            'risk_percentage', CASE WHEN v_total_projects > 0 THEN ROUND((v_at_risk_projects::DECIMAL / v_total_projects) * 100, 2) ELSE 0 END
        ),
        'team', jsonb_build_object(
            'size', v_team_size
        )
    );
END;
$$;
