-- ==============================================================================
-- DIAGNOSTIC: Run this in Supabase SQL Editor to find the root cause
-- ==============================================================================

-- 1. Check what users exist in auth.users (all Supabase signups)
SELECT 
  id,
  email,
  created_at,
  raw_user_meta_data->>'full_name' AS full_name,
  raw_app_meta_data->>'role' AS app_role
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check what profiles exist and their statuses
SELECT 
  id,
  email,
  full_name,
  role,
  status,
  organization_id,
  created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 10;

-- 3. Find auth users that have NO matching profile (the invisible ones!)
SELECT 
  au.id,
  au.email,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- 4. Check if the trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
