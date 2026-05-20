-- ==============================================================================
-- ENTERPRISE MULTI-TENANCY SECURITY HARDENING
-- ==============================================================================
-- This script secures all SECURITY DEFINER functions to prevent 
-- cross-tenant data leakage by enforcing organization validation.

-- 1. SECURITY VALIDATION HELPER
-- Ensures that the p_org_id parameter matches the user's actual organization.
CREATE OR REPLACE FUNCTION public.validate_org_access(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_org_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND organization_id = p_org_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. HARDEN DASHBOARD SUMMARY RPC
CREATE OR REPLACE FUNCTION public.get_dashboard_summary_kpis(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- SECURITY CHECK: Prevent cross-tenant lookup
    IF NOT public.validate_org_access(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized: Multi-tenant security violation detected.';
    END IF;

    WITH stats AS (
        SELECT
            (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE organization_id = p_org_id AND status = 'paid') as revenue,
            (SELECT COUNT(*) FROM projects WHERE organization_id = p_org_id AND status = 'in_progress' AND deleted_at IS NULL) as active_projects,
            (SELECT COUNT(*) FROM tasks WHERE organization_id = p_org_id AND status != 'done' AND due_date < CURRENT_DATE AND deleted_at IS NULL) as overdue_tasks,
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

-- 3. HARDEN PROJECT HEALTH RPC
CREATE OR REPLACE FUNCTION public.get_project_health_kpis(p_org_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (id UUID, name TEXT, progress INT, total_tasks INT, completed_tasks INT, status TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- SECURITY CHECK
    IF NOT public.validate_org_access(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized organization access.';
    END IF;

    RETURN QUERY
    SELECT 
        p.id::UUID, p.name::TEXT,
        CASE WHEN COUNT(t.id) = 0 THEN 0 ELSE ROUND((COUNT(t.id) FILTER (WHERE t.status = 'done')::DECIMAL / COUNT(t.id)) * 100)::INT END,
        COUNT(t.id)::INT, COUNT(t.id) FILTER (WHERE t.status = 'done')::INT, p.status::TEXT
    FROM projects p
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE p.organization_id = p_org_id AND p.status = 'in_progress' AND p.deleted_at IS NULL
    GROUP BY p.id, p.name, p.status
    ORDER BY p.updated_at DESC
    LIMIT p_limit;
END;
$$;

-- 4. HARDEN CRITICAL DEADLINES RPC
CREATE OR REPLACE FUNCTION public.get_critical_deadlines_kpis(p_org_id UUID, p_limit INT DEFAULT 4)
RETURNS TABLE (id UUID, title TEXT, due_date DATE, project_name TEXT, status TEXT, is_overdue BOOLEAN) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- SECURITY CHECK
    IF NOT public.validate_org_access(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized organization access.';
    END IF;

    RETURN QUERY
    SELECT 
        t.id::UUID, t.title::TEXT, t.due_date::DATE, p.name::TEXT, t.status::TEXT, (t.due_date < CURRENT_DATE)::BOOLEAN
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.organization_id = p_org_id AND t.status != 'done' AND t.due_date IS NOT NULL AND t.deleted_at IS NULL
    ORDER BY t.due_date ASC
    LIMIT p_limit;
END;
$$;

-- 5. NOTIFICATION INTEGRITY TRIGGER
-- Prevents cross-tenant notification injection even if RLS is bypassed.
CREATE OR REPLACE FUNCTION public.enforce_notification_tenant_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure the user being notified belongs to the organization specified
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = NEW.user_id 
          AND organization_id = NEW.organization_id
    ) THEN
        RAISE EXCEPTION 'Tenant Violation: User % does not belong to organization %', NEW.user_id, NEW.organization_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notifications_integrity ON notifications;
CREATE TRIGGER trg_notifications_integrity
    BEFORE INSERT OR UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_tenant_integrity();

-- 6. HARDEN ACTIVITY SUMMARY RPC
CREATE OR REPLACE FUNCTION public.get_recent_activity_summary(p_org_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (id UUID, actor_name TEXT, action_type TEXT, target_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- SECURITY CHECK
    IF NOT public.validate_org_access(p_org_id) THEN
        RAISE EXCEPTION 'Unauthorized organization access.';
    END IF;

    RETURN QUERY
    SELECT a.id, p.full_name, a.action, a.target_name, a.created_at
    FROM activities a
    LEFT JOIN profiles p ON p.id = a.user_id
    WHERE a.organization_id = p_org_id
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$;

NOTIFY pgrst, 'reload schema';
