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

async function testAnswers() {
  const submissionId = 'e4df4269-d3cd-4b85-b367-53b7314e68cd';
  console.log('Testing GET answers...');
  const { data: getAnswers, error: getError } = await supabase
    .from('form_submission_answers')
    .select('*')
    .eq('submission_id', submissionId);

  console.log('GET Answers Result:', { data: getAnswers, error: getError });
}

testAnswers();
