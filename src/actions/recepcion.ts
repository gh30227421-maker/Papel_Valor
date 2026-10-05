'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function verifyDispatch(codigoAgencia: string, correlativoInicial: string, correlativoFinal: string) {
  const cod = codigoAgencia.trim();
  const corrIni = correlativoInicial.trim();
  const corrFin = correlativoFinal.trim();

  // Buscar sin importar el estatus
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
    .eq('codigo_agencia', cod)
    .eq('correlativo_inicial', corrIni)
    .eq('correlativo_final', corrFin)
    .single();

  if (error || !data) {
    return { success: false, message: 'No se encontró un envío con esos datos. Verifique el código y ambos correlativos.' }
  }

  // Verificar el estatus
  if (data.estatus_entrega !== 'En Tránsito') {
    return { success: false, message: `El envío se encuentra en estatus: ${data.estatus_entrega || 'Desconocido (NULL)'}. Solo se pueden procesar envíos 'En Tránsito'.` }
  }

  return { success: true, data }
}

export async function confirmDispatch(despachoId: number, recibidoPor: string, observaciones: string) {
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
