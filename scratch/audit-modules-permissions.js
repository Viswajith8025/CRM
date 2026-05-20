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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
  console.log("=== Fetching all entries in module_registry ===");
  const { data: modules, error: modError } = await supabase
    .from('module_registry')
    .select('*')
    .order('sort_order');
  
  if (modError) {
    console.error("Error fetching module_registry:", modError);
  } else {
    console.table(modules.map(m => ({
      key: m.key,
      name: m.name,
      route: m.route,
      permission: m.permission,
      is_enabled: m.is_enabled
    })));
  }

  console.log("\n=== Fetching all permissions ===");
  const { data: perms, error: permError } = await supabase
    .from('permissions')
    .select('*')
    .order('module, code');

  if (permError) {
    console.error("Error fetching permissions:", permError);
  } else {
    // Group permissions by their 'module' field
    const grouped = {};
    perms.forEach(p => {
      if (!grouped[p.module]) {
        grouped[p.module] = [];
      }
      grouped[p.module].push({
        code: p.code,
        name: p.name,
        description: p.description
      });
    });

    for (const [mod, list] of Object.entries(grouped)) {
      console.log(`\n--- Module in DB: ${mod} (${list.length} permissions) ---`);
      list.forEach(p => {
        console.log(`  [${p.code}] ${p.name} - ${p.description}`);
      });
    }
  }
}

audit();
