-- ==============================================================================
-- FIX: ADD 'archived' STATUS TO ENUM
-- Resolves error: invalid input value for enum user_status: "archived"
-- ==============================================================================

-- Safely add 'archived' to the user_status enum
-- The IF NOT EXISTS ensures it doesn't fail if you run it multiple times
ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS 'archived';

-- Hard reload for the API cache so PostgREST recognizes the new enum value immediately
NOTIFY pgrst, 'reload schema';
