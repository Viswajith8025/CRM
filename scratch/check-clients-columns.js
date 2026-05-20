import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: cols, error: colsError } = await supabase.rpc('execute_sql', {
    sql_query: "select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name in ('clients', 'projects', 'project_modules');"
  });
  
  if (colsError) {
    // If execute_sql RPC doesn't exist, we can use a direct select on information_schema from REST if allowed, or standard query
    const { data: cols2, error: colsError2 } = await supabase.from('information_schema_columns').select('*').limit(1).catch(() => ({data:null, error: true}));
    console.error("RPC Error:", colsError);
    
    // Let's do a fallback select by fetching column names via a dummy SELECT query
    console.log("Fetching columns via dummy SELECT...");
  } else {
    console.log("Columns from information_schema:", cols);
  }

run();
