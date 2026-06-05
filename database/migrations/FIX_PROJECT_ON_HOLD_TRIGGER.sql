-- ==============================================================================
-- FIX PROJECT DELAY NOTIFICATION TRIGGER
-- Run this in your Supabase SQL Editor
-- This fixes the 400 Bad Request error when moving a project to "On Hold"
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.notify_project_delay()
RETURNS TRIGGER AS $$
DECLARE
    v_recipient_id UUID;
BEGIN
    -- Use 'on_hold' as project_status enum doesn't have 'delayed'
    IF (OLD.status::text IS DISTINCT FROM NEW.status::text AND NEW.status::text = 'on_hold') THEN
        
        -- Try to find the project lead first
        SELECT user_id INTO v_recipient_id 
        FROM public.project_members 
        WHERE project_id = NEW.id AND role = 'lead'
        LIMIT 1;

        -- If no lead, fallback to anyone who created the project (if created_by exists)
        -- Otherwise just get any admin in the organization
        IF v_recipient_id IS NULL THEN
            SELECT id INTO v_recipient_id 
            FROM public.profiles 
            WHERE organization_id = NEW.organization_id AND role IN ('admin', 'super_admin')
            LIMIT 1;
        END IF;

        IF v_recipient_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
            VALUES (
                v_recipient_id, 
                NEW.organization_id, 
                'Project On Hold', 
                'Project "' || NEW.name || '" status has been changed to On Hold.', 
                'project', 
                '/projects/' || NEW.id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-register just in case
DROP TRIGGER IF EXISTS tr_notify_project_delay ON public.projects;
CREATE TRIGGER tr_notify_project_delay 
    AFTER UPDATE ON public.projects 
    FOR EACH ROW EXECUTE FUNCTION public.notify_project_delay();

NOTIFY pgrst, 'reload schema';
