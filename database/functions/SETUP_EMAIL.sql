-- 1. Enable the HTTP extension (pg_net) to allow Supabase to make external API calls
create extension if not exists "pg_net";

-- 2. Create the secure email sending function
create or replace function public.send_email_via_resend(
  p_to_email text,
  p_subject text,
  p_html text,
  p_attachments jsonb default '[]'::jsonb
) returns void
language plpgsql security definer
as $$
declare
  request_id bigint;
begin
  -- This makes an HTTP POST request directly to Resend from the database
  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := '{"Authorization": "Bearer YOUR_RESEND_API_KEY", "Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'from', 'ECRAFTZ CRM <onboarding@resend.dev>',
      'to', jsonb_build_array(p_to_email),
      'subject', p_subject,
      'html', p_html,
      'attachments', p_attachments
    )
  ) into request_id;
end;
$$;

-- 3. Grant permission to authenticated users to use this function
grant execute on function public.send_email_via_resend to authenticated;
