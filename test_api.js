const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const URL = urlMatch[1].trim();
const KEY = keyMatch[1].trim();

async function test() {
  // Test if the card exists
  const res = await fetch(`${URL}/rest/v1/stock_actual?correlativo=eq.5410360245199600&select=*,agencias(*)`, {
    headers: {
      'apikey': KEY,
      'Authorization': `Bearer ${KEY}`
    }
  });
  const data = await res.json();
  console.log('stock_actual data:', JSON.stringify(data, null, 2));
}

test();
