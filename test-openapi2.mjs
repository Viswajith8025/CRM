import fetch from 'node-fetch';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTU3MDQsImV4cCI6MjA5MjkzMTcwNH0.OyJKw9QvXyp3DcnR_lYkc0ID9O64bnvk521hRtW1DcE';

async function checkSchema() {
  const response = await fetch(supabaseUrl);
  const data = await response.json();
  console.log("Root keys:", Object.keys(data));
  if (data.definitions) {
    console.log("Definitions:", Object.keys(data.definitions));
  }
}

checkSchema();
