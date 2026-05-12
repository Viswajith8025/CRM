import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTask() {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', 'c42fa2c3-ea6f-4026-a38a-58bff0018203').single();
  console.log("Task:", data);
  if (error) console.error("Error:", error);
}

checkTask();
