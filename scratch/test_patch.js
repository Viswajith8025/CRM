import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
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

// Use ANON key to simulate the exact client frontend request!
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const submissionId = 'e4df4269-d3cd-4b85-b367-53b7314e68cd';
  console.log('Testing GET submission...');
  const { data: getData, error: getError } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  console.log('GET Result:', { data: getData, error: getError });

  console.log('Testing PATCH submission...');
  const { data: patchData, error: patchError } = await supabase
    .from('form_submissions')
    .update({ completion_rate: 10 })
    .eq('id', submissionId)
    .select();

  console.log('PATCH Result:', { data: patchData, error: patchError });
}

test();
