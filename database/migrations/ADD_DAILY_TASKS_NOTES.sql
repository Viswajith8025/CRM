-- Add notes column to daily_tasks
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS notes text;
