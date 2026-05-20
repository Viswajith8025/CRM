import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1NTcwNCwiZXhwIjoyMDkyOTMxNzA0fQ._wUbuBcKtzlELuDSN9VapUUtqi8fVy6oBruTbsY-XRo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const sql = `
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS team_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    NOTIFY pgrst, 'reload schema';
  `;

  console.log("Running migration to add department_id and team_lead_id to clients...");
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
  if (error) {
    console.error("Migration failed:", error);
  } else {
    console.log("Migration succeeded:", data);
  }
}

runMigration();
