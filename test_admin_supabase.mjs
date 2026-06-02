import { createClient } from '@supabase/supabase-js';

async function run() {
  const adminSupabase = createClient(
    'https://vbosonyrosxfttyoengz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1NTcwNCwiZXhwIjoyMDkyOTMxNzA0fQ._wUbuBcKtzlELuDSN9VapUUtqi8fVy6oBruTbsY-XRo',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  
  const { error } = await adminSupabase.from('leave_requests').insert({
    organization_id: '8a7d3a04-51bc-40d3-ba6b-648b26002f23',
    user_id: '8a7d3a04-51bc-40d3-ba6b-648b26002f23',
    leave_type_id: '8a7d3a04-51bc-40d3-ba6b-648b26002f23',
    start_date: '2026-06-10',
    end_date: '2026-06-11',
    reason: 'test',
    is_emergency: false,
    status: 'pending'
  });
  console.log('Error:', error);
}
run();
