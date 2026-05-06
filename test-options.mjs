import fetch from 'node-fetch'; // wait, node 18 has fetch built-in

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co/rest/v1/documents';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTU3MDQsImV4cCI6MjA5MjkzMTcwNH0.OyJKw9QvXyp3DcnR_lYkc0ID9O64bnvk521hRtW1DcE';

async function checkSchema() {
  const response = await fetch(supabaseUrl, {
    method: 'OPTIONS',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  const text = await response.text();
  console.log(text);
}

checkSchema();
