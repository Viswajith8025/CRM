-- ==============================================================================
-- EMERGENCY REPAIR: Fix pending user registration pipeline
-- Run in Supabase SQL Editor
-- ==============================================================================

-- STEP 1: Fix handle_new_user to use SECURITY DEFINER (bypasses RLS during trigger)
-- This is the most common silent failure — the trigger runs as the new user
-- who has no profile yet, so RLS blocks the INSERT into profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER                    -- <-- critical: runs as postgres, not as the new user
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, status, organization_id)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'employee',
    'pending',
    NULL   -- No org until admin approves and assigns
  )
  ON CONFLICT (id) DO NOTHING;   -- Don't overwrite if profile already exists
  RETURN NEW;
END;
$$;

-- STEP 2: Backfill — create profiles for any auth users that have no profile row yet
-- This fixes the two users who already registered before the trigger was correct
INSERT INTO public.profiles (id, full_name, email, role, status, organization_id)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1)
  ),
  au.email,
  'employee',
  'pending',
  NULL
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL  -- Only users with no profile row
ON CONFLICT (id) DO NOTHING;

-- STEP 3: Fix the RLS policy so super_admin sees ALL profiles (including NULL org)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Always see yourself
    id = auth.uid()
    OR
    -- Super admin sees EVERYTHING — including pending users with no org
    (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'super_admin'
    OR
    -- Admin sees all within their org
    (
      (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'admin'
      AND organization_id = (
        nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id', '')::uuid
      )
    )
    OR
    -- All other roles: only see their org
    organization_id = (
      nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id', '')::uuid
    )
  );

-- STEP 4: Also add INSERT policy so the trigger can insert new profiles
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- STEP 5: Verify the repair worked — run this after to confirm
SELECT id, email, full_name, status, organization_id, created_at
FROM public.profiles
WHERE status = 'pending'
ORDER BY created_at DESC;

NOTIFY pgrst, 'reload schema';
