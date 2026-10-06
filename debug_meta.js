const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function test() {
  const res = await fetch(`${URL}/rest/v1/dashboard_metadata?select=*`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
  });
  const data = await res.json();
  console.log('Metadata:', data);
}
test();
