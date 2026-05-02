SELECT 
  created_at, 
  action, 
  target_type, 
  target_name, 
  user_id
FROM activities
ORDER BY created_at DESC
LIMIT 50;

-- Deep Ownership Check
SELECT 'tasks' as table, count(*) as total, count(*) filter (where user_id is null) as null_user, count(*) filter (where organization_id is null) as null_org FROM tasks
UNION ALL
SELECT 'projects', count(*), count(*) filter (where user_id is null), count(*) filter (where organization_id is null) FROM projects
UNION ALL
SELECT 'leads', count(*), count(*) filter (where user_id is null), count(*) filter (where organization_id is null) FROM leads;

-- Check if current user actually exists in profiles
SELECT id, full_name, role FROM profiles WHERE id = auth.uid();
