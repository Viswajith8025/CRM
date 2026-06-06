-- ==============================================================================
-- ECRAFTZ CRM - FIX LEAVE REQUESTS 400 BAD REQUEST ERROR
-- Run this in: Supabase Dashboard → SQL Editor
-- ==============================================================================

-- Problem: The database has TWO triggers handling leave balances on `leave_requests`.
-- 1. `trg_leave_balance_update` (which calls `handle_leave_balance_update`) -> The NEW, correct trigger.
-- 2. `trigger_leave_balance_deduction` (which calls `process_leave_balance_deduction`) -> The OLD, broken trigger.
--
-- The old trigger tries to update a column called `used_days` on the `leave_balances` table.
-- That column does not exist (it's called `used`), so when an HR admin tries to approve or reject a leave,
-- Postgres throws "column used_days does not exist". This bubbles up as a 400 Bad Request to the frontend.

BEGIN;

-- Drop the broken trigger
DROP TRIGGER IF EXISTS trigger_leave_balance_deduction ON public.leave_requests;

-- Drop the broken function
DROP FUNCTION IF EXISTS public.process_leave_balance_deduction() CASCADE;

COMMIT;

-- Reload schema cache just in case
NOTIFY pgrst, 'reload schema';
