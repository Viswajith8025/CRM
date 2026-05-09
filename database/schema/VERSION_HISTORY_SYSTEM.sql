-- ==============================================================================
-- UNIVERSAL VERSION HISTORY & AUDIT SYSTEM
-- Tracks full JSONB snapshots of entities on every modification
-- ==============================================================================

-- 1. CREATE VERSION LOG TABLE
CREATE TABLE IF NOT EXISTS public.entity_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL, -- 'invoice', 'proposal', 'project', 'client'
    entity_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    data JSONB NOT NULL,
    changed_by UUID REFERENCES public.profiles(id),
    change_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ENABLE RLS
ALTER TABLE public.entity_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_versions_select" ON public.entity_versions
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
    ));

-- 3. TRIGGER FUNCTION: Generic version tracker
CREATE OR REPLACE FUNCTION public.fn_track_version()
RETURNS TRIGGER AS $$
DECLARE
    v_version INTEGER;
    v_changed_by UUID;
BEGIN
    -- Get current user from auth.uid()
    v_changed_by := auth.uid();
    
    -- Calculate next version number
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
    FROM public.entity_versions
    WHERE entity_type = TG_ARGV[0] AND entity_id = NEW.id;

    -- Insert snapshot
    INSERT INTO public.entity_versions (
        entity_type,
        entity_id,
        version_number,
        data,
        changed_by,
        change_summary
    ) VALUES (
        TG_ARGV[0],
        NEW.id,
        v_version,
        to_jsonb(NEW),
        v_changed_by,
        'Auto-captured snapshot on update'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ATTACH TRIGGERS TO CORE TABLES
-- Invoices
DROP TRIGGER IF EXISTS tr_version_invoices ON public.invoices;
CREATE TRIGGER tr_version_invoices
    AFTER UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.fn_track_version('invoice');

-- Proposals
DROP TRIGGER IF EXISTS tr_version_proposals ON public.proposals;
CREATE TRIGGER tr_version_proposals
    AFTER UPDATE ON public.proposals
    FOR EACH ROW EXECUTE FUNCTION public.fn_track_version('proposal');

-- Projects
DROP TRIGGER IF EXISTS tr_version_projects ON public.projects;
CREATE TRIGGER tr_version_projects
    AFTER UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.fn_track_version('project');

-- Clients
DROP TRIGGER IF EXISTS tr_version_clients ON public.clients;
CREATE TRIGGER tr_version_clients
    AFTER UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.fn_track_version('client');
