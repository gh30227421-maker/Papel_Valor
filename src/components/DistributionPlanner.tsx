"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { getStockStats } from "@/actions/dashboard";
import LoadingOverlay from "./LoadingOverlay";

export default function DistributionPlanner() {
  // Parámetros de simulación
  const [months, setMonths] = useState<number>(1);
  const [multiplo, setMultiplo] = useState<number>(100);
  const [redondeoActivo, setRedondeoActivo] = useState<boolean>(true);
  const [minimoBlister500, setMinimoBlister500] = useState<boolean>(false);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("TODAS");
  const [statusFilter, setStatusFilter] = useState<"todos" | "critico" | "precaucion" | "saludable">("todos");
  const [onlyWithShipment, setOnlyWithShipment] = useState<boolean>(true);

  // Personalización por agencia
  const [manualOverrides, setManualOverrides] = useState<Record<string, number>>({});
  const [excludedAgencies, setExcludedAgencies] = useState<string[]>([]);

  // Fetcher de datos (reutiliza el RPC fn_stock_dashboard_v2)
  const fetcher = async () => {
    return await getStockStats("");
  };

  const { data: stats, isLoading, isValidating, mutate } = useSWR(["dashboard-stock-planner"], fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true
  });

  const proyeccion = stats?.proyeccion || [];
  const stockBoveda = stats?.stock_boveda || 0;

  // Lista única de regiones para el filtro
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    proyeccion.forEach((item: any) => {
      if (item.region) set.add(item.region);
    });
    return Array.from(set).sort();
  }, [proyeccion]);

  // Cálculos dinámicos por agencia
  const calculatedRows = useMemo(() => {
    return proyeccion.map((item: any) => {
      const cod = item.codigo_agencia;
      const promDiario = item.prom_diario || 0;
      const stockActual = item.stock_actual || 0;
      const diasActuales = item.dias_stock ?? 999;

      // Consumo estimado para N meses con el 20% (esquema del dashboard)
      const consumoEstimado = promDiario > 0 ? Math.round(promDiario * 30 * months * 1.2) : 0;
      
      // Déficit teórico exacto
      const deficitTeorico = promDiario > 0 ? Math.max(0, consumoEstimado - stockActual) : 0;

      // Cálculo sugerido con redondeo
      let sugeridoAuto = deficitTeorico;
      if (redondeoActivo && deficitTeorico > 0) {
        sugeridoAuto = Math.ceil(deficitTeorico / multiplo) * multiplo;
        if (minimoBlister500 && sugeridoAuto < 500) {
          sugeridoAuto = 500;
        }
      }

      // Comprobar si tiene edición manual
      const isManual = manualOverrides[cod] !== undefined;
      const cantidadAsignada = isManual ? manualOverrides[cod] : sugeridoAuto;

      // Exclusión
      const isExcluded = excludedAgencies.includes(cod);
      const cantidadFinal = isExcluded ? 0 : cantidadAsignada;

      // Proyección post-despacho
      const nuevoStock = stockActual + cantidadFinal;
      const nuevosDias = promDiario > 0 ? Math.round(nuevoStock / promDiario) : 999;

      // Blísteres (500 unid.)
      const blistersCompletos = Math.floor(cantidadFinal / 500);
      const residuo = cantidadFinal % 500;

      return {
        ...item,
        promDiario,
        stockActual,
        diasActuales,
        consumoEstimado,
        deficitTeorico,
        sugeridoAuto,
        isManual,
        cantidadAsignada,
        isExcluded,
        cantidadFinal,
        nuevoStock,
        nuevosDias,
        blistersCompletos,
        residuo
      };
    });
  }, [proyeccion, months, multiplo, redondeoActivo, minimoBlister500, manualOverrides, excludedAgencies]);

  // Filtrado de la tabla
  const filteredRows = useMemo(() => {
    return calculatedRows.filter((row: any) => {
      // Búsqueda
      const query = searchQuery.toLowerCase().trim();
      const matchQuery =
        !query ||
        (row.agencia && row.agencia.toLowerCase().includes(query)) ||
        (row.codigo_agencia && row.codigo_agencia.toLowerCase().includes(query)) ||
        (row.region && row.region.toLowerCase().includes(query)) ||
        (row.zona && row.zona.toLowerCase().includes(query));

      if (!matchQuery) return false;

      // Región
      if (regionFilter !== "TODAS" && row.region !== regionFilter) return false;

      // Semáforo inicial
      if (statusFilter === "critico" && row.diasActuales >= 7) return false;
      if (statusFilter === "precaucion" && (row.diasActuales < 7 || row.diasActuales > 15)) return false;
      if (statusFilter === "saludable" && (row.diasActuales <= 15 || row.diasActuales === 999)) return false;

      // Solo con envío
      if (onlyWithShipment && row.cantidadFinal <= 0) return false;

      return true;
    });
  }, [calculatedRows, searchQuery, regionFilter, statusFilter, onlyWithShipment]);

  // KPIs globales
  const kpis = useMemo(() => {
    let totalDespacho = 0;
    let agenciasConEnvio = 0;
    let totalBlisteresCerrados = 0;
    let unidadesFraccionadas = 0;

    calculatedRows.forEach((row: any) => {
      if (row.cantidadFinal > 0) {
        totalDespacho += row.cantidadFinal;
        agenciasConEnvio += 1;
        totalBlisteresCerrados += row.blistersCompletos;
        unidadesFraccionadas += row.residuo;
      }
    });

    const balanceBoveda = stockBoveda - totalDespacho;
    const suficienteBoveda = balanceBoveda >= 0;

    return {
      totalDespacho,
      agenciasConEnvio,
      totalBlisteresCerrados,
      unidadesFraccionadas,
      balanceBoveda,
      suficienteBoveda
    };
  }, [calculatedRows, stockBoveda]);

  // Manejadores de interacción manual
  const handleQuantityChange = (codigo: string, valorStr: string) => {
    const val = parseInt(valorStr, 10);
    if (isNaN(val) || val < 0) {
      setManualOverrides(prev => {
        const next = { ...prev };
        next[codigo] = 0;
        return next;
      });
      return;
    }
    setManualOverrides(prev => ({
      ...prev,
      [codigo]: val
    }));
  };

  const handleResetAgency = (codigo: string) => {
    setManualOverrides(prev => {
      const next = { ...prev };
      delete next[codigo];
      return next;
    });
    setExcludedAgencies(prev => prev.filter(c => c !== codigo));
  };

  const handleToggleExclude = (codigo: string) => {
    setExcludedAgencies(prev => 
      prev.includes(codigo) ? prev.filter(c => c !== codigo) : [...prev, codigo]
    );
  };

  const handleResetAllManual = () => {
    setManualOverrides({});
    setExcludedAgencies([]);
    toast.success("Se restablecieron todos los valores automáticos.");
  };

  // Exportar a Excel
  const handleExportExcel = () => {
    // Tomamos todas las agencias que tengan envío > 0 (o las filtradas si el usuario activó la vista)
    const dataToExport = calculatedRows.filter((r: any) => r.cantidadFinal > 0);

    if (dataToExport.length === 0) {
      toast.error("No hay envíos calculados para exportar en este momento.");
      return;
    }

    const excelRows = dataToExport.map((r: any) => {
      let detalleBlister = "";
      if (r.blistersCompletos > 0 && r.residuo === 0) {
        detalleBlister = `${r.blistersCompletos} Blíster${r.blistersCompletos > 1 ? "es" : ""} cerrado${r.blistersCompletos > 1 ? "s" : ""}`;
      } else if (r.blistersCompletos > 0 && r.residuo > 0) {
        detalleBlister = `${r.blistersCompletos} Blíster${r.blistersCompletos > 1 ? "es" : ""} + ${r.residuo} u.`;
      } else {
        detalleBlister = `${r.residuo} u. (Fracción / Abierto)`;
      }

      return {
        "Código Agencia": r.codigo_agencia,
        "Nombre Agencia": r.agencia,
        "Región": r.region,
        "Zona": r.zona || "—",
        "Stock Actual": r.stockActual,
        "Prom. Diario": r.promDiario,
        "Días Stock Previo": r.diasActuales === 999 ? "Sin Promedio" : r.diasActuales,
        [`Consumo Sugerido (${months}M +20%)`]: r.consumoEstimado,
        "Cantidad a Despachar (TDD)": r.cantidadFinal,
        "Presentación Blíster (500u)": detalleBlister,
        "Stock Post-Despacho": r.nuevoStock,
        "Nueva Cobertura (Días)": r.nuevosDias === 999 ? "—" : r.nuevosDias,
        "Tipo de Asignación": r.isManual ? "Manual (Personalizada)" : "Automática (Calculada)"
      };
    });

    // Fila resumen de totales
    excelRows.push({
      "Código Agencia": "TOTAL GENERAL",
      "Nombre Agencia": `Planificación para ${months} Mes(es) de Cobertura`,
      "Región": "—",
      "Zona": "—",
      "Stock Actual": dataToExport.reduce((acc: number, cur: any) => acc + cur.stockActual, 0),
      "Prom. Diario": dataToExport.reduce((acc: number, cur: any) => acc + cur.promDiario, 0),
      "Días Stock Previo": "—",
      [`Consumo Sugerido (${months}M +20%)`]: dataToExport.reduce((acc: number, cur: any) => acc + cur.consumoEstimado, 0),
      "Cantidad a Despachar (TDD)": kpis.totalDespacho,
      "Presentación Blíster (500u)": `${kpis.totalBlisteresCerrados} Blísteres Cerrados + ${kpis.unidadesFraccionadas} u. Fracción`,
      "Stock Post-Despacho": dataToExport.reduce((acc: number, cur: any) => acc + cur.nuevoStock, 0),
      "Nueva Cobertura (Días)": "—",
      "Tipo de Asignación": `Agencias a Atender: ${dataToExport.length}`
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Ajustar anchos de columnas
    worksheet["!cols"] = [
      { wch: 15 }, // Código
      { wch: 32 }, // Nombre
      { wch: 22 }, // Región
      { wch: 20 }, // Zona
      { wch: 14 }, // Stock Actual
      { wch: 14 }, // Prom. Diario
      { wch: 18 }, // Días Previo
      { wch: 24 }, // Consumo
      { wch: 26 }, // Cantidad Despachar
      { wch: 30 }, // Presentación Blíster
      { wch: 20 }, // Stock Post
      { wch: 22 }, // Nueva Cobertura
      { wch: 24 }  // Tipo
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Distribución ${months}M`);

    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `Plan_Distribucion_TDD_${months}Meses_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    toast.success(`Archivo '${fileName}' exportado exitosamente.`);
  };

  if (isLoading && !stats) {
    return (
      <div className="flex justify-center items-center h-96 w-full">
        <LoadingOverlay fullScreen={false} />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300 font-sans">
      
      {/* =========================================================
          1. BARRA SUPERIOR DE SIMULACIÓN Y CONFIGURACIÓN DINÁMICA
          ========================================================= */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-6">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00205B]"></span>
              <h2 className="text-xl font-black text-[#00205B] tracking-tight">Planificador y Cálculo de Envíos TDD</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Simula requerimientos en base a consumos reales (+20%), redondeo a múltiplos de 100 y empaques en blísteres de 500.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              onClick={handleExportExcel}
              disabled={kpis.totalDespacho === 0}
              className="w-full lg:w-auto px-6 py-2.5 bg-[#009639] hover:bg-[#007a2e] text-white font-black text-sm rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar Distribución a Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* PARÁMETROS DINÁMICOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
          
          {/* Selector de Meses de Cobertura */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Rango de Cobertura Objetivo
            </label>
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              {[1, 2, 3].map(m => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={`flex-1 py-1.5 text-xs font-black rounded-md transition-all ${
                    months === m
                      ? "bg-[#00205B] text-white shadow-sm"
                      : "text-gray-600 hover:text-[#00205B] hover:bg-white/60"
                  }`}
                >
                  {m} {m === 1 ? "Mes" : "Meses"} ({m * 30}d)
                </button>
              ))}
            </div>
          </div>

          {/* Múltiplo de Redondeo */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Redondeo Dinámico
              </label>
              <button
                onClick={() => setRedondeoActivo(!redondeoActivo)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  redondeoActivo ? "bg-green-100 text-green-700 font-black" : "bg-gray-200 text-gray-500"
                }`}
              >
                {redondeoActivo ? "ACTIVO" : "DESACTIVADO"}
              </button>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              {[50, 100, 250, 500].map(mult => (
                <button
                  key={mult}
                  disabled={!redondeoActivo}
                  onClick={() => setMultiplo(mult)}
                  className={`flex-1 py-1.5 text-xs font-black rounded-md transition-all ${
                    redondeoActivo && multiplo === mult
                      ? "bg-[#FE5000] text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900 disabled:opacity-40"
                  }`}
                >
                  +{mult}
                </button>
              ))}
            </div>
          </div>

          {/* Regla de Blíster Mínimo (500) */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Lote Mínimo de Blíster
            </label>
            <button
              onClick={() => setMinimoBlister500(!minimoBlister500)}
              className={`w-full py-2 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                minimoBlister500 
                  ? "bg-blue-50 border-[#00205B] text-[#00205B] shadow-sm" 
                  : "bg-white border-gray-300 text-gray-600 hover:border-gray-400"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${minimoBlister500 ? "bg-[#00205B]" : "bg-gray-300"}`}></span>
                Mínimo 500 (1 Blíster cerrado)
              </span>
              <span className="text-[10px] font-mono">{minimoBlister500 ? "SI" : "NO"}</span>
            </button>
          </div>

          {/* Botón Restaurar Valores Automáticos */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Ajustes Manuales ({Object.keys(manualOverrides).length + excludedAgencies.length})
            </label>
            <button
              onClick={handleResetAllManual}
              disabled={Object.keys(manualOverrides).length === 0 && excludedAgencies.length === 0}
              className="w-full py-2 px-3 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Restablecer Valores Auto
            </button>
          </div>

        </div>

      </div>

      {/* =========================================================
          2. TARJETAS KPI DE RESUMEN Y BALANCE DE BÓVEDA
          ========================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* TOTAL A DESPACHAR */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex justify-between items-start">
          <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">VOLUMEN TOTAL A ENVIAR</h3>
            <p className="text-3xl font-black text-[#00205B] leading-none">
              {kpis.totalDespacho.toLocaleString("es-VE")}
            </p>
            <p className="text-[11px] font-semibold text-gray-500 mt-2">
              Plásticos TDD para {months} {months === 1 ? "mes" : "meses"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#00205B] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
        </div>

        {/* LOGÍSTICA DE BLÍSTERES */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex justify-between items-start">
          <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">EMPAQUE EN BLÍSTERES (500U)</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#FE5000] leading-none">{kpis.totalBlisteresCerrados}</span>
              <span className="text-xs font-bold text-gray-500">Cerrados</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              {kpis.unidadesFraccionadas > 0 ? (
                <span className="text-amber-600 font-bold">⚠️ +{kpis.unidadesFraccionadas.toLocaleString("es-VE")} unid. fraccionadas</span>
              ) : (
                <span className="text-green-600 font-bold">✅ 100% Blísteres completos</span>
              )}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#FE5000] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
        </div>

        {/* AGENCIAS ATENDIDAS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex justify-between items-start">
          <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">AGENCIAS A ATENDER</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#009639] leading-none">{kpis.agenciasConEnvio}</span>
              <span className="text-xs font-bold text-gray-400">/ {proyeccion.length} total</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-2 font-semibold">
              {((kpis.agenciasConEnvio / (proyeccion.length || 1)) * 100).toFixed(1)}% de la red requiere envío
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-green-50 text-[#009639] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
        </div>

        {/* BALANCE VS BÓVEDA CENTRAL */}
        <div className={`rounded-xl shadow-sm border p-5 flex justify-between items-start ${
          kpis.suficienteBoveda ? "bg-white border-gray-200" : "bg-red-50/50 border-red-200"
        }`}>
          <div>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">BÓVEDA CENTRAL (CÓD 95)</h3>
            <p className="text-3xl font-black text-[#0B132B] leading-none">
              {stockBoveda.toLocaleString("es-VE")}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${kpis.suficienteBoveda ? "bg-green-500" : "bg-red-500 animate-pulse"}`}></span>
              <p className={`text-[11px] font-black ${kpis.suficienteBoveda ? "text-green-700" : "text-red-700"}`}>
                {kpis.suficienteBoveda 
                  ? `Suficiente (Restante: ${kpis.balanceBoveda.toLocaleString("es-VE")})`
                  : `Déficit en Bóveda (${Math.abs(kpis.balanceBoveda).toLocaleString("es-VE")})`
                }
              </p>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            kpis.suficienteBoveda ? "bg-teal-50 text-teal-600" : "bg-red-100 text-red-600"
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
        </div>

      </div>

      {/* =========================================================
          3. TABLA DINÁMICA DE DISTRIBUCIÓN
          ========================================================= */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        
        {/* Cabecera oscura con controles de búsqueda y filtros */}
        <div className="p-5 bg-[#0B132B] text-white flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center gap-4">
          <div>
            <h3 className="text-base font-black tracking-wide">Cálculo de Envíos por Agencia</h3>
            <p className="text-[11px] text-gray-300 mt-0.5">
              Haz clic en la columna &quot;A Enviar&quot; para ajustar cantidades personalizadas. Los cambios son instantáneos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full 2xl:w-auto">
            {/* Buscador */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Buscar agencia o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A2645] border border-gray-700 text-white placeholder-gray-400 text-xs font-semibold rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block p-2.5 pl-8 outline-none"
              />
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            </div>

            {/* Filtro por Región */}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-[#1A2645] border border-gray-700 text-white text-xs font-bold rounded-lg p-2.5 outline-none cursor-pointer min-w-[170px]"
            >
              <option value="TODAS">Todas las Regiones</option>
              {availableRegions.map(reg => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>

            {/* Filtro por Estatus */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#1A2645] border border-gray-700 text-white text-xs font-bold rounded-lg p-2.5 outline-none cursor-pointer min-w-[170px]"
            >
              <option value="todos">Todos los Estatus</option>
              <option value="critico">Estatus: Crítico (&lt; 7 días)</option>
              <option value="precaucion">Estatus: Precaución (7-15 días)</option>
              <option value="saludable">Estatus: Saludable (&gt; 15 días)</option>
            </select>

            {/* Toggle Solo con Envío */}
            <button
              onClick={() => setOnlyWithShipment(!onlyWithShipment)}
              className={`px-4 py-2.5 rounded-lg text-xs font-black transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                onlyWithShipment 
                  ? "bg-[#FE5000] text-white shadow-md hover:bg-[#e04800]" 
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onlyWithShipment ? "bg-white" : "bg-gray-400"}`}></span>
              Solo con Envío &gt; 0
            </button>
          </div>
        </div>

        {/* Tabla Responsive Ampliada */}
        <div className="overflow-x-auto max-h-[650px] custom-scrollbar">
          {filteredRows.length > 0 ? (
            <table className="w-full text-left border-collapse min-w-[1100px]">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                <tr>
                  <th className="py-4 px-4 text-[11px] font-black text-gray-500 uppercase tracking-wider w-14 text-center">Inc.</th>
                  <th className="py-4 px-5 text-[11px] font-black text-gray-500 uppercase tracking-wider min-w-[240px]">Agencia</th>
                  <th className="py-4 px-5 text-[11px] font-black text-gray-500 uppercase tracking-wider text-right">Stock Actual</th>
                  <th className="py-4 px-5 text-[11px] font-black text-gray-500 uppercase tracking-wider text-right">Prom. Diario</th>
                  <th className="py-4 px-5 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">Días Actuales</th>
                  <th className="py-4 px-6 text-[11px] font-black text-[#00205B] uppercase tracking-wider text-right bg-blue-50/50">
                    Consumo {months}M (+20%)
                  </th>
                  <th className="py-4 px-5 text-[11px] font-black text-[#FE5000] uppercase tracking-wider text-center bg-orange-50/50 w-48">
                    A Enviar (TDD) ✏️
                  </th>
                  <th className="py-4 px-5 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center min-w-[170px]">
                    Blísteres (500u)
                  </th>
                  <th className="py-4 px-5 text-[11px] font-black text-[#009639] uppercase tracking-wider text-center bg-green-50/40 min-w-[150px]">
                    Cobertura Resultante
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-semibold">
                {filteredRows.map((row: any) => {
                  let statusBadge = "bg-green-50 text-green-700 border-green-200";
                  let dotColor = "bg-green-500";
                  if (row.diasActuales < 7) {
                    statusBadge = "bg-red-50 text-red-700 border-red-200";
                    dotColor = "bg-red-500 animate-pulse";
                  } else if (row.diasActuales <= 15) {
                    statusBadge = "bg-yellow-50 text-yellow-700 border-yellow-200";
                    dotColor = "bg-yellow-400";
                  }

                  let resBadge = "bg-green-50 text-green-700 border-green-200";
                  if (row.nuevosDias < 7) resBadge = "bg-red-50 text-red-700 border-red-200";
                  else if (row.nuevosDias <= 15) resBadge = "bg-yellow-50 text-yellow-700 border-yellow-200";

                  return (
                    <tr 
                      key={row.codigo_agencia}
                      className={`hover:bg-blue-50/30 transition-colors ${
                        row.isExcluded ? "opacity-40 bg-gray-50" : ""
                      }`}
                    >
                      {/* Checkbox de Exclusión */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={!row.isExcluded}
                          onChange={() => handleToggleExclude(row.codigo_agencia)}
                          className="w-4 h-4 text-[#00205B] rounded border-gray-300 focus:ring-[#00205B] cursor-pointer"
                          title={row.isExcluded ? "Incluir en despacho" : "Excluir de despacho"}
                        />
                      </td>

                      {/* Agencia */}
                      <td className="py-3.5 px-5">
                        <p className="font-black text-[#0B132B] text-sm">{row.agencia}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          COD: <span className="font-mono font-bold text-gray-600">{row.codigo_agencia}</span> | {row.region} {row.zona ? `• ${row.zona}` : ""}
                        </p>
                      </td>

                      {/* Stock Actual */}
                      <td className="py-3.5 px-5 text-right font-black text-gray-800 text-sm">
                        {row.stockActual.toLocaleString("es-VE")}
                      </td>

                      {/* Promedio Diario */}
                      <td className="py-3.5 px-5 text-right text-gray-600">
                        <span className="font-bold">{row.promDiario.toLocaleString("es-VE")}</span> <span className="text-[10px] text-gray-400 font-normal">/ d</span>
                      </td>

                      {/* Días Actuales */}
                      <td className="py-3.5 px-5">
                        <div className="flex justify-center">
                          <span className={`px-3 py-1 rounded-full border text-[11px] font-black flex items-center gap-1.5 shadow-xs ${statusBadge}`}>
                            <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                            {row.diasActuales === 999 ? "Sin Prom." : `${row.diasActuales} d`}
                          </span>
                        </div>
                      </td>

                      {/* Consumo N Meses */}
                      <td className="py-3.5 px-6 text-right bg-blue-50/20 font-black text-sm text-[#00205B]">
                        {row.consumoEstimado.toLocaleString("es-VE")}
                      </td>

                      {/* Cantidad a Enviar (Editable) */}
                      <td className="py-3 px-5 text-center bg-orange-50/20">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={row.cantidadFinal}
                            onChange={(e) => handleQuantityChange(row.codigo_agencia, e.target.value)}
                            disabled={row.isExcluded}
                            className={`w-28 text-center font-black text-base py-1.5 px-3 rounded-lg border-2 transition-all outline-none ${
                              row.isManual
                                ? "border-[#FE5000] bg-orange-50 text-[#FE5000] shadow-sm font-black ring-2 ring-[#FE5000]/20"
                                : row.cantidadFinal > 0
                                ? "border-gray-300 focus:border-[#00205B] bg-white text-[#0B132B] shadow-sm"
                                : "border-gray-200 bg-gray-50 text-gray-400"
                            }`}
                          />
                          {row.isManual && (
                            <button
                              onClick={() => handleResetAgency(row.codigo_agencia)}
                              title="Restablecer al cálculo automático"
                              className="text-xs bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full w-6 h-6 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Blísteres (500u) */}
                      <td className="py-3.5 px-5 text-center">
                        {row.cantidadFinal > 0 ? (
                          row.blistersCompletos > 0 && row.residuo === 0 ? (
                            <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-md inline-block shadow-xs">
                              📦 {row.blistersCompletos} {row.blistersCompletos === 1 ? "Blíster" : "Blísteres"}
                            </span>
                          ) : row.blistersCompletos > 0 && row.residuo > 0 ? (
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md inline-block shadow-xs">
                              📦 {row.blistersCompletos} Blíster + {row.residuo} u.
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md inline-block shadow-xs">
                              ⚠️ {row.residuo} u. (Fracción)
                            </span>
                          )
                        ) : (
                          <span className="text-gray-300 font-normal text-sm">—</span>
                        )}
                      </td>

                      {/* Cobertura Resultante */}
                      <td className="py-3.5 px-5 bg-green-50/10">
                        <div className="flex flex-col items-center justify-center">
                          <span className={`px-2.5 py-1 rounded-md border text-xs font-black shadow-xs ${resBadge}`}>
                            {row.nuevosDias === 999 ? "—" : `${row.nuevosDias} Días`}
                          </span>
                          <span className="text-[10px] font-semibold text-gray-500 mt-1">
                            Stock: {row.nuevoStock.toLocaleString("es-VE")}
                          </span>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="font-bold text-sm text-gray-600">No se encontraron agencias con los filtros actuales.</p>
              <p className="text-xs text-gray-400 mt-1">Prueba desactivando el filtro &apos;Solo con Envío &gt; 0&apos; o cambiando el rango de búsqueda.</p>
            </div>
          )}
        </div>

        {/* Footer con Resumen de la tabla visible */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500 gap-2">
          <div>
            Mostrando <span className="font-black text-[#0B132B]">{filteredRows.length}</span> agencias de un total de <span className="font-black text-[#0B132B]">{proyeccion.length}</span>.
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Estatus: Crítico (&lt; 7d)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400"></span> Estatus: Precaución (7-15d)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span> Estatus: Saludable (&gt; 15d)</span>
          </div>
        </div>

      </div>

    </div>
  );
}
