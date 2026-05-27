-- Ensure policies on task_subtasks
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view subtasks in their org" ON public.task_subtasks;
DROP POLICY IF EXISTS "Users can insert subtasks in their org" ON public.task_subtasks;
DROP POLICY IF EXISTS "Users can update subtasks in their org" ON public.task_subtasks;
DROP POLICY IF EXISTS "Users can delete subtasks in their org" ON public.task_subtasks;

CREATE POLICY "Users can view subtasks in their org" ON public.task_subtasks
FOR SELECT USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert subtasks in their org" ON public.task_subtasks
FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update subtasks in their org" ON public.task_subtasks
FOR UPDATE USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete subtasks in their org" ON public.task_subtasks
FOR DELETE USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

NOTIFY pgrst, 'reload schema';
