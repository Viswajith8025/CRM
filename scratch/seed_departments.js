import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_DEPTS = [
  { name: "Development", slug: "development", description: "Core engineering, sprint planning, and bug tracking." },
  { name: "Design", slug: "design", description: "UI/UX prototypes, review pipelines, and graphic elements." },
  { name: "SEO", slug: "seo", description: "Keyword analytics, domain authority metrics, and optimization." },
  { name: "Sales", slug: "sales", description: "Lead conversions, proposal trackers, and target pipelines." },
  { name: "Content", slug: "content", description: "Editorial pipelines, publishing queues, and reviews." }
];

async function seed() {
  console.log("Fetching distinct organization IDs from profiles...");
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('organization_id');

  if (profErr) {
    console.error("Error fetching profiles:", profErr);
    process.exit(1);
  }

  const orgIds = new Set();
  orgIds.add('00000000-0000-0000-0000-000000000000'); // Always seed the default org context
  profiles.forEach(p => {
    if (p.organization_id) {
      orgIds.add(p.organization_id);
    }
  });

  console.log(`Seeding departments for ${orgIds.size} unique organization(s)...`);

  for (const orgId of orgIds) {
    console.log(`Seeding for Organization ID: ${orgId}`);
    for (const dept of DEFAULT_DEPTS) {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          organization_id: orgId,
          name: dept.name,
          slug: dept.slug,
          description: dept.description,
          status: 'active'
        })
        .select();

      if (error) {
        if (error.code === '23505') {
          console.log(`  -> Department "${dept.name}" already exists for org ${orgId} (skipped).`);
        } else {
          console.error(`  -> Failed to seed "${dept.name}":`, error.message);
        }
      } else {
        console.log(`  -> Successfully seeded "${dept.name}" with ID: ${data[0].id}`);
      }
    }
  }

  console.log("Departments seeding completed successfully!");
}

seed();
