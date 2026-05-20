-- ==============================================================================
-- FIX: Link leave_requests to public.profiles for API Joins
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. Re-link user_id to public.profiles (instead of auth.users)
ALTER TABLE public.leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_user_id_fkey;

ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Re-link approver to public.profiles
ALTER TABLE public.leave_requests 
DROP CONSTRAINT IF EXISTS leave_requests_current_approver_id_fkey;

ALTER TABLE public.leave_requests 
ADD CONSTRAINT leave_requests_current_approver_id_fkey 
FOREIGN KEY (current_approver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Also fix leave_request_actions actor link
ALTER TABLE public.leave_request_actions
DROP CONSTRAINT IF EXISTS leave_request_actions_actor_id_fkey;

ALTER TABLE public.leave_request_actions
ADD CONSTRAINT leave_request_actions_actor_id_fkey
FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. Force API schema cache refresh
NOTIFY pgrst, 'reload schema';
