-- DIAGNOSTIC: Check project data state
SELECT id, name, organization_id, is_archived, deleted_at 
FROM public.projects 
LIMIT 10;

-- Check organization context
SELECT id, name FROM public.organizations;

-- Check current user profile
SELECT id, organization_id, role FROM public.profiles WHERE id = auth.uid();
