-- Standalone table for biometric device employee names
CREATE TABLE IF NOT EXISTS public.biometric_employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  pin VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, pin)
);

ALTER TABLE public.biometric_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage biometric employees"
  ON public.biometric_employees FOR ALL
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
