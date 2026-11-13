-- ==============================================================================
-- AUTH TRACKING: Simple Dedicated Registration & Login Tables
-- ==============================================================================
-- Run this ONCE in your Supabase SQL Editor.
-- These are lightweight, standalone tables. No joins. No complexity.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────
-- TABLE 1: user_registrations
-- One row per successful account creation.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_registrations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT,
  email         TEXT        NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant table access to both roles first (required by Supabase before RLS applies)
GRANT INSERT, SELECT ON public.user_registrations TO anon;
GRANT INSERT, SELECT ON public.user_registrations TO authenticated;

-- Enable Row Level Security
ALTER TABLE public.user_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (user is not yet logged in when they register)
DROP POLICY IF EXISTS "allow_registration_insert" ON public.user_registrations;
CREATE POLICY "allow_registration_insert"
  ON public.user_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Any authenticated user can read registration records
DROP POLICY IF EXISTS "allow_read_registrations" ON public.user_registrations;
CREATE POLICY "allow_read_registrations"
  ON public.user_registrations
  FOR SELECT
  TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────
-- TABLE 2: user_logins
-- One row per login attempt (success or failure).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_logins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL,
  success       BOOLEAN     NOT NULL DEFAULT false,
  error_message TEXT,
  logged_in_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Grant table access to both roles first
GRANT INSERT, SELECT ON public.user_logins TO anon;
GRANT INSERT, SELECT ON public.user_logins TO authenticated;

-- Enable Row Level Security
ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (user is not yet authenticated when logging in)
DROP POLICY IF EXISTS "allow_login_insert" ON public.user_logins;
CREATE POLICY "allow_login_insert"
  ON public.user_logins
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Any authenticated user can read login records
DROP POLICY IF EXISTS "allow_read_logins" ON public.user_logins;
CREATE POLICY "allow_read_logins"
  ON public.user_logins
  FOR SELECT
  TO authenticated
  USING (true);


-- ─────────────────────────────────────────────────────────────
-- INDEXES for fast email lookups
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_registrations_email ON public.user_registrations(email);
CREATE INDEX IF NOT EXISTS idx_user_logins_email        ON public.user_logins(email);
CREATE INDEX IF NOT EXISTS idx_user_logins_success      ON public.user_logins(success);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- DONE. Both tables are ready. No errors expected.
-- ==============================================================================
