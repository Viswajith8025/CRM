import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function recover() {
  console.log('--- REVENUE RECOVERY SEARCH ---')
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('status', 'closed_won')
  
  if (error) {
    console.error('Error searching leads:', error.message)
    return
  }

  if (data.length === 0) {
    console.log('No closed_won leads found to recover revenue from.')
  } else {
    console.log(`Found ${data.length} closed_won leads:`)
    data.forEach(lead => {
      console.log(`- Lead: ${lead.first_name} ${lead.last_name || ''}, Value: ${lead.value}, Company: ${lead.company}`)
    })
  }
}

recover()
