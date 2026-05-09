-- ==============================================================================
-- ENTERPRISE MIGRATION REGISTRY
-- Tracks applied schema versions to prevent duplicate execution and drift
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.migration_history (
    version BIGINT PRIMARY KEY, -- YYYYMMDDHHMMSS
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by UUID REFERENCES public.profiles(id),
    is_success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- Enable RLS (Admin Only)
ALTER TABLE public.migration_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "migration_history_admin_only" ON public.migration_history
FOR SELECT TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
));

-- HELPER: Log migration start
CREATE OR REPLACE FUNCTION public.log_migration_start(p_version BIGINT, p_name TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.migration_history (version, name, is_success)
    VALUES (p_version, p_name, FALSE)
    ON CONFLICT (version) DO UPDATE SET name = p_name, is_success = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- HELPER: Log migration success
CREATE OR REPLACE FUNCTION public.log_migration_success(p_version BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.migration_history 
    SET is_success = TRUE, applied_at = NOW()
    WHERE version = p_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
