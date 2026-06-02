-- SECURE RBAC: CUSTOM JWT CLAIMS INJECTION
-- This script ensures the user's role and organization ID are baked directly into the signed JWT token.
-- This prevents client-side manipulation (e.g. React DevTools hacking).

-- 1. Create a function to mirror the profile role to auth.users metadata
CREATE OR REPLACE FUNCTION sync_role_to_jwt()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the raw_app_meta_data which Supabase embeds into the JWT
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || 
      json_build_object(
        'role', COALESCE(NEW.role, 'employee'), 
        'organization_id', NEW.organization_id
      )::jsonb
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the profiles table
DROP TRIGGER IF EXISTS trg_sync_role_to_jwt ON profiles;
CREATE TRIGGER trg_sync_role_to_jwt
AFTER INSERT OR UPDATE OF role, organization_id ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_role_to_jwt();

-- ========================================================================================
-- RETROACTIVE MIGRATION: Update all existing users
-- Run this block once to sync existing profiles to auth.users
-- ========================================================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, role, organization_id FROM profiles LOOP
        UPDATE auth.users
        SET raw_app_meta_data = raw_app_meta_data || 
            json_build_object(
                'role', COALESCE(r.role, 'employee'), 
                'organization_id', r.organization_id
            )::jsonb
        WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
