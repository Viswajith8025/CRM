-- RELATIONAL HARDENING FOR WORKFORCE INTELLIGENCE
-- This script establishes the explicit links between tracking data and user profiles

-- 1. Link Work Sessions to Profiles
ALTER TABLE IF EXISTS public.work_sessions
DROP CONSTRAINT IF EXISTS work_sessions_user_id_profiles_fkey,
ADD CONSTRAINT work_sessions_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- 2. Link Break Sessions to Profiles
ALTER TABLE IF EXISTS public.break_sessions
DROP CONSTRAINT IF EXISTS break_sessions_user_id_profiles_fkey,
ADD CONSTRAINT break_sessions_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- 3. Link Daily Tasks to Profiles
ALTER TABLE IF EXISTS public.daily_tasks
DROP CONSTRAINT IF EXISTS daily_tasks_user_id_profiles_fkey,
ADD CONSTRAINT daily_tasks_user_id_profiles_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- 4. Re-grant permissions to ensure Postgrest can see these relationships
GRANT ALL ON TABLE public.work_sessions TO authenticated;
GRANT ALL ON TABLE public.profiles TO authenticated;
