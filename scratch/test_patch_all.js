import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAllColumns() {
  const submissionId = 'e4df4269-d3cd-4b85-b367-53b7314e68cd';
  
  console.log('Testing PATCH all columns...');
  const { data, error } = await supabase
    .from('form_submissions')
    .update({
      completion_rate: 20,
      current_step: 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', submissionId)
    .select();

  console.log('PATCH all columns Result:', { data, error });
}

testAllColumns();
