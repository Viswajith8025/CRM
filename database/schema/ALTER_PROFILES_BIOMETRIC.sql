-- Add biometric_id column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS biometric_id VARCHAR(50);

-- Create an index to quickly lookup profiles by biometric_id
CREATE INDEX IF NOT EXISTS idx_profiles_biometric_id ON public.profiles(biometric_id);

-- Add a helpful comment
COMMENT ON COLUMN public.profiles.biometric_id IS 'Used to map the user to their eSSL/biometric device PIN';
