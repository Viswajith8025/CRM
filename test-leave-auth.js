import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testLeaveAuth() {
  console.log("Testing leave_requests with anon key (simulating frontend)...");
  
  // Try inserting
  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      organization_id: '00000000-0000-0000-0000-000000000000',
      user_id: '00000000-0000-0000-0000-000000000000',
      leave_type_id: '00000000-0000-0000-0000-000000000000',
      start_date: '2026-06-01',
      end_date: '2026-06-02',
      reason: 'test',
      status: 'pending'
    });

  if (error) {
    console.error("ERROR from frontend-like request:", error);
  } else {
    console.log("SUCCESS from frontend-like request:", data);
  }
}

testLeaveAuth();
