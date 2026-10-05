"use server";

import { createClient } from "@supabase/supabase-js";

// Inicializamos un cliente de Supabase seguro para el servidor
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getAsignacionesPaginated(
  page: number, 
  pageSize: number,
  filters: { search?: string; estado?: string; fechaInicio?: string; fechaFin?: string }
) {
  // Calculamos los offsets para la paginación
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  // Consultamos a la VISTA vw_asignaciones_agencias (que hace el LEFT JOIN seguro)
  let query = supabase
    .from("vw_asignaciones_agencias")
    .select("*", { count: "exact" });

  // Aplicar filtros dinámicos si existen
  if (filters.search) {
    // Buscamos por código de agencia o por nombre de agencia (si la vista lo trae)
    query = query.or(`codigo_agencia.ilike.%${filters.search}%,agencia_nombre.ilike.%${filters.search}%`);
  }
  if (filters.estado) {
    query = query.eq("agencia_estado", filters.estado);
  }
  if (filters.fechaInicio) {
    query = query.gte("fecha_cod", filters.fechaInicio);
  }
  if (filters.fechaFin) {
    query = query.lte("fecha_cod", filters.fechaFin);
  }

  // Ordenamos por fecha descendente y paginamos
  const { data, error, count } = await query
    .order("fecha_cod", { ascending: false })
    .range(start, end);

  if (error) {
    console.error("Error fetching asignaciones:", error);
    throw new Error("Error al obtener los datos del servidor.");
  }

  return {
    data,
    totalRows: count || 0,
    totalPages: count ? Math.ceil(count / pageSize) : 0,
  };
}

export async function getEstadosActivos() {
  const { data, error } = await supabase
    .from("agencias")
    .select("estado")
    .not("estado", "is", null);

  if (error) return [];
  
  // Extraemos estados únicos
  const uniqueEstados = Array.from(new Set(data.map((a: any) => a.estado))).sort();
  return uniqueEstados;
}
