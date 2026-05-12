-- Fix for the Notification Engine Trigger Error
-- The unified trigger caused type-casting errors and missing column errors across different tables.

-- 1. DROP the problematic triggers
DROP TRIGGER IF EXISTS tr_notify_task_assignment ON public.tasks;
DROP TRIGGER IF EXISTS tr_notify_proposal_approval ON public.proposals;
DROP TRIGGER IF EXISTS tr_notify_payment_verified ON public.payments;
DROP TRIGGER IF EXISTS tr_notify_project_delay ON public.projects;

-- 2. CREATE specific functions for each table to avoid type/column mismatches
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if assignee changed and is not null
    IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
        INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
        VALUES (
            NEW.assigned_to, 
            NEW.organization_id, 
            'New Task Assigned', 
            'You have been assigned to: ' || NEW.title, 
            'assignment', 
            '/tasks'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_proposal_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Use text cast to avoid enum type errors
    IF (OLD.status::text IS DISTINCT FROM NEW.status::text AND NEW.status::text = 'approved') THEN
        INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
        VALUES (
            NEW.user_id, 
            NEW.organization_id, 
            'Proposal Approved', 
            'Your proposal "' || coalesce(NEW.title, '') || '" has been approved.', 
            'billing', 
            '/billing'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_payment_verified()
RETURNS TRIGGER AS $$
DECLARE
    v_recipient_id UUID;
BEGIN
    -- Use text cast to avoid enum type errors
    IF (TG_OP = 'INSERT' AND NEW.status::text = 'verified') OR (TG_OP = 'UPDATE' AND OLD.status::text IS DISTINCT FROM NEW.status::text AND NEW.status::text = 'verified') THEN
        FOR v_recipient_id IN SELECT id FROM public.profiles WHERE organization_id = NEW.organization_id AND role IN ('admin', 'super_admin') LOOP
            INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
            VALUES (
                v_recipient_id, 
                NEW.organization_id, 
                'Payment Verified', 
                'A payment of ' || NEW.amount || ' for invoice ' || NEW.invoice_id || ' has been verified.', 
                'billing', 
                '/billing'
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_project_delay()
RETURNS TRIGGER AS $$
BEGIN
    -- Use 'on_hold' as project_status enum doesn't have 'delayed'
    IF (OLD.status::text IS DISTINCT FROM NEW.status::text AND NEW.status::text = 'on_hold') THEN
        INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
        VALUES (
            NEW.user_id, 
            NEW.organization_id, 
            'Project On Hold', 
            'Project "' || NEW.name || '" status has been changed to On Hold.', 
            'project', 
            '/projects/' || NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RE-REGISTER TRIGGERS WITH SPECIFIC FUNCTIONS
CREATE TRIGGER tr_notify_task_assignment 
    AFTER UPDATE ON public.tasks 
    FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

CREATE TRIGGER tr_notify_proposal_approval 
    AFTER UPDATE ON public.proposals 
    FOR EACH ROW EXECUTE FUNCTION public.notify_proposal_approval();

CREATE TRIGGER tr_notify_payment_verified 
    AFTER INSERT OR UPDATE ON public.payments 
    FOR EACH ROW EXECUTE FUNCTION public.notify_payment_verified();

CREATE TRIGGER tr_notify_project_delay 
    AFTER UPDATE ON public.projects 
    FOR EACH ROW EXECUTE FUNCTION public.notify_project_delay();

-- 4. CLEANUP OLD UNIFIED FUNCTION
DROP FUNCTION IF EXISTS public.notify_on_event();

NOTIFY pgrst, 'reload schema';
