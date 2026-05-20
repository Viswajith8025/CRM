import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1NTcwNCwiZXhwIjoyMDkyOTMxNzA0fQ._wUbuBcKtzlELuDSN9VapUUtqi8fVy6oBruTbsY-XRo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log("Projects table check...");
  const { data: projData, error: projErr } = await supabase.from('projects').select('*').limit(1);
  if (projErr) console.error("Projects error:", projErr);
  else console.log("Projects columns:", Object.keys(projData[0] || {}));

  console.log("Clients table check...");
  const { data: clientData, error: clientErr } = await supabase.from('clients').select('*').limit(1);
  if (clientErr) console.error("Clients error:", clientErr);
  else console.log("Clients columns:", Object.keys(clientData[0] || {}));
}

checkColumns();
