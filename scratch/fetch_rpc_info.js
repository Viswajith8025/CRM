import axios from 'axios';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1NTcwNCwiZXhwIjoyMDkyOTMxNzA0fQ._wUbuBcKtzlELuDSN9VapUUtqi8fVy6oBruTbsY-XRo';

async function fetchSchema() {
  try {
    const res = await axios.get(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    console.log("Details for /rpc/debug_perf_trace:");
    console.log(JSON.stringify(res.data.paths['/rpc/debug_perf_trace'], null, 2));
    console.log("Details for /rpc/resuscitate_record:");
    console.log(JSON.stringify(res.data.paths['/rpc/resuscitate_record'], null, 2));
  } catch (err) {
    console.error("Error fetching schema:", err.message);
  }
}

fetchSchema();
