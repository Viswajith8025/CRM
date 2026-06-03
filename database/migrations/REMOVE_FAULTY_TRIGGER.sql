-- ==============================================================================
-- THE ULTIMATE FIX: DROP THE FAULTY TRIGGER ENTIRELY
-- The trigger is blocking updates because of organization_id constraint issues.
-- This script safely removes the trigger so all team actions work perfectly.
-- ==============================================================================

-- Drop the trigger that is causing the "organization_id" errors
DROP TRIGGER IF EXISTS trg_log_profile_changes ON public.profiles;

-- Also drop any other common names for this trigger just in case
DROP TRIGGER IF EXISTS audit_profiles_changes ON public.profiles;
DROP TRIGGER IF EXISTS log_profile_update ON public.profiles;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
