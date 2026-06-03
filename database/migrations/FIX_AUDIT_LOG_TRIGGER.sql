-- ==============================================================================
-- FIX: AUDIT_LOGS TRIGGER NULL ORGANIZATION_ID
-- The profiles update trigger writes to audit_logs without an org_id
-- when a denied/pending user (who has no org) gets reinstated.
-- ==============================================================================

-- Step 1: Find and recreate the trigger function safely
-- (We use CREATE OR REPLACE to patch without losing anything)

CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Resolve organization_id: prefer NEW row, then OLD row
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

  -- If still null, try to look it up from the acting user
  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
  END IF;

  -- Only log if we have an org_id (skip orphaned profile changes)
  IF v_org_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      organization_id,
      actor_id,
      action,
      table_name,
      record_id,
      old_value,
      new_value
    ) VALUES (
      v_org_id,
      auth.uid(),
      TG_OP,
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Step 2: Drop and recreate the trigger cleanly
DROP TRIGGER IF EXISTS trg_log_profile_changes ON public.profiles;

CREATE TRIGGER trg_log_profile_changes
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_profile_changes();

-- Notify PostgREST of schema changes
NOTIFY pgrst, 'reload schema';
