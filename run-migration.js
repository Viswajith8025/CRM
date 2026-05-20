import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually to ensure variables are loaded in Node.js environment
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if any
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use service role key to bypass RLS for schema updates
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlFile = path.resolve('database/migrations/ENTERPRISE_PROJECT_WORKFLOW.sql');
  if (!fs.existsSync(sqlFile)) {
    console.error("Migration file not found:", sqlFile);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(sqlFile, 'utf8');
  console.log("Starting execution of ENTERPRISE_PROJECT_WORKFLOW.sql...");
  
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: sql
  });
  
  if (error) {
    console.error("Migration failed with error:", error);
    process.exit(1);
  } else {
    console.log("Migration executed successfully!");
    console.log("Details:", data);
  }
}

run();
