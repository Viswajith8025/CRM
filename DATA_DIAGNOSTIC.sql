-- ==============================================================================
-- CRM DATA DIAGNOSTIC & RECOVERY SCRIPT
-- ==============================================================================
-- Run this in the Supabase SQL Editor to check if your data is still present.
-- ==============================================================================

-- 1. TEMPORARILY DISABLE RLS TO SEE ALL DATA
-- If data appears after running this, the issue is purely with security policies.
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- 2. DATA COUNTS (Check if tables are empty)
SELECT 'profiles' as table_name, count(*) as row_count FROM profiles
UNION ALL SELECT 'leads', count(*) FROM leads
UNION ALL SELECT 'clients', count(*) FROM clients
UNION ALL SELECT 'projects', count(*) FROM projects
UNION ALL SELECT 'tasks', count(*) FROM tasks
UNION ALL SELECT 'invoices', count(*) FROM invoices
UNION ALL SELECT 'payments', count(*) FROM payments;

-- 3. CHECK FOR "ORPHANED" DATA (Missing User ID or Org ID)
-- This will help us identify if the data needs to be "adopted" by your current user.
SELECT 
  'leads' as table_name, 
  count(*) filter (where user_id is null) as missing_user_id,
  count(*) filter (where organization_id is null) as missing_org_id
FROM leads
UNION ALL
SELECT 
  'projects', 
  count(*) filter (where user_id is null),
  count(*) filter (where organization_id is null)
FROM projects
UNION ALL
SELECT 
  'invoices', 
  count(*) filter (where user_id is null),
  count(*) filter (where organization_id is null)
FROM invoices;

-- 4. ADOPT ORPHANED DATA (Run this only if missing_user_id or missing_org_id is > 0)
-- Replace 'YOUR_USER_ID' and 'YOUR_ORG_ID' with your actual IDs if needed, 
-- or use the logic below to auto-adopt to the first admin found.
/*
DO $$ 
DECLARE 
  target_user_id UUID;
  target_org_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  SELECT id INTO target_user_id FROM profiles WHERE role = 'admin' LIMIT 1;
  
  IF target_user_id IS NOT NULL THEN
    UPDATE leads SET user_id = target_user_id WHERE user_id IS NULL;
    UPDATE projects SET user_id = target_user_id WHERE user_id IS NULL;
    UPDATE invoices SET user_id = target_user_id WHERE user_id IS NULL;
    UPDATE tasks SET user_id = target_user_id WHERE user_id IS NULL;
    
    UPDATE leads SET organization_id = target_org_id WHERE organization_id IS NULL;
    UPDATE projects SET organization_id = target_org_id WHERE organization_id IS NULL;
    UPDATE invoices SET organization_id = target_org_id WHERE organization_id IS NULL;
    UPDATE tasks SET organization_id = target_org_id WHERE organization_id IS NULL;
  END IF;
END $$;
*/

-- 5. RE-ENABLE RLS (After checking the counts)
-- Only run these once you've confirmed if the data exists.
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ... (rest of the tables)
