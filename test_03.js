const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim();
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function check() {
  console.log("Checking table 'asignaciones'...");
  const { data: data1, error: err1 } = await supabase
    .from('asignaciones')
    .select('fecha_cod')
    .eq('fecha_cod', '2026-10-03')
    .limit(5);
  console.log("Table asignaciones count:", data1?.length, err1);

  console.log("Checking view 'vw_asignaciones_agencias'...");
  const { data: data2, error: err2 } = await supabase
    .from('vw_asignaciones_agencias')
    .select('fecha_cod')
    .eq('fecha_cod', '2026-10-03')
    .limit(5);
  console.log("View vw_asignaciones_agencias count:", data2?.length, err2);
  
  console.log("What is the latest date in the view?");
  const { data: data3 } = await supabase
    .from('vw_asignaciones_agencias')
    .select('fecha_cod')
    .order('fecha_cod', { ascending: false })
    .limit(1);
  console.log("Latest date in view:", data3);
}

check();
