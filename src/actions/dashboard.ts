"use server";

import { createClient } from "@supabase/supabase-js";
import { getStockCustodia } from "./custodia";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const mapIntFilter = (arr?: string[] | string) => {
  if (!arr) return null;
  const array = Array.isArray(arr) ? arr : [arr];
  if (array.some(x => x === "Todos" || x === "Todas" || x === "")) return null;
  if (array.length === 0) return [-1];
  return array.map(x => parseInt(x));
};

const mapTextFilter = (arr?: string[] | string) => {
  if (!arr) return null;
  const array = Array.isArray(arr) ? arr : [arr];
  if (array.some(x => x === "Todos" || x === "Todas" || x === "")) return null;
  if (array.length === 0) return ["__NONE__"];
  return array;
};

export async function getDashboardStats(filters: { year?: string | string[]; month?: string | string[]; day?: string | string[]; region?: string | string[]; agencia?: string | string[] } = {}) {
  const p_years = mapIntFilter(filters.year);
  const p_months = mapIntFilter(filters.month);
  const p_days = mapIntFilter(filters.day);
  const p_regions = mapTextFilter(filters.region);
  const p_agencias = mapTextFilter(filters.agencia);

  const { data, error } = await supabase.rpc("fn_dashboard_stats_v7", {
    p_years,
    p_months,
    p_days,
    p_regions,
    p_agencias
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
  let rpcResult: any = null;
  let custodiaResult: any = null;

  try {
    [rpcResult, custodiaResult] = await Promise.all([
      supabase.rpc("fn_stock_dashboard_v2", {
        p_region: region || null
      }),
      getStockCustodia()
    ]);
  } catch (e) {
    console.warn("Fallo inicial en getStockStats, reintentando...", e);
  }

  // Si falló el RPC (por timeout momentáneo o bloqueo de tabla), reintentar de inmediato
  if (!rpcResult || rpcResult.error || !rpcResult.data) {
    console.warn("Reintentando llamada a fn_stock_dashboard_v2...");
    rpcResult = await supabase.rpc("fn_stock_dashboard_v2", {
      p_region: region || null
    });
  }

  const { data, error } = rpcResult || {};

  if (error || !data) {
    console.error("Error al cargar KPIs de stock:", error);
    const custodiaQty = custodiaResult?.cantidad || 0;
    return {
      stock_boveda: custodiaQty,
      stock_boveda_sistema: 0,
      stock_custodia: custodiaQty,
      stock_nomina: 0,
      stock_agencias: 0,
      stock_global: custodiaQty,
      top_agencias: [],
      regiones: [],
      estados: [],
      proyeccion: []
    };
  }

  // Si el RPC ya incluye stock_custodia, lo respetamos; de lo contrario sumamos la custodia manual
  const custodiaQty = typeof data.stock_custodia === "number" ? data.stock_custodia : (custodiaResult?.cantidad || 0);
  const bovedaSistema = typeof data.stock_boveda_sistema === "number" ? data.stock_boveda_sistema : data.stock_boveda;

  // Si no hay filtro de región o es TODAS, la custodia se suma a Bóveda y al Stock Global
  const isGlobalOrAll = !region || region.toUpperCase() === "TODAS";
  const bovedaTotal = isGlobalOrAll ? (bovedaSistema + custodiaQty) : bovedaSistema;
  const globalTotal = isGlobalOrAll 
    ? ((data.stock_global || 0) + (typeof data.stock_custodia === "number" ? 0 : custodiaQty)) 
    : data.stock_global;

  return {
    ...data,
    stock_boveda: bovedaTotal,
    stock_boveda_sistema: bovedaSistema,
    stock_custodia: custodiaQty,
    stock_global: globalTotal,
  };
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
export async function getMonthlyPivot(filters: { year?: string | string[]; region?: string | string[]; agencia?: string | string[] } = {}) {
  const p_years = mapIntFilter(filters.year);
  const p_regions = mapTextFilter(filters.region);
  const p_agencias = mapTextFilter(filters.agencia);

  const { data, error } = await supabase.rpc("fn_dashboard_monthly_pivot_v7", {
    p_years,
    p_regions,
    p_agencias
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
