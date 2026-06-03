-- ==============================================================================
-- BYPASS SCHEMA CACHE: RPC function for leave submission
-- This bypasses PostgREST table schema cache completely
-- Run in Supabase SQL Editor
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
  v_new_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user's organization
  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE id = v_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found for user';
  END IF;

  -- Insert leave request
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
  RETURNING id INTO v_new_id;

  RETURN json_build_object('id', v_new_id, 'status', 'pending');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.submit_leave_request TO authenticated;

NOTIFY pgrst, 'reload schema';
