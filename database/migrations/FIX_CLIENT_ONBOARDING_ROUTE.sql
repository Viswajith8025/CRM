-- ==============================================================================
-- FIX: Client Onboarding Route
-- ==============================================================================

UPDATE public.module_registry
SET route = '/crm/onboarding'
WHERE key = 'forms';

NOTIFY pgrst, 'reload schema';
