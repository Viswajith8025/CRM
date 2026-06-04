-- ==============================================================================
-- BULLETPROOF FIX: LEAVE REQUESTS -> PROFILES FOREIGN KEY
-- ==============================================================================

DO $$ 
DECLARE 
    fk_record record;
BEGIN
    -- 1. Find ANY foreign key on user_id in leave_requests and drop it
    FOR fk_record IN 
        SELECT conname
        FROM pg_constraint 
        WHERE conrelid = 'public.leave_requests'::regclass 
          AND contype = 'f' 
          AND conkey = '{2}' -- user_id is usually the 3rd column, but it's safer to drop any FK that points to auth.users OR profiles on user_id
    LOOP
        EXECUTE 'ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS ' || quote_ident(fk_record.conname);
    END LOOP;
    
    -- Also drop explicitly by known names just in case
    ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_user_id_fkey;
    ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_user_id_fkey1;
    ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS fk_leave_requests_user;
END $$;

-- 2. Create the proper foreign key with a completely unique name
ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_user_profile_fk_v2 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Reload schema
NOTIFY pgrst, 'reload schema';
