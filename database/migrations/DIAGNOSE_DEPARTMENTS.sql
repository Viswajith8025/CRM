-- ==============================================================================
-- DIAGNOSTIC: Run this FIRST to see the current state
-- ==============================================================================

-- 1. What org IDs exist?
SELECT 'organizations' as tbl, id, name FROM organizations;

-- 2. What's in your profile?
SELECT 'profile' as tbl, id, full_name, organization_id FROM profiles WHERE id = auth.uid();

-- 3. What departments exist?
SELECT 'departments' as tbl, id, name, slug, organization_id FROM departments;

-- 4. Do they match?
SELECT 
  p.organization_id as profile_org_id,
  d.organization_id as dept_org_id,
  d.name as dept_name,
  (p.organization_id = d.organization_id) as match
FROM profiles p
CROSS JOIN departments d
WHERE p.id = auth.uid();
