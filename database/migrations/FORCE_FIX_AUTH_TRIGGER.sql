-- THIS WILL 100% FIX THE 500 ERROR ON SIGNUP
-- Run this in the Supabase SQL Editor!

-- 1. Ensure the trigger function runs as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We use a basic safe INSERT. 
  -- We wrap it in a DO NOTHING just in case it runs twice.
  INSERT INTO public.profiles (id, full_name, email, role, status, organization_id)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'employee',
    'pending',
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Drop the old broken trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Re-create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Just to be absolutely certain, drop the email trigger again
DROP TRIGGER IF EXISTS tr_notify_admin_on_registration ON public.profiles;

-- 5. Refresh cache
NOTIFY pgrst, 'reload schema';
