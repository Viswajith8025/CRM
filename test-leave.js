import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testLeaveTable() {
  console.log("Checking if leave_requests table exists and is accessible...");
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .limit(1);

  if (error) {
    console.error("ERROR accessing leave_requests:", error);
  } else {
    console.log("SUCCESS! Table exists and returned:", data);
  }
}

testLeaveTable();
