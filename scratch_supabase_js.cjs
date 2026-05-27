const { createClient } = require('@supabase/supabase-js');

async function test() {
  const supabase = createClient(
    "https://vbosonyrosxfttyoengz.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTU3MDQsImV4cCI6MjA5MjkzMTcwNH0.OyJKw9QvXyp3DcnR_lYkc0ID9O64bnvk521hRtW1DcE"
  );

  const { data, error } = await supabase.rpc('submit_leave_request_v2', {
    p_leave_type_id: "00000000-0000-0000-0000-000000000000",
    p_start_date: "2026-05-27",
    p_end_date: "2026-05-28",
    p_reason: "test",
    p_is_emergency: false
  });

  console.log("Error:", error);
  console.log("Data:", data);
}

test();
