
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function checkSchema() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error fetching project:', error)
    return
  }

  if (data && data.length > 0) {
    console.log('Project columns:', Object.keys(data[0]))
  } else {
    console.log('No projects found to check columns.')
  }
}

checkSchema()
