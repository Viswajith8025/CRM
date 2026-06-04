-- ==============================================================================
-- BDE DAILY REPORT TABLE
-- For Business Development Executive daily reporting
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.bde_daily_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Section 1: Daily Activities
  total_calls_made INTEGER DEFAULT 0,
  meetings_scheduled INTEGER DEFAULT 0,
  meetings_completed INTEGER DEFAULT 0,
  followups_done INTEGER DEFAULT 0,

  -- Section 2: Lead Details
  lead_name TEXT,
  number_of_leads INTEGER DEFAULT 0,
  lead_source TEXT,
  lead_status TEXT,
  lead_remarks TEXT,

  -- Section 3: Sales Performance
  deals_closed INTEGER DEFAULT 0,
  revenue_generated NUMERIC(14,2) DEFAULT 0,
  pipeline_value NUMERIC(14,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,

  -- Section 4: Client Interaction
  new_clients_contacted INTEGER DEFAULT 0,
  existing_clients_followup INTEGER DEFAULT 0,
  key_discussion_points TEXT,

  -- Section 5: Referrals
  referrals_received INTEGER DEFAULT 0,

  -- Section 6: Challenges
  challenges_faced TEXT,

  -- Section 7: Competitor Insights
  competitor_insights TEXT,

  -- Section 8: Next Day Plan
  next_day_plan TEXT,

  -- Section 9: Manager Remarks
  manager_remarks TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One report per employee per day
  UNIQUE(employee_id, report_date)
);

-- RLS
ALTER TABLE public.bde_daily_reports ENABLE ROW LEVEL SECURITY;

-- Employee can fully manage their own reports
CREATE POLICY "bde_employee_manage_own" ON public.bde_daily_reports
  FOR ALL USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- Admins/Super Admins can view all reports
CREATE POLICY "bde_admin_view_all" ON public.bde_daily_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
        AND organization_id = bde_daily_reports.organization_id
    )
  );

-- Team leads can view reports of their org
CREATE POLICY "bde_teamlead_view" ON public.bde_daily_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND organization_id = bde_daily_reports.organization_id
    )
  );

-- Grant access
GRANT ALL ON public.bde_daily_reports TO authenticated;

NOTIFY pgrst, 'reload schema';
