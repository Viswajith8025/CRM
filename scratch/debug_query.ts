import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
if (!process.env.VITE_SUPABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') })
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
)

async function testQuery() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .limit(10)

  if (error) {
    console.error('TASKS USER_ID ERROR:', error)
  }

  const { data: data2, error: error2 } = await supabase
    .from('tasks')
    .select('*, profiles!assigned_to(*)')
    .limit(1)

  if (error2) {
    console.error('TASKS ASSIGNED_TO ERROR:', error2)
  }
}

testQuery()
