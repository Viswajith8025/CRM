import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTU3MDQsImV4cCI6MjA5MjkzMTcwNH0.OyJKw9QvXyp3DcnR_lYkc0ID9O64bnvk521hRtW1DcE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDocs() {
  const { data, error } = await supabase.from('documents').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success, rows:', data);
  }
}

checkDocs();
