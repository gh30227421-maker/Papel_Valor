const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function test() {
  const start = Date.now();
  console.log('Calling fn_refresh_dashboard_mv...');
  const res = await fetch(`${URL}/rest/v1/rpc/fn_refresh_dashboard_mv`, {
    method: 'POST',
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
  });
  const duration = (Date.now() - start) / 1000;
  
  if (!res.ok) {
    const error = await res.text();
    console.log(`Failed after ${duration}s:`, error);
  } else {
    console.log(`Success after ${duration}s`);
  }
}
test();
