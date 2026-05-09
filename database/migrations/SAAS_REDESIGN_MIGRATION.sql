-- ==============================================================================
-- SAAS PLATFORM ARCHITECTURE REDESIGN
-- Multi-Tenant Super Admin & Organization Governance
-- ==============================================================================

-- 1. EXTEND USER ROLES
-- Add super_admin role to the existing user_role enum
DO $$ 
BEGIN 
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin'; 
EXCEPTION 
  WHEN duplicate_object THEN null; 
END $$;

-- 2. ENHANCE ORGANIZATION SETTINGS (Treating as Organizations table)
ALTER TABLE organization_settings 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 3. RLS POLICIES FOR ORGANIZATION SETTINGS
-- Allow super_admin to read and update any organization
DROP POLICY IF EXISTS "Super admins can view all organizations" ON organization_settings;
CREATE POLICY "Super admins can view all organizations"
  ON organization_settings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'super_admin')
  );

DROP POLICY IF EXISTS "Super admins can update all organizations" ON organization_settings;
CREATE POLICY "Super admins can update all organizations"
  ON organization_settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'super_admin')
  );

-- 4. GLOBAL RLS BYPASS FOR SUPER ADMINS ON ALL MAJOR TABLES
-- (Using profiles table as an example to show cross-org visibility)
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role::text = 'super_admin')
  );

-- 5. SUSPENSION ENFORCEMENT
-- We enforce this via an RPC function that can be checked by the application layer
-- to block login/API access.

CREATE OR REPLACE FUNCTION public.check_org_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'status', os.status,
    'subscription_status', os.subscription_status
  )
  FROM profiles p
  JOIN organization_settings os ON p.organization_id = os.id
  WHERE p.id = auth.uid();
$$;
