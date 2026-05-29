-- ==============================================================================
-- FIX: LEAVE OVERLAP PREVENTION & TASK DEPENDENCY ENFORCEMENT
-- ==============================================================================
-- QA Audit Fixes: RISK-001 and RISK-005
-- Run this migration in Supabase SQL Editor.
-- ==============================================================================

-- ==============================================================================
-- RISK-005 FIX: Replace submit_leave_request with overlap-aware version
-- ==============================================================================
-- A user could previously submit overlapping leave requests (e.g., Jan 1-5 then Jan 3-7)
-- because the RPC had no date range overlap check.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.submit_leave_request(
  p_leave_type_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_reason TEXT,
  p_is_emergency BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_overlap_count INTEGER;
  v_new_request_id UUID;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: You must be logged in to submit a leave request.';
  END IF;

  SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = v_user_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_ERROR: Your account is not linked to an organization yet.';
  END IF;

  -- Date sanity check
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: End date cannot be before start date.';
  END IF;

  -- RISK-005 FIX: Overlap check — prevent duplicate/overlapping leave requests
  SELECT COUNT(*) INTO v_overlap_count
  FROM public.leave_requests
  WHERE user_id = v_user_id
    AND status IN ('pending', 'approved')
    AND deleted_at IS NULL
    AND (p_start_date, p_end_date + INTERVAL '1 day') OVERLAPS (start_date, end_date + INTERVAL '1 day');

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'OVERLAP_ERROR: You already have a pending or approved leave request that overlaps with these dates.';
  END IF;

  -- Insert the leave request
  INSERT INTO public.leave_requests (
    organization_id,
    user_id,
    leave_type_id,
    start_date,
    end_date,
    reason,
    is_emergency,
    status
  ) VALUES (
    v_org_id,
    v_user_id,
    p_leave_type_id,
    p_start_date,
    p_end_date,
    p_reason,
    p_is_emergency,
    'pending'
  )
  RETURNING id INTO v_new_request_id;

  RETURN json_build_object(
    'success', true,
    'id', v_new_request_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_leave_request TO authenticated;

-- ==============================================================================
-- RISK-001 FIX: Task Dependency Enforcement at the Database Level
-- ==============================================================================
-- Previously, dependency enforcement was frontend-only. A direct API call (Postman, etc.)
-- could mark a task 'done' even if its dependencies were incomplete.
-- This trigger blocks that at the PostgreSQL layer.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enforce_task_dependencies()
RETURNS TRIGGER AS $$
DECLARE
  v_unresolved_count INTEGER;
  v_unresolved_title TEXT;
BEGIN
  -- Only run when status is being changed TO 'done'
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    
    SELECT COUNT(*), MIN(t.title)
    INTO v_unresolved_count, v_unresolved_title
    FROM public.task_dependencies td
    JOIN public.tasks t ON t.id = td.depends_on_task_id
    WHERE td.task_id = NEW.id
      AND t.status NOT IN ('done', 'completed');

    IF v_unresolved_count > 0 THEN
      RAISE EXCEPTION 'DEPENDENCY_ERROR: Cannot mark task as done. It is blocked by: "%". Resolve all dependencies first.',
        v_unresolved_title;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to tasks table
DROP TRIGGER IF EXISTS enforce_task_dependencies_before_done ON public.tasks;
CREATE TRIGGER enforce_task_dependencies_before_done
BEFORE UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_task_dependencies();

-- ==============================================================================
-- PERFORMANCE FIX: Partial indexes on deleted_at for high-frequency queries
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_active_org
  ON public.tasks(organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_search_title
  ON public.tasks USING gin(to_tsvector('english', title))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_active_org
  ON public.projects(organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leads_active_org
  ON public.leads(organization_id)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
