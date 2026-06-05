-- ==========================================
-- FIX BREAK SESSIONS RPC & RLS VULNERABILITY
-- ==========================================
-- 1. Create a secure RPC for starting breaks to bypass insert RLS blocks
CREATE OR REPLACE FUNCTION handle_start_break(
    p_work_session_id UUID, 
    p_org_id UUID, 
    p_user_id UUID, 
    p_type TEXT
)
RETURNS JSON AS $$
DECLARE
    v_break_id UUID;
    v_break RECORD;
BEGIN
    -- Ensure the work session belongs to the user and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.work_sessions 
        WHERE id = p_work_session_id AND user_id = p_user_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Invalid or inactive work session.';
    END IF;

    -- Close any existing open break first (safety measure)
    UPDATE public.break_sessions
    SET end_time = now()
    WHERE work_session_id = p_work_session_id AND end_time IS NULL;

    -- Insert the new break session
    INSERT INTO public.break_sessions (work_session_id, organization_id, user_id, type)
    VALUES (p_work_session_id, p_org_id, p_user_id, p_type::break_type)
    RETURNING id INTO v_break_id;

    -- Return the inserted record
    SELECT * INTO v_break FROM public.break_sessions WHERE id = v_break_id;
    RETURN row_to_json(v_break);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure handle_end_break exists securely
CREATE OR REPLACE FUNCTION handle_end_break(p_break_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.break_sessions
    SET end_time = now()
    WHERE id = p_break_id AND end_time IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix standard RLS Policies just in case for select operations
ALTER TABLE public.break_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own break sessions" ON public.break_sessions;
CREATE POLICY "Users can manage their own break sessions"
    ON public.break_sessions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all break sessions" ON public.break_sessions;
CREATE POLICY "Admins can view all break sessions"
    ON public.break_sessions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND organization_id = public.break_sessions.organization_id
        )
    );

NOTIFY pgrst, 'reload schema';
