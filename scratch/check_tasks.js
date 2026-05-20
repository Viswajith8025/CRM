import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1NTcwNCwiZXhwIjoyMDkyOTMxNzA0fQ._wUbuBcKtzlELuDSN9VapUUtqi8fVy6oBruTbsY-XRo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTasks() {
  console.log("Checking for tasks with non-null assignees...");
  
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, estimated_hours, status')
    .not('assigned_to', 'is', null);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${tasks.length} assigned tasks.`);
  console.log(tasks);
}

checkTasks();
