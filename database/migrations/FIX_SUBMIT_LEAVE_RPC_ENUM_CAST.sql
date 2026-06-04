-- ==============================================================================
-- FIX: submit_leave_request RPC
--
-- Root cause:
--   The `status` column in `leave_requests` is typed as the
--   `leave_request_status` ENUM, not TEXT.  Assigning the bare string literal
--   'pending' causes:
--     "operator does not exist: text = leave_request_status"
--
-- Fix: cast every enum literal explicitly with ::leave_request_status
--      and return JSON so the frontend can consume it uniformly.
-- ==============================================================================

-- Drop existing overloaded versions first to avoid "not unique" errors
DO $$
DECLARE
    func_rec record;
BEGIN
    FOR func_rec IN 
        SELECT oid::regprocedure AS func_sig
        FROM pg_proc 
        WHERE proname = 'submit_leave_request' 
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_rec.func_sig || ' CASCADE;';
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.submit_leave_request(
  p_leave_type_id  UUID,
  p_start_date     DATE,
  p_end_date       DATE,
  p_reason         TEXT,
  p_is_emergency   BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID;
  v_org_id           UUID;
  v_new_request_id   UUID;
BEGIN
  -- ── Auth guard ────────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: You must be logged in to submit a leave request.';
  END IF;

  -- ── Org lookup ────────────────────────────────────────────────────────────
  SELECT organization_id INTO v_org_id
  FROM   public.profiles
  WHERE  id = v_user_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_ERROR: Your account is not linked to an organisation.';
  END IF;

  -- ── Date validation ───────────────────────────────────────────────────────
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: End date cannot be before start date.';
  END IF;

  -- ── Insert ────────────────────────────────────────────────────────────────
  -- NOTE: status is cast explicitly to the leave_request_status ENUM.
  -- Without the cast PostgreSQL cannot resolve the = operator between
  -- the text literal and the enum column.
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
    'pending'::leave_request_status   -- ← explicit enum cast
  )
  RETURNING id INTO v_new_request_id;

  -- ── Audit log ─────────────────────────────────────────────────────────────
  INSERT INTO public.leave_request_actions (
    leave_request_id,
    actor_id,
    action,
    note
  ) VALUES (
    v_new_request_id,
    v_user_id,
    'submitted',
    'Leave request submitted by employee.'
  );

  -- ── Return ────────────────────────────────────────────────────────────────
  RETURN json_build_object(
    'success', true,
    'id',      v_new_request_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error',   SQLERRM
    );
END;
$$;

-- Grant execution to authenticated users only
REVOKE ALL ON FUNCTION public.submit_leave_request(UUID, DATE, DATE, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_leave_request(UUID, DATE, DATE, TEXT, BOOLEAN) TO authenticated;

-- Force PostgREST to pick up the new function signature immediately
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
