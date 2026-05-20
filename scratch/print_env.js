import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
console.log("All Process Env keys:", Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('DB') || k.includes('POSTGRES') || k.includes('KEY') || k.includes('URL')));
console.log("DATABASE_URL:", process.env.DATABASE_URL);
console.log("DIRECT_URL:", process.env.DIRECT_URL);
console.log("PGPASSWORD:", process.env.PGPASSWORD);
