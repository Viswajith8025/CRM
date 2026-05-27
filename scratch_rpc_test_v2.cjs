const fetch = require('node-fetch');

async function check() {
  const url = "https://vbosonyrosxfttyoengz.supabase.co/rest/v1/rpc/submit_leave_request_v2";
  // using ANON key
  const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTU3MDQsImV4cCI6MjA5MjkzMTcwNH0.OyJKw9QvXyp3DcnR_lYkc0ID9O64bnvk521hRtW1DcE";
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_leave_type_id: "00000000-0000-0000-0000-000000000000",
      p_start_date: "2026-05-27",
      p_end_date: "2026-05-28",
      p_reason: "test",
      p_is_emergency: false
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", text);
}

check();
