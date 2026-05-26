-- ==============================================================================
-- CLEANUP: Remove unintended modules and rename Forms to Client Onboarding
-- ==============================================================================

-- 1. Remove the unintended modules from module_registry
DELETE FROM public.module_registry 
WHERE key IN ('automation', 'workforce', 'client_portal');

-- 2. Remove the unintended permissions
DELETE FROM public.permissions 
WHERE module IN ('Automation', 'Workforce', 'Client Portal') 
   OR code IN ('module.automation', 'module.workforce', 'module.client_portal');

-- 3. Rename Forms to Client Onboarding in module_registry
UPDATE public.module_registry
SET name = 'Client Onboarding',
    icon = 'ClipboardList',
    route = '/forms'
WHERE key = 'forms';

-- 4. Rename Forms module in permissions table
UPDATE public.permissions
SET name = 'Client Onboarding Module',
    description = 'Access to client onboarding and dynamic forms.',
    module = 'Client Onboarding'
WHERE code = 'module.forms';

UPDATE public.permissions
SET module = 'Client Onboarding'
WHERE code LIKE 'forms.%';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
