import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://vbosonyrosxfttyoengz.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function testUpdate() {
  const { data, error } = await supabase
    .from('leave_requests')
    .update({ 
      status: 'approved',
      current_approver_id: '18a2b123-c309-4777-ac45-cd7570ce2cfa' // dummy UUID
    })
    .eq('id', '18a2b123-c309-4777-ac45-cd7570ce2cfa')
    .select()
    .single()

  console.log("Error:", error)
}

testUpdate()
