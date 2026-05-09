import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

/**
 * MANUAL ENV LOADER
 * Standard Node.js does not load .env files automatically.
 */
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim()
        }
      })
    }
  } catch (err) {
    console.warn("⚠️ Failed to load .env file manually:", err.message)
  }
}

loadEnv()

/**
 * ENTERPRISE LOAD TEST SEEDER
 * Populates the database with 10k Invoices and 50k Tasks for stress testing.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function seed() {
  console.log("🚀 Starting Enterprise Data Seeding...")

  // 1. Get a target organization
  const { data: orgs, error: orgError } = await supabase.from('organizations').select('id').limit(1)
  if (orgError || !orgs?.length) {
    console.error("❌ No organizations found to seed into.")
    return
  }
  const orgId = orgs[0].id

  // 2. Get a target project or create one
  let { data: projects, error: projError } = await supabase.from('projects').select('id').eq('organization_id', orgId).limit(1)
  
  let projectId;
  if (projError || !projects?.length) {
    console.log("📂 No projects found. Creating 'Performance Test Project'...")
    const { data: newProj, error: createError } = await supabase.from('projects').insert({
      name: 'Performance Test Project',
      status: 'in_progress',
      organization_id: orgId,
      description: 'System-generated project for load testing.'
    }).select().single()

    if (createError) {
      console.error("❌ Failed to create a test project:", createError.message)
      return
    }
    projectId = newProj.id
  } else {
    projectId = projects[0].id
  }

  // 3. Seed 50,000 Tasks in chunks of 1000
  console.log("📝 Seeding 50,000 Tasks...")
  for (let i = 0; i < 50; i++) {
    const chunk = Array.from({ length: 1000 }).map((_, j) => ({
      title: `Stress Test Task ${i * 1000 + j}`,
      description: `Auto-generated task for performance validation. Sequence ${i * 1000 + j}`,
      status: ['todo', 'in_progress', 'done'][Math.floor(Math.random() * 3)],
      priority: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      project_id: projectId,
      organization_id: orgId,
      created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString()
    }))

    const { error } = await supabase.from('tasks').insert(chunk)
    if (error) console.error(`❌ Error seeding task chunk ${i}:`, error.message)
    else process.stdout.write(".")
  }
  console.log("\n✅ Tasks seeded.")

  // 4. Seed 10,000 Invoices in chunks of 500
  const timestamp = Date.now()
  console.log(`💳 Seeding 10,000 Invoices (Batch: ${timestamp})...`)
  for (let i = 0; i < 20; i++) {
    const chunk = Array.from({ length: 500 }).map((_, j) => ({
      invoice_number: `STRESS-${timestamp}-${i * 500 + j}`,
      amount: Math.floor(Math.random() * 10000) + 100,
      status: ['draft', 'sent', 'paid', 'overdue'][Math.floor(Math.random() * 4)],
      project_id: projectId,
      organization_id: orgId,
      issued_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      due_date: new Date(Date.now() + Math.random() * 10000000000).toISOString()
    }))

    const { error } = await supabase.from('invoices').insert(chunk)
    if (error) console.error(`❌ Error seeding invoice chunk ${i}:`, error.message)
    else process.stdout.write(".")
  }
  console.log("\n✅ Invoices seeded.")

  console.log("\n🏁 Seeding complete. System is now ready for stress testing.")
}

seed()
