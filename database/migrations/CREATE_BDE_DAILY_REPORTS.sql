-- Migration: BDE Daily Reports
-- Description: Creates a table to store BDE morning login plans and evening logout reports

BEGIN;

DROP TABLE IF EXISTS public.bde_daily_reports CASCADE;

CREATE TABLE public.bde_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Morning Login (Plan)
    database_planned TEXT,
    database_count INTEGER DEFAULT 0,
    leads_social_media INTEGER DEFAULT 0,
    leads_just_dial INTEGER DEFAULT 0,
    leads_other INTEGER DEFAULT 0,
    meetings_scheduled INTEGER DEFAULT 0,
    
    -- Evening Logout (Report)
    meetings_attended INTEGER,
    calls_connected INTEGER,
    amount_collected DECIMAL(12, 2),
    remarks TEXT,
    
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A user can only have one active report per day
    UNIQUE(user_id, report_date)
);

-- Indexes for fast querying
CREATE INDEX idx_bde_daily_reports_org ON public.bde_daily_reports(organization_id);
CREATE INDEX idx_bde_daily_reports_user ON public.bde_daily_reports(user_id);
CREATE INDEX idx_bde_daily_reports_date ON public.bde_daily_reports(report_date);

-- Enable RLS
ALTER TABLE public.bde_daily_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own reports"
    ON public.bde_daily_reports FOR SELECT
    USING (auth.uid() = user_id OR 
           EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin', 'manager') AND p.organization_id = bde_daily_reports.organization_id));

CREATE POLICY "Users can insert their own reports"
    ON public.bde_daily_reports FOR INSERT
    WITH CHECK (auth.uid() = user_id AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update their own reports"
    ON public.bde_daily_reports FOR UPDATE
    USING (auth.uid() = user_id OR 
           EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin') AND p.organization_id = bde_daily_reports.organization_id));

-- Triggers for updated_at
CREATE TRIGGER update_bde_daily_reports_updated_at
    BEFORE UPDATE ON public.bde_daily_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;
