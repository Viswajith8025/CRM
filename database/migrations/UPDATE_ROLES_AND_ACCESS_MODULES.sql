-- ==============================================================================
-- UPDATE ROLES & ACCESS MODULES (CLEANUP & SYNC)
-- Run this in your Supabase SQL Editor
-- This migration synchronizes the "Roles & Access" database table with the 
-- actual active modules in the CRM, removing dead/inactive modules.
-- ==============================================================================

-- 1. CLEANUP: Delete inactive modules from the sidebar registry
DELETE FROM public.module_registry 
WHERE key IN (
  'documents',  -- Removed: Document Vault
  'support',    -- Removed: Support Desk
  'timedesk'    -- Merged: Time desk settings merged into general settings
);

-- Ensure Time Monitor points to the correct permission as defined in App.tsx
UPDATE public.module_registry 
SET permission = 'module.admin' 
WHERE key = 'monitor';


-- 2. CLEANUP: Delete inactive permissions from the Roles & Access UI
-- This automatically cascades and removes these checkboxes from role_permissions
DELETE FROM public.permissions
WHERE code IN (
  'module.documents',
  'documents.view',
  'documents.upload',
  'documents.delete',
  
  'module.support',
  
  'module.time_monitor',
  'admin.timedesk.manage'
);


-- 3. ADD/UPDATE: Ensure new active modules like Leave Approvals & Client Onboarding are properly registered
-- Add Leave Approvals to the Sidebar Registry if missing
INSERT INTO public.module_registry (key, name, icon, route, category, sort_order, permission)
VALUES
  ('leave_approvals', 'Leave Approvals', 'CheckSquare', '/leave-approvals', 'top', 10, 'leave.approval.view')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  category = EXCLUDED.category,
  permission = EXCLUDED.permission;

-- Ensure Client Onboarding uses the correct route and permission
UPDATE public.module_registry
SET route = '/crm/onboarding',
    permission = 'module.forms',
    name = 'Client Onboarding'
WHERE key = 'forms';


-- 4. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
