-- ==============================================================================
-- ENTERPRISE BILLING UPGRADE
-- Adds partial payments, payment verification, and invoice revisions
-- ==============================================================================

-- 1. Upgrade Invoices Table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add the new status to the existing ENUM type
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';

-- 2. Upgrade Payments Table
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('pending', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

-- 3. Invoice Revisions Table
CREATE TABLE IF NOT EXISTS public.invoice_revisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  organization_id UUID NOT NULL
);

ALTER TABLE public.invoice_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_revisions_select" ON public.invoice_revisions
  FOR SELECT TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'super_admin'
    OR organization_id = public.get_my_org_id()
  );

-- 4. Overdue Detection Function (can be run via pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.detect_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated AS (
    UPDATE public.invoices
    SET status = 'overdue'
    WHERE status IN ('sent', 'partially_paid') 
      AND due_date < CURRENT_DATE
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;
  
  RETURN updated_count;
END;
$$;

-- 5. Auto-calculate payment reconciliation and trigger partial/full paid
CREATE OR REPLACE FUNCTION public.reconcile_invoice_payment()
RETURNS TRIGGER AS $$
DECLARE
  inv_amount NUMERIC;
  total_paid NUMERIC;
BEGIN
  IF NEW.status = 'verified' AND NEW.invoice_id IS NOT NULL THEN
    -- Calculate total verified payments
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM public.payments
    WHERE invoice_id = NEW.invoice_id AND status = 'verified';

    -- Get invoice total amount
    SELECT amount INTO inv_amount
    FROM public.invoices
    WHERE id = NEW.invoice_id;

    -- Update invoice
    IF total_paid >= inv_amount THEN
      UPDATE public.invoices 
      SET paid_amount = total_paid, status = 'paid'
      WHERE id = NEW.invoice_id;
    ELSIF total_paid > 0 THEN
      UPDATE public.invoices 
      SET paid_amount = total_paid, status = 'partially_paid'
      WHERE id = NEW.invoice_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_verified ON public.payments;
CREATE TRIGGER on_payment_verified
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.reconcile_invoice_payment();

-- 6. Trigger to save revision on update
CREATE OR REPLACE FUNCTION public.save_invoice_revision()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount 
     OR OLD.tax_amount IS DISTINCT FROM NEW.tax_amount
     OR OLD.due_date IS DISTINCT FROM NEW.due_date
     OR OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Increment version
    NEW.version := OLD.version + 1;
    
    INSERT INTO public.invoice_revisions (
      invoice_id, version, snapshot, created_by, organization_id
    ) VALUES (
      NEW.id,
      NEW.version,
      to_jsonb(OLD),
      auth.uid(),
      NEW.organization_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_invoice_update_revision ON public.invoices;
CREATE TRIGGER on_invoice_update_revision
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.save_invoice_revision();

NOTIFY pgrst, 'reload schema';
