"use client";

import React, { useEffect, useState, useMemo } from "react";
import LoadingOverlay from "./LoadingOverlay";
import { getDashboardStats, getFiltrosBasicos, getMonthlyPivot, getDashboardLastUpdate, forceRefreshDashboard } from "@/actions/dashboard";
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from "recharts";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { Tooltip } from "react-tooltip";
import CustomSelect from "./ui/CustomSelect";
import geoUrl from "../../public/venezuela.json";

const TDD_NAMES: Record<string, string> = {
  "511": "Primera Vez",
  "518": "Reposición",
  "522": "Migración BNC",
  "570": "Migración BOD",
  "523": "TDD Pensionado"
};

const CHART_COLORS = ["#00205B", "#FE5000", "#009639", "#F59E0B", "#8B5CF6"];

const normalizeString = (str: string) => str ? str.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toUpperCase() : "";

const REGION_MAPPING: Record<string, string> = {
  "ARAGUA": "ARAGUA - LOS LLANOS",
  "GUARICO": "ARAGUA - LOS LLANOS",
  "APURE": "ARAGUA - LOS LLANOS",
  "MERIDA": "OCCIDENTE - ANDES",
  "TACHIRA": "OCCIDENTE - ANDES",
  "ZULIA": "OCCIDENTE - ANDES",
  "FALCON": "OCCIDENTE - ANDES",
  "TRUJILLO": "OCCIDENTE - ANDES",
  "CARABOBO": "CENTRO OCCIDENTE",
  "BARINAS": "CENTRO OCCIDENTE",
  "LARA": "CENTRO OCCIDENTE",
  "YARACUY": "CENTRO OCCIDENTE",
  "COJEDES": "CENTRO OCCIDENTE",
  "PORTUGUESA": "CENTRO OCCIDENTE",
  "MIRANDA": "CAPITAL",
  "LA GUAIRA": "CAPITAL",
  "DISTRITO CAPITAL": "CAPITAL",
  "ANZOATEGUI": "ORIENTE",
  "SUCRE": "ORIENTE",
  "NUEVA ESPARTA": "ORIENTE",
  "BOLIVAR": "ORIENTE",
  "MONAGAS": "ORIENTE",
  "DELTA AMACURO": "ORIENTE"
};

export default function DashboardStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Catálogos para filtros
  const [catYears, setCatYears] = useState<string[]>([]);
  const [catRegions, setCatRegions] = useState<string[]>([]);
  const [catAgencias, setCatAgencias] = useState<any[]>([]);

  // Filtros Seleccionados
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedMonth, setSelectedMonth] = useState<string>("Todos");
  const [selectedRegion, setSelectedRegion] = useState<string>("Todas");
  const [selectedEstado, setSelectedEstado] = useState<string>("Todos");
  const [selectedAgencia, setSelectedAgencia] = useState<string>("");
  const [mapTab, setMapTab] = useState<"estados" | "regiones">("estados");
  const [pivotData, setPivotData] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [data, pivot, lastUpdateData] = await Promise.all([
      getDashboardStats({
        year: selectedYear,
        month: selectedMonth,
        region: selectedRegion,
        agencia: selectedAgencia
      }),
      getMonthlyPivot({
        year: selectedYear,
        region: selectedRegion,
        agencia: selectedAgencia
      }),
      getDashboardLastUpdate()
    ]);
    setStats(data);
    setPivotData(pivot);
    setLastUpdate(lastUpdateData);
    setLoading(false);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    const success = await forceRefreshDashboard();
    if (success) {
      await loadData();
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    getFiltrosBasicos().then((cats) => {
      setCatYears(["Todos", ...cats.years]);
      setCatRegions(["Todas", ...cats.regions]);
      setCatAgencias(cats.agencias);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, selectedRegion, selectedEstado, selectedAgencia]);

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-96 w-full">
        <LoadingOverlay fullScreen={false} />
      </div>
    );
  }

  // Cálculos para las tarjetas KPI
  const totalTDD = stats?.total || 0;
  const promedioDiario = stats?.promedio_diario || 0;
  
  const findTrans = (code: string) => stats?.transacciones?.find((t: any) => t.name === code)?.value || 0;
  const primeraVez = findTrans("511");
  const migraciones = findTrans("522") + findTrans("570");
  const reposiciones = findTrans("518");

  // Preparar Data para Top 5 Estados/Regiones
  const estadosData = [...(stats?.estados || [])].sort((a: any, b: any) => b.value - a.value);
  const regionesData = [...(stats?.regiones || [])].sort((a: any, b: any) => b.value - a.value);
  
  const top5DataList = mapTab === "estados" ? estadosData.slice(0, 5) : regionesData.slice(0, 5);
  
  const getEstadoColor = (estadoName: string, value: number) => {
    if (value === 0) return "#E5E7EB"; 
    const index = estadosData.findIndex(e => e.id.toLowerCase().includes(estadoName.toLowerCase()) || estadoName.toLowerCase().includes(e.id.toLowerCase()));
    
    if (index >= 0 && index <= 2) return "#FE5000"; 
    if (index >= 3 && index <= 4) return "#009639"; 
    return "#00205B"; 
  };

  // Data del Gráfico de Torta (Dinámico con los nombres reales y desglose exacto)
  const donutData = (stats?.transacciones || []).map((t: any) => ({
    name: TDD_NAMES[t.name] || `Cod: ${t.name}`,
    value: t.value
  }));

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 20; 
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Mostrar siempre las etiquetas independientemente del porcentaje
    if (value === 0) return null; // Solo ocultar si es literalmente cero

    return (
      <text 
        x={x} 
        y={y} 
        fill="#00205B" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-[10px] font-bold"
      >
        {`${value.toLocaleString()} (${(percent * 100).toFixed(1)}%)`}
      </text>
    );
  };

  return (
    <div className="w-full bg-[#F5F7FA] font-sans pb-12">
      
      {/* 1. BARRA DE FILTROS SUPERIOR (FULL WIDTH) */}
      <div className="bg-white border-y border-gray-200 py-3 px-2 mb-6 w-full shadow-sm">
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-2">
            
            {/* Filtro: Operativo / Agencia */}
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">OPERATIVO / AGENCIA</label>
              <CustomSelect 
                value={selectedAgencia}
                onChange={setSelectedAgencia}
                buttonClassName="text-[11px] py-1.5 min-h-[32px] pl-2 rounded"
                icon={<svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>}
                options={[
                  { value: "", label: "Seleccionar..." },
                  ...[...catAgencias]
                    .sort((a, b) => {
                      const numA = parseInt(a.codigo) || 0;
                      const numB = parseInt(b.codigo) || 0;
                      return numA - numB;
                    })
                    .map(a => ({ value: a.codigo, label: `${a.codigo} - ${a.nombre}` }))
                ]}
              />
            </div>

            {/* Filtro: Mes / Periodo */}
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">AÑO / PERIODO</label>
              <CustomSelect 
                value={selectedYear}
                onChange={setSelectedYear}
                buttonClassName="text-[11px] py-1.5 min-h-[32px] pl-2 rounded"
                icon={<svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                options={catYears.map(y => ({ value: y, label: y === "Todos" ? "Seleccionar..." : y }))}
              />
            </div>

            {/* Filtro: Mes */}
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">MES</label>
              <CustomSelect 
                value={selectedMonth}
                onChange={setSelectedMonth}
                buttonClassName="text-[11px] py-1.5 min-h-[32px] pl-2 rounded"
                icon={<svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                options={[
                  { value: "Todos", label: "Todos" },
                  { value: "1", label: "Enero" },
                  { value: "2", label: "Febrero" },
                  { value: "3", label: "Marzo" },
                  { value: "4", label: "Abril" },
                  { value: "5", label: "Mayo" },
                  { value: "6", label: "Junio" },
                  { value: "7", label: "Julio" },
                  { value: "8", label: "Agosto" },
                  { value: "9", label: "Septiembre" },
                  { value: "10", label: "Octubre" },
                  { value: "11", label: "Noviembre" },
                  { value: "12", label: "Diciembre" }
                ]}
              />
            </div>

            {/* Filtro: Región */}
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">REGIÓN</label>
              <CustomSelect 
                value={selectedRegion}
                onChange={setSelectedRegion}
                buttonClassName="text-[11px] py-1.5 min-h-[32px] pl-2 rounded"
                icon={<svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                options={catRegions.map(r => ({ value: r, label: r === "Todas" ? "Seleccionar..." : r }))}
              />
            </div>

            {/* Filtro: Estado */}
            <div>
              <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">ESTADO</label>
              <CustomSelect 
                value={selectedEstado}
                onChange={setSelectedEstado}
                buttonClassName="text-[11px] py-1.5 min-h-[32px] pl-2 rounded"
                icon={<svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
                options={[
                  { value: "Todos", label: "Seleccionar..." },
                  ...(stats?.estados || []).map((e: any) => ({ value: e.id, label: e.id }))
                ]}
              />
            </div>
            
          </div>
          <div className="flex flex-col items-end justify-end gap-1.5 shrink-0 ml-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="px-3 py-1.5 bg-[#FE5000] border border-[#FE5000] rounded text-[11px] font-bold text-white hover:bg-[#e04800] flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm"
              >
                <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {isRefreshing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button 
                onClick={() => { setSelectedYear("Todos"); setSelectedRegion("Todas"); setSelectedEstado("Todos"); setSelectedAgencia(""); }}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded text-[11px] font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Limpiar
              </button>
            </div>
            {lastUpdate && (
              <span className="text-[9px] font-bold text-gray-400 mt-0.5">
                ACTUALIZADO: {new Date(lastUpdate).toLocaleString('es-VE', { 
                  day: '2-digit', month: '2-digit', year: 'numeric', 
                  hour: '2-digit', minute: '2-digit', hour12: true 
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full space-y-4">
        
        {/* 2. TARJETAS KPI REDUCIDAS PARA ENCAJAR 100% ZOOM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start">
            <div>
              <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">TOTAL TDD ASIGNADAS</h3>
              <p className="text-2xl font-black text-[#00205B] leading-none">{totalTDD.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 mt-1">Acumulado histórico</p>
            </div>
            <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start">
            <div>
              <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">PROMEDIO POR JORNADA</h3>
              <div className="flex items-end">
                <p className="text-2xl font-black text-[#00205B] leading-none">{promedioDiario.toLocaleString()}</p>
                <span className="text-[9px] font-bold text-gray-400 ml-1 mb-0.5">/ día</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Ritmo de entrega diario</p>
            </div>
            <div className="w-8 h-8 rounded bg-yellow-50 text-yellow-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start">
            <div>
              <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">MIGRACIONES</h3>
              <p className="text-2xl font-black text-[#00205B] leading-none">{migraciones.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 mt-1">Sustitución de plásticos</p>
            </div>
            <div className="w-8 h-8 rounded bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start">
            <div>
              <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">PRIMERA VEZ</h3>
              <p className="text-2xl font-black text-[#00205B] leading-none">{primeraVez.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 mt-1">Nuevas aperturas</p>
            </div>
            <div className="w-8 h-8 rounded bg-orange-50 text-[#FE5000] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start">
            <div>
              <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">REPOSICIONES</h3>
              <p className="text-2xl font-black text-[#00205B] leading-none">{reposiciones.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400 mt-1">Gestiones secundarias</p>
            </div>
            <div className="w-8 h-8 rounded bg-green-50 text-[#009639] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        </div>
          {/* 3. DOS COLUMNAS PRINCIPALES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* COLUMNA IZQUIERDA: MAPA Y TOP ESTADOS/REGIONES */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-[480px]">
            <div className="flex justify-between items-start mb-4 shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#00205B] leading-tight">Despliegue y Captación de TDD</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Distribución geográfica y volumen de asignaciones</p>
              </div>
              <div className="flex space-x-1 bg-slate-50 p-1 rounded-md border border-gray-100">
                <button 
                  onClick={() => setMapTab("estados")}
                  className={`px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition-colors ${mapTab === "estados" ? "bg-white shadow-sm text-[#00205B] border border-gray-200" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Por Estados
                </button>
                <button 
                  onClick={() => setMapTab("regiones")}
                  className={`px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition-colors ${mapTab === "regiones" ? "bg-white shadow-sm text-[#00205B] border border-gray-200" : "text-gray-500 hover:bg-gray-100"}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  Por Regiones
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-row min-h-[300px] gap-4">
              {/* Contenedor del Mapa */}
              <div className="flex-1 relative bg-white rounded-lg h-full flex items-center justify-center min-h-[300px]">
                <Tooltip id="map-tooltip" className="z-50 font-sans font-bold text-xs shadow-xl rounded-md bg-[#00205B] text-white py-1 px-2" />
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{ scale: 2600, center: [-66, 7.5] }}
                  width={800}
                  height={600}
                  style={{ width: "100%", height: "100%", minHeight: "300px" }}
                >
                  <ZoomableGroup center={[-66, 7.5]} zoom={1}>
                    <Geographies geography={geoUrl}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const stateNameRaw = geo.properties.NAME_1 || geo.properties.name || "";
                          
                          // Mapeo robusto manual para corregir los nombres corruptos del TopoJSON
                          const rawUpper = stateNameRaw.toUpperCase();
                          let cleanName = normalizeString(stateNameRaw);
                          if (rawUpper.includes("ANZO")) cleanName = "ANZOATEGUI";
                          if (rawUpper.includes("TACHIRA") || rawUpper.includes("TǭCHIRA")) cleanName = "TACHIRA";
                          if (rawUpper.includes("GUARICO") || rawUpper.includes("GUǭRICO")) cleanName = "GUARICO";
                          if (rawUpper.includes("MERIDA") || rawUpper.includes("MǸRIDA")) cleanName = "MERIDA";
                          if (rawUpper.includes("FALC")) cleanName = "FALCON";
                          if (rawUpper.includes("BOL")) cleanName = "BOLIVAR";
                          if (rawUpper.includes("DELTA") || rawUpper.includes("AMACURO")) cleanName = "DELTA AMACURO";
                          if (rawUpper.includes("NUEVA ESPARTA")) cleanName = "NUEVA ESPARTA";
                          
                          const foundState = stats?.estados?.find((e: any) => {
                            const dbName = normalizeString(e.id);
                            return dbName.includes(cleanName) || cleanName.includes(dbName);
                          });
                          
                          const value = foundState ? foundState.value : 0;
                          const regionName = REGION_MAPPING[cleanName] || "Desconocida";
                          
                          let fillColor = "#E5E7EB"; // Inactivo
                          
                          if (mapTab === "regiones") {
                            const matchRegion = (r: any) => {
                              const dbReg = normalizeString(r.id || r.name || "");
                              const targetReg = normalizeString(regionName);
                              return dbReg === targetReg || dbReg.includes(targetReg) || targetReg.includes(dbReg);
                            };
                            
                            const regionData = stats?.regiones?.find(matchRegion);
                            if (regionData && regionData.value > 0) {
                              const index = regionesData.findIndex(matchRegion);
                              if (index >= 0 && index <= 2) fillColor = "#FE5000"; // Top 1-3
                              else if (index >= 3 && index <= 4) fillColor = "#009639"; // Top 4-5
                              else fillColor = "#00205B"; // Otros activos
                            }
                          } else {
                            if (value > 0) {
                              const index = estadosData.findIndex((e: any) => (e.id || e.name) === (foundState?.id || foundState?.name));
                              if (index >= 0 && index <= 2) fillColor = "#FE5000"; // Top 1-3
                              else if (index >= 3 && index <= 4) fillColor = "#009639"; // Top 4-5
                              else fillColor = "#00205B"; // Otros activos
                            }
                          }
                          
                          const tooltipText = mapTab === "regiones" 
                            ? `Región ${regionName} (${cleanName}): ${value.toLocaleString()}`
                            : `${cleanName}: ${value.toLocaleString()}`;

                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              data-tooltip-id="map-tooltip"
                              data-tooltip-content={tooltipText}
                              fill={fillColor}
                              stroke="#FFFFFF"
                              strokeWidth={0.5}
                              style={{
                                default: { outline: "none", fill: fillColor, stroke: "#FFFFFF", strokeWidth: 0.5 },
                                hover: { outline: "none", fill: "#3b82f6", stroke: "#FFFFFF", strokeWidth: 1, cursor: "pointer" },
                                pressed: { outline: "none", fill: fillColor },
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ZoomableGroup>
                </ComposableMap>

                <div className="absolute bottom-0 left-0 bg-white shadow-sm border border-gray-100 rounded-xl p-3 z-10 w-36">
                  <h4 className="text-[10px] font-bold text-[#00205B] mb-2">Mapa de Captación</h4>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center text-[10px] font-medium text-gray-600"><span className="w-3 h-3 rounded-md bg-[#FE5000] mr-2"></span> Top 1-3</div>
                    <div className="flex items-center text-[10px] font-medium text-gray-600"><span className="w-3 h-3 rounded-md bg-[#009639] mr-2"></span> Top 4-5</div>
                    <div className="flex items-center text-[10px] font-medium text-gray-600"><span className="w-3 h-3 rounded-md bg-[#00205B] mr-2"></span> Otros Activos</div>
                    <div className="flex items-center text-[10px] font-medium text-gray-600"><span className="w-3 h-3 rounded-md bg-[#E5E7EB] mr-2"></span> Sin Operativos</div>
                  </div>
                </div>
              </div>

              {/* Columna de Tarjetas TOP 5 */}
              <div className="w-64 flex flex-col shrink-0">
                <div className="flex justify-between items-center mb-3 px-1">
                  <h3 className="text-[10px] font-bold text-[#00205B] uppercase tracking-widest">
                    TOP 5 {mapTab === "estados" ? "ESTADOS" : "REGIONES"}
                  </h3>
                  <span className="bg-[#00205B] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">100%</span>
                </div>
                
                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                  {top5DataList.map((item: any, index: number) => {
                    const percentage = Math.round((item.value / (totalTDD || 1)) * 100);
                    const isTop3 = index < 3;
                    const accentClass = isTop3 ? "text-[#FE5000]" : "text-[#009639]";
                    const bgClass = isTop3 ? "bg-[#FE5000]" : "bg-[#009639]";

                    return (
                      <div key={index} className="bg-white border border-gray-200 rounded-xl p-2.5 flex items-center shadow-sm hover:shadow-md transition-shadow">
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-black text-white mr-3 shrink-0 ${bgClass}`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-[11px] font-black text-[#00205B] leading-none uppercase truncate mb-1" title={item.name || item.id}>{item.name || item.id}</h4>
                          <p className="text-[9px] text-gray-400">Asignaciones TDD</p>
                        </div>
                        <div className="text-right ml-2 flex flex-col items-end">
                          <div className="flex items-end mb-0.5">
                            <p className="text-[12px] font-black text-[#00205B] leading-none">{item.value.toLocaleString()}</p>
                            <span className="text-[8px] text-gray-400 ml-0.5 mb-0.5">TDD</span>
                          </div>
                          <p className={`text-[11px] font-black ${accentClass}`}>{percentage}%</p>
                        </div>
                      </div>
                    );
                  })}
                  {top5DataList.length === 0 && (
                    <div className="text-[11px] text-gray-400 italic text-center py-4">No hay datos para esta vista.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: GRÁFICO DE TORTA */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-[480px]">
             <div className="flex justify-between items-start mb-2 shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#00205B] leading-tight">Distribución del Volumen por Transacción</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Desglose exacto: Primera Vez, Migraciones, Reposiciones</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 relative flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={90}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderCustomizedLabel}
                    labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                  >
                    {donutData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => [value.toLocaleString(), "TDDs"]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '20px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Etiqueta central (Total) */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center -mt-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TOTAL</p>
                <p className="text-2xl font-black text-[#00205B] leading-none mt-1">{totalTDD.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* 4. TERCERA FILA: Top 10 Agencias y Gráfico de Barras por Regiones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* COLUMNA IZQUIERDA: GRÁFICO DE BARRAS POR REGIONES */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-[400px]">
             <div className="flex justify-between items-start mb-4 shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#00205B] leading-tight">Distribución por Regiones</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Volumen total de asignaciones TDD por región</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionesData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#00205B', fontWeight: 'bold' }} width={120} />
                  <RechartsTooltip 
                    formatter={(value: number) => [value.toLocaleString(), "TDDs"]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    cursor={{fill: '#F5F7FA'}}
                  />
                  <Bar dataKey="value" fill="#00205B" radius={[0, 4, 4, 0]} barSize={20}>
                    <LabelList 
                      dataKey="value" 
                      position="right" 
                      formatter={(val: number) => val.toLocaleString()} 
                      style={{ fontSize: '10px', fontWeight: 'bold', fill: '#00205B' }} 
                    />
                    {regionesData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* COLUMNA DERECHA: TOP 10 AGENCIAS */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-[400px]">
            <div className="flex justify-between items-start mb-4 shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#00205B] leading-tight uppercase">Top 10 Agencias con mayor volumen de asignaciones</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">Agencias con mayor volumen de asignaciones</p>
              </div>
            </div>
            
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {((stats?.top_agencias || stats?.agencias || []).slice(0, 10)).map((agencia: any, index: number) => {
                const percentage = Math.round((agencia.value / (totalTDD || 1)) * 100);
                const isTop3 = index < 3;
                const accentClass = isTop3 ? "text-[#FE5000]" : "text-[#009639]";
                const bgClass = isTop3 ? "bg-[#FE5000]" : "bg-[#009639]";
                
                // Formateamos el nombre de la agencia para evitar desbordes
                const nombreAgencia = agencia.name || agencia.id || agencia.codigo || "Desconocida";

                return (
                  <div key={index} className="bg-white border border-gray-200 rounded-xl p-2.5 flex items-center shadow-sm hover:shadow-md transition-shadow">
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-black text-white mr-3 shrink-0 ${bgClass}`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[11px] font-black text-[#00205B] leading-none uppercase truncate mb-1" title={nombreAgencia}>
                        {nombreAgencia}
                      </h4>
                      <p className="text-[9px] text-gray-400">Asignaciones TDD</p>
                    </div>
                    <div className="text-right ml-2 flex flex-col items-end">
                      <div className="flex items-end mb-0.5">
                        <p className="text-[12px] font-black text-[#00205B] leading-none">{agencia.value.toLocaleString()}</p>
                        <span className="text-[8px] text-gray-400 ml-0.5 mb-0.5">TDD</span>
                      </div>
                      <p className={`text-[11px] font-black ${accentClass}`}>{percentage}%</p>
                    </div>
                  </div>
                );
              })}
              {((stats?.top_agencias || stats?.agencias || [])?.length === 0) && (
                <div className="text-[11px] text-gray-400 italic text-center py-4">No hay datos de agencias.</div>
              )}
            </div>
          </div>
          
        </div>

        {/* 5. TABLA DINÁMICA MENSUAL */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-base font-bold text-[#00205B] leading-tight uppercase">Tabla de Asignaciones por Mes</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">Desglose mensualizado de transacciones</p>
            </div>
          </div>
          
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-[#00205B] text-white font-bold text-[10px] tracking-wider uppercase">
                <tr>
                  <th className="px-4 py-3 border-r border-[#2d3a5c]">Mes</th>
                  <th className="px-4 py-3 border-r border-[#2d3a5c] text-right">Primera Vez</th>
                  <th className="px-4 py-3 border-r border-[#2d3a5c] text-right">Reposición</th>
                  <th className="px-4 py-3 border-r border-[#2d3a5c] text-right">Migración BNC</th>
                  <th className="px-4 py-3 border-r border-[#2d3a5c] text-right">Migración BOD</th>
                  <th className="px-4 py-3 border-r border-[#2d3a5c] text-right">TDD Pensionado</th>
                  <th className="px-4 py-3 text-right text-[#FE5000]">Total General</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pivotData.map((row: any) => {
                  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                  return (
                    <tr key={row.mes} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-[#0B132B] border-r border-gray-100">{monthNames[row.mes - 1]}</td>
                      <td className="px-4 py-3 text-right font-medium border-r border-gray-100">{row.primeraVez.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium border-r border-gray-100">{row.reposicion.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium border-r border-gray-100">{row.migracionBNC.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium border-r border-gray-100">{row.migracionBOD.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium border-r border-gray-100">{row.pensionado.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-black text-[#00205B]">{row.total.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 font-black text-[#0B132B]">
                <tr>
                  <td className="px-4 py-3 border-r border-gray-200 text-right uppercase tracking-widest text-[10px]">Gran Total</td>
                  <td className="px-4 py-3 border-r border-gray-200 text-right">{pivotData.reduce((acc, r) => acc + r.primeraVez, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-gray-200 text-right">{pivotData.reduce((acc, r) => acc + r.reposicion, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-gray-200 text-right">{pivotData.reduce((acc, r) => acc + r.migracionBNC, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-gray-200 text-right">{pivotData.reduce((acc, r) => acc + r.migracionBOD, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-gray-200 text-right">{pivotData.reduce((acc, r) => acc + r.pensionado, 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-[#FE5000]">{pivotData.reduce((acc, r) => acc + r.total, 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
