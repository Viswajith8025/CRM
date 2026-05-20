-- Migration to add flagging and admin notes to work sessions
ALTER TABLE public.work_sessions 
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Update RLS to allow admins to update work sessions
DROP POLICY IF EXISTS "Admins can update work sessions" ON public.work_sessions;
CREATE POLICY "Admins can update work sessions"
    ON public.work_sessions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND organization_id = public.work_sessions.organization_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND organization_id = public.work_sessions.organization_id
        )
    );
