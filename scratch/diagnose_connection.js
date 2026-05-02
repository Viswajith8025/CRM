import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

console.log('--- SUPABASE CONNECTION DIAGNOSTIC ---')
console.log('URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function diagnose() {
  console.log('\n1. Testing Connection...')
  const { data: authData, error: authError } = await supabase.auth.getSession()
  if (authError) {
    console.error('Auth Error:', authError.message)
  } else {
    console.log('Auth Success: Connected to Supabase')
  }

  console.log('\n2. Checking Table Row Counts (Raw)...')
  const tables = ['leads', 'projects', 'tasks', 'invoices', 'profiles']
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.error(`- ${table}: Error - ${error.message}`)
    } else {
      console.log(`- ${table}: ${count} rows found`)
    }
  }

  console.log('\n3. Checking for RLS suppression...')
  const { data: rlsCheck, error: rlsError } = await supabase
    .from('tasks')
    .select('*')
    .limit(1)
  
  if (rlsError) {
    console.error('RLS/Fetch Error:', rlsError.message)
  } else {
    console.log('Fetch Result:', rlsCheck.length > 0 ? 'Data returned!' : 'No data returned (likely RLS or empty table)')
  }
}

diagnose()
