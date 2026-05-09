-- ==============================================================================
-- FIX: Sync organization_id and role into auth.users raw_app_meta_data
-- Run this in Supabase SQL Editor when users get organization_id = 00000000-0000-0000-0000-000000000000
-- ==============================================================================

-- Step 1: Show which users need fixing (those with wrong or missing org in JWT)
SELECT 
  au.id,
  au.email,
  p.organization_id AS profile_org_id,
  p.role AS profile_role,
  au.raw_app_meta_data->>'organization_id' AS jwt_org_id,
  au.raw_app_meta_data->>'role' AS jwt_role
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE 
  au.raw_app_meta_data->>'organization_id' IS NULL
  OR au.raw_app_meta_data->>'organization_id' = '00000000-0000-0000-0000-000000000000'
  OR au.raw_app_meta_data->>'organization_id' != p.organization_id::text;

-- ==============================================================================
-- Step 2: Fix all users — sync profile data into JWT metadata
-- ==============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id, p.organization_id, p.role
    FROM public.profiles p
    WHERE p.organization_id IS NOT NULL
      AND p.organization_id::text != '00000000-0000-0000-0000-000000000000'
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'organization_id', r.organization_id,
        'role', r.role
      )
    WHERE id = r.id;
  END LOOP;
  
  RAISE NOTICE 'Done — synced % profiles to auth.users JWT metadata', (SELECT count(*) FROM public.profiles WHERE organization_id IS NOT NULL);
END;
$$;

-- Step 3: Verify the fix
SELECT 
  au.email,
  au.raw_app_meta_data->>'organization_id' AS jwt_org_id,
  au.raw_app_meta_data->>'role' AS jwt_role,
  p.organization_id AS profile_org_id,
  p.role AS profile_role,
  CASE 
    WHEN au.raw_app_meta_data->>'organization_id' = p.organization_id::text THEN '✅ SYNCED'
    ELSE '❌ MISMATCH'
  END AS sync_status
FROM auth.users au
JOIN public.profiles p ON p.id = au.id
ORDER BY sync_status DESC;
