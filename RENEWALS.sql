
-- Create Renewals table for tracking hosting, domain, and mail renewals
CREATE TABLE IF NOT EXISTS public.renewals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('hosting', 'domain', 'mail', 'hosting_domain')),
    description TEXT,
    amount DECIMAL(12,2) DEFAULT 0,
    expiry_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'overdue', 'cancelled')),
    reminders_sent INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.renewals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view renewals for their organization"
    ON public.renewals FOR SELECT
    USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert renewals for their organization"
    ON public.renewals FOR INSERT
    WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update renewals for their organization"
    ON public.renewals FOR UPDATE
    USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete renewals for their organization"
    ON public.renewals FOR DELETE
    USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_renewals_expiry_date ON public.renewals(expiry_date);
CREATE INDEX IF NOT EXISTS idx_renewals_status ON public.renewals(status);
CREATE INDEX IF NOT EXISTS idx_renewals_organization_id ON public.renewals(organization_id);
