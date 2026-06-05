-- ==============================================================================
-- ENTERPRISE ORPHAN CLEANUP & SOFT DELETES
-- Remediation for Storage Orphans and Financial Hard Deletions
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. STORAGE ORPHAN CLEANUP ROUTINE (pg_cron)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_storage_files()
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
    -- Delete metadata for files uploaded to 'documents' bucket more than 24h ago
    -- that are NOT linked in the form_attachments table.
    -- (Assuming Supabase storage schema exists)
    DELETE FROM storage.objects
    WHERE bucket_id = 'documents'
      AND created_at < NOW() - INTERVAL '1 day'
      AND name LIKE 'onboarding/%'
      AND NOT EXISTS (
          SELECT 1 FROM public.form_attachments fa
          WHERE fa.file_url LIKE '%' || storage.objects.name
      );

    RAISE LOG 'Orphaned files cleaned up successfully from storage.objects.';
END;
$$ LANGUAGE plpgsql;

-- Attempt to schedule the cron job if pg_cron is enabled
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'orphan_file_cleanup',
            '0 2 * * *', -- Run every day at 2:00 AM
            'SELECT public.cleanup_orphaned_storage_files()'
        );
    END IF;
END
$$;

-- ------------------------------------------------------------------------------
-- 2. SOFT DELETIONS IN FINANCIALS (Invoices)
-- ------------------------------------------------------------------------------

-- Add deleted_at column to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create a rule/trigger to prevent hard deletion of invoices
CREATE OR REPLACE FUNCTION public.prevent_invoice_hard_delete()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    -- Instead of deleting, we update deleted_at
    UPDATE public.invoices SET deleted_at = NOW() WHERE id = OLD.id;
    RETURN NULL; -- Cancel the actual hard delete
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_soft_delete_invoices ON public.invoices;
CREATE TRIGGER trg_soft_delete_invoices
    BEFORE DELETE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_invoice_hard_delete();
