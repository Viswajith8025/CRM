-- Create wfh_records table to track Work From Home days
CREATE TABLE IF NOT EXISTS public.wfh_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  biometric_pin VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  marked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, biometric_pin, date)
);

-- RLS
ALTER TABLE public.wfh_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view WFH records"
  ON public.wfh_records FOR SELECT
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage WFH records"
  ON public.wfh_records FOR ALL
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
