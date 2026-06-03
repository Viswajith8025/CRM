-- NUCLEAR FIX: Make record_id nullable on audit_logs to prevent Kanban boards and other core features from crashing.
ALTER TABLE public.audit_logs ALTER COLUMN record_id DROP NOT NULL;
