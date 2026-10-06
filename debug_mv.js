const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function test() {
  const res = await fetch(`${URL}/rest/v1/mv_dashboard_summary?mes=eq.9&anio=eq.2026&select=*&limit=5`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
  });
  const data = await res.json();
  console.log('2026 Sept in MV:', data);
  
  const res2 = await fetch(`${URL}/rest/v1/asignaciones_diarias?fecha_cod=gte.2026-09-01&fecha_cod=lt.2026-10-01&select=*&limit=5`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
  });
  const data2 = await res2.json();
  console.log('2026 Sept in Table:', data2);
}
test();
