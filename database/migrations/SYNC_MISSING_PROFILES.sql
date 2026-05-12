-- ==============================================================================
-- DATABASE RECOVERY: SYNC MISSING PROFILES
-- ==============================================================================
-- This script finds users in auth.users who are missing a record in public.profiles
-- and creates their profiles. This fixes cases where the signup trigger failed.

DO $$
DECLARE
    default_org_id UUID := '00000000-0000-0000-0000-000000000000';
    user_record RECORD;
BEGIN
    -- 1. Ensure the default organization exists
    INSERT INTO public.organization_settings (id, company_name)
    VALUES (default_org_id, 'Vibe CRM')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Find and fix missing profiles
    FOR user_record IN 
        SELECT id, email, raw_user_meta_data 
        FROM auth.users 
        WHERE id NOT IN (SELECT id FROM public.profiles)
    LOOP
        INSERT INTO public.profiles (
            id, 
            full_name, 
            email, 
            avatar_url, 
            role, 
            status, 
            organization_id,
            created_at
        )
        VALUES (
            user_record.id,
            COALESCE(user_record.raw_user_meta_data->>'full_name', split_part(user_record.email, '@', 1)),
            user_record.email,
            user_record.raw_user_meta_data->>'avatar_url',
            'employee',
            'pending',
            default_org_id,
            NOW()
        );
        
        RAISE NOTICE 'Created profile for user: %', user_record.email;
    END LOOP;
END $$;

-- Refresh cache
NOTIFY pgrst, 'reload schema';
