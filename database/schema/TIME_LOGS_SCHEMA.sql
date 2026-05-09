-- ==============================================================================
-- TASK TIME LOGGING SCHEMA
-- Tracks employee labor hours per task
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.task_time_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS
ALTER TABLE public.task_time_logs ENABLE ROW LEVEL SECURITY;

-- POLICIES
DROP POLICY IF EXISTS "time_logs_select" ON public.task_time_logs;
CREATE POLICY "time_logs_select" ON public.task_time_logs FOR SELECT TO authenticated 
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "time_logs_insert" ON public.task_time_logs;
CREATE POLICY "time_logs_insert" ON public.task_time_logs FOR INSERT TO authenticated 
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON public.task_time_logs (task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_org ON public.task_time_logs (organization_id);
