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

async function run() {
  const email = 'hackerhacker0424@gmail.com';
  console.log("Checking user profile for:", email);
  
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();
    
  if (pError) {
    console.error("Error fetching profile:", pError);
    return;
  }
  
  if (!profile) {
    console.log("Profile not found for:", email);
    return;
  }
  
  console.log("Profile in DB:", profile);
  
  const { data: userRoles, error: urError } = await supabase
    .from('user_roles')
    .select('*, roles(*)')
    .eq('user_id', profile.id);
    
  if (urError) {
    console.error("Error fetching user roles:", urError);
  } else {
    console.log("User Roles in DB:", userRoles);
  }
}

run();
