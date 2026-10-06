const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const URL = urlMatch[1].trim();
const KEY = keyMatch[1].trim();

async function test() {
  const res = await fetch(`${URL}/rest/v1/rpc/fn_refresh_dashboard_mv`, {
    method: 'POST',
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!res.ok) {
    const error = await res.json();
    console.log('RPC Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('RPC Success');
  }
}

test();
