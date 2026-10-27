'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// Genera variantes del código de agencia para tolerar ceros a la izquierda (ej: "020" y "20")
function getAgencyCodeCandidates(rawCode: string): string[] {
  const trimmed = rawCode.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>();
  candidates.add(trimmed);

  // Sin ceros a la izquierda (ej: "020" -> "20", "005" -> "5")
  const noLeadingZeros = trimmed.replace(/^0+/, '') || '0';
  candidates.add(noLeadingZeros);

  // Si es numérico, generar también con formato de 2, 3 y 4 dígitos
  if (/^\d+$/.test(noLeadingZeros)) {
    const num = parseInt(noLeadingZeros, 10);
    candidates.add(String(num));
    candidates.add(String(num).padStart(2, '0'));
    candidates.add(String(num).padStart(3, '0'));
    candidates.add(String(num).padStart(4, '0'));
  }

  return Array.from(candidates);
}

export async function verifyDispatch(codigoAgencia: string, correlativoInicial: string, correlativoFinal: string) {
  const candidates = getAgencyCodeCandidates(codigoAgencia);
  const corrIni = correlativoInicial.replace(/\D/g, '') || correlativoInicial.trim();
  const corrFin = correlativoFinal.replace(/\D/g, '') || correlativoFinal.trim();

  if (candidates.length === 0 || !corrIni || !corrFin) {
    return { success: false, message: 'Por favor complete todos los campos requeridos.' };
  }

  // Buscar sin importar el estatus, aceptando el código con o sin ceros a la izquierda
  const { data, error } = await supabase
    .from('despachos')
    .select(`
      id,
      codigo_agencia,
      cantidad,
      correlativo_inicial,
      correlativo_final,
      estatus_entrega,
      agencias (nombre)
    `)
    .in('codigo_agencia', candidates)
    .eq('correlativo_inicial', corrIni)
    .eq('correlativo_final', corrFin)
    .limit(1);

  if (error || !data || data.length === 0) {
    return { success: false, message: 'No se encontró un envío con esos datos. Verifique el código y ambos correlativos.' };
  }

  const despacho = data[0];

  // Si no se obtuvo el nombre de la agencia por la relación FK (por ej. por diferencia de padding en agencias.codigo),
  // buscamos directamente en la tabla agencias con los candidatos
  if (!despacho.agencias || !despacho.agencias.nombre) {
    const { data: agData } = await supabase
      .from('agencias')
      .select('nombre')
      .in('codigo', candidates)
      .limit(1);

    if (agData && agData.length > 0) {
      despacho.agencias = { nombre: agData[0].nombre };
    }
  }

  // Verificar el estatus
  if (despacho.estatus_entrega !== 'En Tránsito') {
    return { success: false, message: `El envío se encuentra en estatus: ${despacho.estatus_entrega || 'Desconocido (NULL)'}. Solo se pueden procesar envíos 'En Tránsito'.` };
  }

  return { success: true, data: despacho };
}

export async function confirmDispatch(despachoId: number | string, recibidoPor: string, observaciones: string) {
  const { error } = await supabase
    .from('despachos')
    .update({
      estatus_entrega: 'Recibido',
      fecha_recepcion: new Date().toISOString(),
      recibido_por: recibidoPor.trim(),
      observaciones_recepcion: observaciones.trim() || null
    })
    .eq('id', despachoId);

  if (error) {
    return { success: false, message: 'Hubo un error al confirmar la recepción. Intente nuevamente.' }
  }

  return { success: true }
}
