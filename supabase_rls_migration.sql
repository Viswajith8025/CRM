-- Run this in Supabase SQL Editor for an existing database.
-- Existing rows with NULL user_id will be hidden by these policies until you backfill them
-- to the correct owner.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE task_comments ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE time_logs ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
CREATE POLICY "Users can manage their own profile"
  ON profiles FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own clients" ON clients;
CREATE POLICY "Users can manage their own clients"
  ON clients FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own leads" ON leads;
CREATE POLICY "Users can manage their own leads"
  ON leads FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own projects" ON projects;
CREATE POLICY "Users can manage their own projects"
  ON projects FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      client_id IS NULL
      OR EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = projects.client_id
        AND clients.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      client_id IS NULL
      OR EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = projects.client_id
        AND clients.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage their own tasks" ON tasks;
CREATE POLICY "Users can manage their own tasks"
  ON tasks FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = tasks.project_id
        AND projects.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = tasks.project_id
        AND projects.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage comments on their own tasks" ON task_comments;
CREATE POLICY "Users can manage comments on their own tasks"
  ON task_comments FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_comments.task_id
      AND tasks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_comments.task_id
      AND tasks.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own time logs" ON time_logs;
CREATE POLICY "Users can manage their own time logs"
  ON time_logs FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = time_logs.task_id
        AND tasks.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = time_logs.task_id
        AND tasks.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage their own invoices" ON invoices;
CREATE POLICY "Users can manage their own invoices"
  ON invoices FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = invoices.client_id
      AND clients.user_id = auth.uid()
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = invoices.project_id
        AND projects.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = invoices.client_id
      AND clients.user_id = auth.uid()
    )
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = invoices.project_id
        AND projects.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage their own payments" ON payments;
CREATE POLICY "Users can manage their own payments"
  ON payments FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
      AND invoices.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own notifications" ON notifications;
CREATE POLICY "Users can manage their own notifications"
  ON notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage milestones on their own projects" ON project_milestones;
CREATE POLICY "Users can manage milestones on their own projects"
  ON project_milestones FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_milestones.project_id
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_milestones.project_id
      AND projects.user_id = auth.uid()
    )
  );
