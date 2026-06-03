-- ==============================================================================
-- FIX: GRANT PERMISSIONS ON HR LEAVE TABLES
-- PostgREST returns 404 when the 'authenticated' role has no GRANT on the table
-- Run this in the Supabase SQL Editor
-- ==============================================================================

-- Grant schema usage (required for PostgREST to expose the tables)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant full permissions on all leave tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_request_actions TO authenticated;

-- Grant sequence usage for UUID generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Force a hard schema reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
