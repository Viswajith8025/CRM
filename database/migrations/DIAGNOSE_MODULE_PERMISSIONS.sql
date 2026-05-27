-- ==============================================================================
-- ANALYSIS: Module Permissions Sync
-- This will check if there are modules in module_registry that do NOT have
-- a corresponding permission in the permissions table.
-- ==============================================================================

-- 1. Let's see all modules in the registry and their required permissions
SELECT 
  name as module_name, 
  permission as required_permission,
  is_enabled
FROM public.module_registry
ORDER BY sort_order;

-- 2. Let's see what permissions actually exist in the permissions table
SELECT 
  code,
  module,
  name,
  type
FROM public.permissions
WHERE code LIKE 'module.%' OR type = 'module'
ORDER BY module;

-- 3. Check for any missing module permissions
SELECT 
  mr.name as missing_module_name,
  mr.permission as missing_permission_code
FROM public.module_registry mr
LEFT JOIN public.permissions p ON p.code = mr.permission
WHERE p.code IS NULL AND mr.is_enabled = true;
