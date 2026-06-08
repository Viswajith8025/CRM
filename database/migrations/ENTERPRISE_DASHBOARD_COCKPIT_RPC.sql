-- ENTERPRISE DASHBOARD OPTIMIZATION: Unified Department Intelligence RPC
-- Addresses Audit Finding: "Dashboard Rendering: Widget data is aggressively fetched. A dashboard with 12 active widgets triggers 12 distinct Supabase queries. Recommendation: Long-term, introduce a unified RPC."

BEGIN;

CREATE OR REPLACE FUNCTION public.get_department_intelligence(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_departments JSONB;
    v_members JSONB;
    v_kpis JSONB;
    v_logs JSONB;
BEGIN
    -- 1. Fetch departments
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'slug', lower(slug),
            'description', COALESCE(description, ''),
            'leader_id', leader_id,
            'weekly_capacity', 40
        )
    ), '[]'::jsonb) INTO v_departments
    FROM public.departments
    WHERE organization_id = p_org_id;

    -- 2. Fetch department members with profile info
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'department_id', dm.department_id,
            'profile_id', dm.profile_id,
            'profile', jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'role', p.role,
                'avatar_url', p.avatar_url
            )
        )
    ), '[]'::jsonb) INTO v_members
    FROM public.department_members dm
    JOIN public.profiles p ON dm.profile_id = p.id
    WHERE dm.organization_id = p_org_id;

    -- 3. Fetch KPI definitions
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'department_id', department_id,
            'name', name,
            'current', COALESCE(current_value, 0),
            'target', COALESCE(target_value, 0),
            'unit', COALESCE(unit, '')
        )
    ), '[]'::jsonb) INTO v_kpis
    FROM public.department_kpis
    WHERE organization_id = p_org_id;

    -- 4. Fetch performance logs for the last 30 days
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', epl.id,
            'employee_id', epl.employee_id,
            'kpi_id', epl.kpi_id,
            'value', epl.value,
            'log_date', epl.log_date,
            'kpi', jsonb_build_object('code', k.code)
        )
    ), '[]'::jsonb) INTO v_logs
    FROM public.employee_performance_logs epl
    LEFT JOIN public.kpi_registry k ON epl.kpi_id = k.id
    WHERE epl.organization_id = p_org_id
      AND epl.log_date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY epl.log_date ASC;

    RETURN jsonb_build_object(
        'departments', v_departments,
        'members', v_members,
        'kpis', v_kpis,
        'logs', v_logs
    );
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
