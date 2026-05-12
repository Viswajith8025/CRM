-- ==============================================================================
-- ADMIN APPROVAL NOTIFICATION SYSTEM
-- ==============================================================================
-- This script ensures that an administrator is notified via email
-- whenever a new user registers and is waiting for approval.

-- 1. CLEANUP: Drop all versions of the email function to resolve "not unique" error
DROP FUNCTION IF EXISTS public.send_email_via_resend(text, text, text);
DROP FUNCTION IF EXISTS public.send_email_via_resend(text, text, text, jsonb);

-- 2. CREATE: Secure email sending function (Requires RESEND_API_KEY)
CREATE OR REPLACE FUNCTION public.send_email_via_resend(
  p_to_email text,
  p_subject text,
  p_html text,
  p_attachments jsonb default '[]'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  request_id bigint;
  resend_key text := 'YOUR_RESEND_API_KEY'; -- <--- REPLACE THIS WITH YOUR ACTUAL KEY
BEGIN
  -- Prevent sending if key is still placeholder
  IF resend_key = 'YOUR_RESEND_API_KEY' THEN
    RAISE WARNING 'Resend API key is not configured. Email to % skipped.', p_to_email;
    RETURN;
  END IF;

  SELECT net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', 'Vibe CRM <onboarding@resend.dev>',
      'to', jsonb_build_array(p_to_email),
      'subject', p_subject,
      'html', p_html,
      'attachments', p_attachments
    )
  ) INTO request_id;
END;
$$;

-- 3. CREATE: Function to notify admins
CREATE OR REPLACE FUNCTION public.notify_admins_of_new_registration()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_record RECORD;
    v_html_body TEXT;
BEGIN
    -- Construct the email body
    v_html_body := '
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">New User Registration</h2>
            <p>A new user has registered and is waiting for your approval:</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p><strong>Name:</strong> ' || COALESCE(NEW.full_name, 'New User') || '</p>
            <p><strong>Email:</strong> ' || NEW.email || '</p>
            <p><strong>Registered At:</strong> ' || NOW()::text || '</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p>Please log in to the dashboard to approve or deny this request.</p>
            <a href="https://your-crm-link.com/admin/settings" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Review User</a>
        </div>
    ';

    -- Notify all admins in the same organization
    FOR v_admin_record IN 
        SELECT email FROM public.profiles 
        WHERE organization_id = NEW.organization_id 
        AND role IN ('admin', 'super_admin')
        AND email IS NOT NULL
    LOOP
        PERFORM public.send_email_via_resend(
            v_admin_record.email,
            'Action Required: New User Waiting for Approval',
            v_html_body
        );
    END LOOP;

    -- Also notify via internal notification table
    FOR v_admin_record IN 
        SELECT id FROM public.profiles 
        WHERE organization_id = NEW.organization_id 
        AND role IN ('admin', 'super_admin')
    LOOP
        INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
        VALUES (
            v_admin_record.id,
            NEW.organization_id,
            'New Registration',
            NEW.email || ' is waiting for approval.',
            'system',
            '/admin/settings'
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGER: Link to profiles table
DROP TRIGGER IF EXISTS tr_notify_admin_on_registration ON public.profiles;
CREATE TRIGGER tr_notify_admin_on_registration
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION public.notify_admins_of_new_registration();

-- 5. REFRESH CACHE
NOTIFY pgrst, 'reload schema';
