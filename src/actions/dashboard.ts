"use server";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getDashboardStats(filters: { year?: string; month?: string; region?: string; agencia?: string } = {}) {
  // Convertimos los parámetros para el RPC. Null explícito para parámetros vacíos.
  const p_year = filters.year && filters.year !== "Todos" ? parseInt(filters.year) : null;
  const p_month = filters.month && filters.month !== "Todos" ? parseInt(filters.month) : null;
  const p_region = filters.region && filters.region !== "Todas" ? filters.region : null;
  const p_agencia = filters.agencia ? filters.agencia : null;

  const { data, error } = await supabase.rpc("fn_dashboard_stats_v6", {
    p_year,
    p_month,
    p_region,
    p_agencia
  });

  if (error) {
    console.error("Error al cargar KPIs del dashboard:", error);
    return {
      total: 0,
      promedio_diario: 0,
      transacciones: [],
      top_agencias: [],
      regiones: [],
      estados: []
    };
  }

  return data;
}

export async function getStockStats(region: string = "") {
  const { data, error } = await supabase.rpc("fn_stock_dashboard_v2", {
    p_region: region || null
  });

  if (error) {
    console.error("Error al cargar KPIs de stock:", error);
    return {
      stock_boveda: 0,
      stock_nomina: 0,
      stock_agencias: 0,
      stock_global: 0,
      top_agencias: [],
      regiones: [],
      estados: [],
      proyeccion: []
    };
  }

  return data;
}

export async function getFiltrosBasicos() {
  const { data, error } = await supabase.rpc("fn_get_filtros_basicos");

  if (error || !data) {
    console.error("Error cargando filtros básicos:", error);
    return { years: [], regions: [], agencias: [] };
  }

  // data.years contendrá solo los años que realmente existen en la BD (ej. ["2025"])
  // Ordenamos los años de mayor a menor
  const yearsSorted = (data.years || []).sort().reverse();
  const regionsSorted = (data.regions || []).sort();

  return {
    years: yearsSorted,
    regions: regionsSorted,
    agencias: data.agencias || []
  };
}
export async function getMonthlyPivot(filters: { year?: string; region?: string; agencia?: string } = {}) {
  const p_year = filters.year && filters.year !== "Todos" ? parseInt(filters.year) : null;
  const p_region = filters.region && filters.region !== "Todas" ? filters.region : null;
  const p_agencia = filters.agencia ? filters.agencia : null;

  const { data, error } = await supabase.rpc("fn_dashboard_monthly_pivot", {
    p_year,
    p_region,
    p_agencia
  });

  if (error) {
    console.error("Error al cargar pivot mensual:", error);
    return [];
  }

  // Agrupar por mes en memoria
  const monthsData: Record<number, any> = {};
  for (let i = 1; i <= 12; i++) {
    monthsData[i] = { mes: i, primeraVez: 0, reposicion: 0, migracionBNC: 0, migracionBOD: 0, pensionado: 0, total: 0 };
  }

  // El RPC devuelve un array de objetos { mes, transaccion, total_asignaciones }
  if (Array.isArray(data)) {
    data.forEach((row: any) => {
      const m = row.mes;
      const t = row.transaccion;
      const val = row.total_asignaciones;

      if (monthsData[m]) {
        if (t === '511') monthsData[m].primeraVez += val;
        else if (t === '518') monthsData[m].reposicion += val;
        else if (t === '522') monthsData[m].migracionBNC += val;
        else if (t === '570') monthsData[m].migracionBOD += val;
        else if (t === '523') monthsData[m].pensionado += val;
        else monthsData[m].pensionado += val;

        monthsData[m].total += val;
      }
    });
  }

  return Object.values(monthsData).sort((a: any, b: any) => a.mes - b.mes);
}

export async function getDashboardLastUpdate() {
  const { data, error } = await supabase.from("dashboard_metadata").select("last_refresh").eq("id", 1).single();
  if (error || !data) return null;
  return data.last_refresh;
}

export async function forceRefreshDashboard() {
  const { error } = await supabase.rpc("fn_refresh_dashboard_mv");
  if (error) {
    console.error("Error refreshing dashboard:", error);
    return false;
  }
  return true;
}
