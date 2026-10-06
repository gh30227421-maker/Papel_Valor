const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function test() {
  // Try to read view definition via postgrest if possible, but PostgREST doesn't expose system catalogs easily.
  // Instead, let's use the REST API to query 2026-09 data from the table WITH the exact conditions of the view!
  const res = await fetch(`${URL}/rest/v1/asignaciones_diarias?fecha_cod=gte.2026-09-01&fecha_cod=lt.2026-10-01&tdd_nueva=not.is.null&tdd_nueva=neq.&transaccion=in.(511,518,522,570,523)&select=*&limit=5`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
  });
  const data = await res.json();
  console.log('Test with conditions:', data);
}
test();
