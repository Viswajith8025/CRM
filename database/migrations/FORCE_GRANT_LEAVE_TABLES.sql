-- ==============================================================================
-- FORCE GRANT PREVILEGES TO LEAVE REQUESTS
-- ==============================================================================

-- Ensure roles can access the HR tables
GRANT ALL ON TABLE public.leave_types TO authenticated;
GRANT ALL ON TABLE public.leave_policies TO authenticated;
GRANT ALL ON TABLE public.leave_requests TO authenticated;
GRANT ALL ON TABLE public.leave_request_actions TO authenticated;
GRANT ALL ON TABLE public.leave_balances TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
