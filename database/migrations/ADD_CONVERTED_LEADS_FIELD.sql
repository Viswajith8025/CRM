-- Adds the leads_converted_today field to bde_daily_reports for evening reports
ALTER TABLE public.bde_daily_reports 
ADD COLUMN IF NOT EXISTS leads_converted_today INT DEFAULT 0;

-- Update existing rows to have 0 if they don't already
UPDATE public.bde_daily_reports 
SET leads_converted_today = 0 
WHERE leads_converted_today IS NULL;
