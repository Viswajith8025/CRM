import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1NTcwNCwiZXhwIjoyMDkyOTMxNzA0fQ._wUbuBcKtzlELuDSN9VapUUtqi8fVy6oBruTbsY-XRo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
  console.log("Checking security_logs for recent events...");
  const { data, error } = await supabase
    .from('security_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error reading logs:", error);
    return;
  }

  console.log("Recent Security Logs:");
  console.log(JSON.stringify(data, null, 2));
}

checkLogs();
