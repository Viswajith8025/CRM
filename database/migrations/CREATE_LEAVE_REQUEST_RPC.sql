-- ==============================================================================
-- CREATE LEAVE REQUEST RPC
-- This bypasses PostgREST RLS 404 issues by using a SECURITY DEFINER function
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
  v_new_request_id UUID;
BEGIN
  -- Get the calling user's ID and organization
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: You must be logged in to submit a leave request.';
  END IF;

  SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = v_user_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_ERROR: Your account is not linked to an organization yet.';
  END IF;

  -- Validate dates
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: End date cannot be before start date.';
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.submit_leave_request TO authenticated;

NOTIFY pgrst, 'reload schema';
