-- Diagnostic script to check RLS visibility and Org alignment
SELECT 
  'Current User' as context,
  id, 
  email, 
  role, 
  organization_id 
FROM profiles 
WHERE id = auth.uid();

SELECT 
  'Projects Count (Direct)' as context,
  count(*) 
FROM projects;

SELECT 
  'Tasks Count (Direct)' as context,
  count(*) 
FROM tasks;

SELECT 
  'Projects with Org ID' as context,
  organization_id,
  count(*)
FROM projects
GROUP BY organization_id;
