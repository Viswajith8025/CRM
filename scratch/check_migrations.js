import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1NTcwNCwiZXhwIjoyMDkyOTMxNzA0fQ._wUbuBcKtzlELuDSN9VapUUtqi8fVy6oBruTbsY-XRo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigrations() {
  const { data, error } = await supabase.from('migration_history').select('*').limit(20);
  if (error) {
    console.error("Error fetching migrations:", error);
  } else {
    console.log("Executed migrations:", data);
  }
}

checkMigrations();
