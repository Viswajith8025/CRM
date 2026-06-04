-- ==============================================================================
-- ENTERPRISE AUDIT REMEDIATION (BACKEND INTEGRITY)
-- ==============================================================================
-- Fixes:
-- 1. Task Dependency Enforcement (Strict Backend Trigger)
-- 2. Orphaned Department Data Handling
-- 3. Immutable Ledger Expansion (Leads, Tasks, Invoices Audit Logging)
-- ==============================================================================

-- ==============================================================================
-- FIX 1: TASK DEPENDENCY ENFORCEMENT
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enforce_task_dependencies()
RETURNS TRIGGER AS $$
DECLARE
  v_unresolved_title TEXT;
BEGIN
  -- Only check when transitioning to 'done'
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    SELECT t.title INTO v_unresolved_title
    FROM public.task_dependencies td
    JOIN public.tasks t ON td.depends_on_task_id = t.id
    WHERE td.task_id = NEW.id
      AND t.status != 'done'
      AND t.deleted_at IS NULL
    LIMIT 1;

    IF v_unresolved_title IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot complete task. Blocked by incomplete dependency: "%"', v_unresolved_title;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_task_dependencies ON public.tasks;
CREATE TRIGGER trg_enforce_task_dependencies
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_dependencies();

-- ==============================================================================
-- FIX 2: ORPHANED DEPARTMENT DATA HANDLING
-- ==============================================================================
-- When an employee is removed from a department, tasks assigned to them 
-- in projects belonging to that department are unassigned and blocked.
CREATE OR REPLACE FUNCTION public.handle_orphaned_department_member()
RETURNS TRIGGER AS $$
BEGIN
  -- Block tasks belonging to projects of this department
  UPDATE public.tasks
  SET 
    assigned_to = NULL,
    status = 'blocked',
    blocked_reason = 'Assignee was removed from the project''s department.',
    updated_at = NOW()
  WHERE assigned_to = OLD.profile_id
    AND project_id IN (
      SELECT id FROM public.projects WHERE department_id = OLD.department_id
    )
    AND status NOT IN ('done', 'blocked')
    AND deleted_at IS NULL;

  -- Reassign department KPI tracking to NULL (if any specific tables track this)
  -- Currently KPI tables are at the department level, not user level.
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_handle_orphaned_department_member ON public.department_members;
CREATE TRIGGER trg_handle_orphaned_department_member
  AFTER DELETE ON public.department_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_orphaned_department_member();

-- ==============================================================================
-- FIX 3: IMMUTABLE AUDIT LOGGING EXPANSION
-- ==============================================================================

-- 3A. Audit Lead Conversions
CREATE OR REPLACE FUNCTION public.audit_lead_conversion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'converted' AND OLD.status != 'converted' THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    VALUES (
      NEW.organization_id, 
      auth.uid(), 
      'CONVERT', 
      'lead', 
      NEW.id, 
      jsonb_build_object('message', 'Lead converted to Client', 'lead_title', NEW.title)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_lead_conversion ON public.leads;
CREATE TRIGGER trg_audit_lead_conversion
  AFTER UPDATE OF status ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_lead_conversion();

-- 3B. Audit Task Deletions (Soft Deletes)
CREATE OR REPLACE FUNCTION public.audit_task_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    VALUES (
      NEW.organization_id, 
      auth.uid(), 
      'DELETE', 
      'task', 
      NEW.id, 
      jsonb_build_object('message', 'Task deleted', 'task_title', NEW.title)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_task_deletion ON public.tasks;
CREATE TRIGGER trg_audit_task_deletion
  AFTER UPDATE OF deleted_at ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_task_deletion();

-- 3C. Audit Invoice Modifications
CREATE OR REPLACE FUNCTION public.audit_invoice_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Track important financial changes
  IF (NEW.amount != OLD.amount OR NEW.status != OLD.status OR NEW.due_date != OLD.due_date) THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, entity_type, entity_id, details)
    VALUES (
      NEW.organization_id, 
      auth.uid(), 
      'UPDATE', 
      'invoice', 
      NEW.id, 
      jsonb_build_object(
        'message', 'Invoice financially modified', 
        'invoice_number', NEW.invoice_number,
        'old_amount', OLD.amount,
        'new_amount', NEW.amount,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_invoice_modification ON public.invoices;
CREATE TRIGGER trg_audit_invoice_modification
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_invoice_modification();

-- Done
NOTIFY pgrst, 'reload schema';
