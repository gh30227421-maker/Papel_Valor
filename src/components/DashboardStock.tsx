import React, { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import LoadingOverlay from "./LoadingOverlay";
import { getStockStats, getDashboardStats } from "@/actions/dashboard";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LabelList
} from "recharts";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { Tooltip } from "react-tooltip";

const geoUrl = "/venezuela.json";

const COLORS = ["#00205B", "#009639", "#FE5000", "#F0B323"];

// Mapeo para normalizar nombres
const normalizeString = (str: string) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

const STATE_TO_REGION: Record<string, string> = {
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

export default function DashboardStock() {
  const [mapTab, setMapTab] = useState<"estados" | "regiones">("regiones");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRegions, setExpandedRegions] = useState<string[]>([]);

  const toggleRegion = (regionName: string) => {
    setExpandedRegions(prev => 
      prev.includes(regionName) ? prev.filter(r => r !== regionName) : [...prev, regionName]
    );
  };

  const fetcher = async () => {
    const [data, asigData] = await Promise.all([
      getStockStats(""),
      getDashboardStats({ year: "2026" })
    ]);
    return { data, asigData };
  };

  const { data: swrData, isValidating } = useSWR(["dashboard-stock"], fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true
  });

  const stats = swrData?.data || null;
  const asigTotal = swrData?.asigData?.total || 0;
  const loading = !swrData && isValidating;

  const proyeccionData = stats?.proyeccion || [];

  // Agrupar proyeccion por Región y luego por Zona
  const groupedRegions = useMemo(() => {
    const map = new Map<string, any>();

    proyeccionData.forEach((item: any) => {
      const regName = item.region || "Sin Región";
      const zonaName = item.zona || "Sin Zona";

      if (!map.has(regName)) {
        map.set(regName, {
          name: regName,
          stock_actual: 0,
          prom_diario: 0,
          meta_sugerida: 0,
          zonas: new Map<string, any>()
        });
      }

      const reg = map.get(regName);
      reg.stock_actual += item.stock_actual || 0;
      reg.prom_diario += item.prom_diario || 0;
      reg.meta_sugerida += item.meta_sugerida || 0;

      if (!reg.zonas.has(zonaName)) {
        reg.zonas.set(zonaName, {
          name: zonaName,
          stock_actual: 0,
          prom_diario: 0,
          meta_sugerida: 0
        });
      }

      const zona = reg.zonas.get(zonaName);
      zona.stock_actual += item.stock_actual || 0;
      zona.prom_diario += item.prom_diario || 0;
      zona.meta_sugerida += item.meta_sugerida || 0;
    });

    return Array.from(map.values()).map(r => ({
      ...r,
      dias_stock: r.prom_diario > 0 ? Math.round(r.stock_actual / r.prom_diario) : 999,
      zonas: Array.from(r.zonas.values()).map((z: any) => ({
        ...z,
        dias_stock: z.prom_diario > 0 ? Math.round(z.stock_actual / z.prom_diario) : 999,
      })).sort((a, b) => a.dias_stock - b.dias_stock)
    })).sort((a, b) => a.dias_stock - b.dias_stock);
  }, [proyeccionData]);

  // Data para el nuevo gráfico de zonas
  const zonasChartData = useMemo(() => {
    const data: { name: string; value: number }[] = [];
    
    groupedRegions.forEach((reg: any) => {
      if (reg.name?.toUpperCase().includes("CAPITAL")) {
        data.push({ name: "CAPITAL", value: reg.stock_actual });
      } else {
        reg.zonas.forEach((z: any) => {
          data.push({ name: z.name || "Sin Zona", value: z.stock_actual });
        });
      }
    });
    
    return data.sort((a, b) => b.value - a.value);
  }, [groupedRegions]);

  if (loading && !stats) {
    return (
      <div className="flex justify-center items-center h-96 w-full">
        <LoadingOverlay fullScreen={false} />
      </div>
    );
  }

  const {
    stock_boveda = 0,
    stock_nomina = 0,
    stock_agencias = 0,
    stock_global = 0,
    top_agencias = [],
    regiones = [],
    estados = [],
    proyeccion = []
  } = stats || {};

  // Data del Gráfico de Torta (Distribución general)
  const donutData = [
    { name: "Bóveda Central", value: stock_boveda },
    { name: "Nómina Externa", value: stock_nomina },
    { name: "Red de Agencias", value: stock_agencias }
  ].filter(d => d.value > 0);

  // Top 5 para el mapa
  const estadosData = [...estados].sort((a: any, b: any) => b.value - a.value);
  const regionesData = [...regiones].sort((a: any, b: any) => b.value - a.value);
  const top5DataList = mapTab === "estados" ? estadosData.slice(0, 5) : regionesData.slice(0, 5);

  const monthsElapsed = new Date().getFullYear() === 2026 ? new Date().getMonth() + 1 : 12;
  const workDaysElapsed = Math.max(1, monthsElapsed * 20);
  const promedioAsignacion20 = Math.round(asigTotal / workDaysElapsed);
  const diasDeStock = promedioAsignacion20 > 0 ? Math.round(stock_global / promedioAsignacion20) : 0;

  const getEstadoColor = (estadoName: string, value: number) => {
    if (value === 0) return "#E5E7EB"; 
    
    if (mapTab === "estados") {
       const index = estadosData.findIndex(e => normalizeString(e.id).includes(normalizeString(estadoName)) || normalizeString(estadoName).includes(normalizeString(e.id)));
       if (index >= 0 && index <= 2) return "#FE5000"; 
       if (index >= 3 && index <= 4) return "#009639"; 
       if (index > 4) return "#00205B";
    } else {
       const regionName = STATE_TO_REGION[normalizeString(estadoName)];
       if (regionName) {
          if (regionName === "ORIENTE") return "#00205B";
          if (regionName === "ARAGUA - LOS LLANOS") return "#FE5000";
          if (regionName === "CENTRO OCCIDENTE") return "#009639";
          if (regionName === "OCCIDENTE - ANDES") return "#DC2626"; // Rojo
          if (regionName === "CAPITAL") return "#EAB308"; // Amarillo
       }
    }
    return "#E5E7EB"; 
  };

  return (
    <div className="w-full bg-[#F5F7FA] font-sans pb-12">
      
      {/* 2. TARJETAS KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">STOCK TOTAL GLOBAL</h3>
            <p className="text-2xl font-black text-[#00205B] leading-none">{stock_global.toLocaleString("es-VE")}</p>
            <p className="text-[10px] text-gray-400 mt-1">Volumen consolidado</p>
          </div>
          <div className="w-8 h-8 rounded bg-blue-50 text-[#00205B] flex items-center justify-center shrink-0">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">BÓVEDA CENTRAL</h3>
            <p className="text-2xl font-black text-[#00205B] leading-none">{stock_boveda.toLocaleString("es-VE")}</p>
            <p className="text-[10px] text-gray-400 mt-1">Centro de Costo 95</p>
          </div>
          <div className="w-8 h-8 rounded bg-green-50 text-[#009639] flex items-center justify-center shrink-0">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">RED DE AGENCIAS</h3>
            <p className="text-2xl font-black text-[#00205B] leading-none">{stock_agencias.toLocaleString("es-VE")}</p>
            <p className="text-[10px] text-gray-400 mt-1">Oficinas Comerciales</p>
          </div>
          <div className="w-8 h-8 rounded bg-orange-50 text-[#FE5000] flex items-center justify-center shrink-0">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">NÓMINA EXTERNA</h3>
            <p className="text-2xl font-black text-[#00205B] leading-none">{stock_nomina.toLocaleString("es-VE")}</p>
            <p className="text-[10px] text-gray-400 mt-1">Centro de Costo 743</p>
          </div>
          <div className="w-8 h-8 rounded bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">PROM. ASIGNACIÓN (20D)</h3>
            <div className="flex items-end">
              <p className="text-2xl font-black text-[#00205B] leading-none">{promedioAsignacion20.toLocaleString("es-VE")}</p>
              <span className="text-[9px] font-bold text-gray-400 ml-1 mb-0.5">/ día</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Base 20 días hábiles</p>
          </div>
          <div className="w-8 h-8 rounded bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-start hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">DÍAS DE STOCK</h3>
            <div className="flex items-end">
              <p className="text-2xl font-black text-[#FE5000] leading-none">{diasDeStock.toLocaleString("es-VE")}</p>
              <span className="text-[9px] font-bold text-gray-400 ml-1 mb-0.5">días</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Cobertura Global</p>
          </div>
          <div className="w-8 h-8 rounded bg-red-50 text-red-500 flex items-center justify-center shrink-0">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>

      </div>

      {/* 3. MAPA Y GRÁFICO DISTRIBUCIÓN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-[#0B132B]">Distribución de Stock Comercial</h3>
              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Inventario en Red de Agencias</p>
            </div>
            <div className="flex bg-gray-50 p-1 rounded-md border border-gray-200">
              <button 
                onClick={() => setMapTab("regiones")}
                className={`px-3 py-1 text-[10px] font-bold rounded flex items-center gap-1 ${mapTab === "regiones" ? "bg-white text-[#0B132B] shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700"}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                Por Regiones
              </button>
              <button 
                onClick={() => setMapTab("estados")}
                className={`px-3 py-1 text-[10px] font-bold rounded flex items-center gap-1 ${mapTab === "estados" ? "bg-white text-[#0B132B] shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700"}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Por Estados
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col md:flex-row p-5">
            <div className="w-full md:w-3/5 h-64 md:h-auto relative">
               <ComposableMap
                  projectionConfig={{ scale: 2700, center: [-66, 6.8] }}
                  projection="geoMercator"
                  style={{ width: "100%", height: "100%" }}
                >
                  <Geographies geography={geoUrl}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const rawName = geo.properties.ESTADO || geo.properties.NAME_1 || "";
                          const rawUpper = normalizeString(rawName);
                          let cleanName = rawUpper;
                          
                          if (rawUpper.includes("ANZO")) cleanName = "ANZOATEGUI";
                          if (rawUpper.includes("FALC")) cleanName = "FALCON";
                          if (rawUpper.includes("BOL")) cleanName = "BOLIVAR";
                          if (rawUpper.includes("DELTA") || rawUpper.includes("AMACURO")) cleanName = "DELTA AMACURO";
                          if (rawUpper.includes("NUEVA ESPARTA")) cleanName = "NUEVA ESPARTA";

                          const fillColor = getEstadoColor(cleanName, 1);
                          const tooltipText = `${cleanName}`;

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
                </ComposableMap>
                <Tooltip id="map-tooltip" style={{ backgroundColor: "#0B132B", color: "#fff", fontSize: "11px", fontWeight: "bold", borderRadius: "8px", zIndex: 100 }} />
               <div className="absolute bottom-0 left-0 bg-white/90 p-2 rounded border border-gray-100 shadow-sm text-[9px] font-bold text-gray-500">
                 {mapTab === "estados" ? (
                   <>
                     <p className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-[#FE5000]"></span> Top 1-3</p>
                     <p className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-[#009639]"></span> Top 4-5</p>
                     <p className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00205B]"></span> Otros</p>
                   </>
                 ) : (
                   <>
                     <p className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-[#00205B]"></span> Oriente</p>
                     <p className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-[#FE5000]"></span> Aragua - Los Llanos</p>
                     <p className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-[#009639]"></span> Centro Occidente</p>
                     <p className="flex items-center gap-1 mb-1"><span className="w-2 h-2 rounded-full bg-[#DC2626]"></span> Occidente - Andes</p>
                     <p className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EAB308]"></span> Capital</p>
                   </>
                 )}
               </div>
            </div>
            
            <div className="w-full md:w-2/5 md:pl-6 mt-6 md:mt-0 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[9px] font-bold text-[#00205B] uppercase tracking-widest">
                  TOP 5 {mapTab === "estados" ? "ESTADOS" : "REGIONES"}
                </span>
                <span className="bg-[#0B132B] text-white text-[9px] font-bold px-2 py-0.5 rounded">100%</span>
              </div>

              {top5DataList.length > 0 ? (
                <div className="space-y-4 flex-1">
                  {top5DataList.map((item: any, i: number) => {
                    const idName = mapTab === "estados" ? item.id : item.name;
                    
                    let badgeColorClass = i < 3 ? "bg-[#FE5000]" : "bg-[#009639]";
                    if (mapTab === "regiones") {
                      const rName = normalizeString(idName);
                      if (rName === "ORIENTE") badgeColorClass = "bg-[#00205B]";
                      else if (rName === "ARAGUA - LOS LLANOS") badgeColorClass = "bg-[#FE5000]";
                      else if (rName === "CENTRO OCCIDENTE") badgeColorClass = "bg-[#009639]";
                      else if (rName === "OCCIDENTE - ANDES") badgeColorClass = "bg-[#DC2626]";
                      else if (rName === "CAPITAL") badgeColorClass = "bg-[#EAB308]";
                    }
                    
                    return (
                      <div key={idName} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${badgeColorClass}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{idName}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">Stock Físico</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-[#0B132B]">{item.value.toLocaleString("es-VE")}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">{((item.value / stock_agencias) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400 italic">
                  No hay datos para esta vista.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-sm font-bold text-[#0B132B]">Distribución del Stock General</h3>
            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Desglose exacto de inventario físico</p>
          </div>
          <div className="flex-1 p-5 flex flex-col items-center justify-center relative min-h-[300px]">
             {donutData.length > 0 ? (
               <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={115}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ percent, value }) => `${(percent * 100).toFixed(1)}% (${value.toLocaleString('es-VE')})`}
                        labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                        style={{ fontSize: '11px', fontWeight: 'bold' }}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: number) => [`${value.toLocaleString("es-VE")} TDD`, "Cantidad"]}
                        contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "11px", fontWeight: "bold" }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-[-18px]">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">TOTAL</p>
                    <p className="text-xl font-black text-[#0B132B]">{stock_global.toLocaleString("es-VE")}</p>
                  </div>
               </>
             ) : (
               <div className="text-xs text-gray-400 italic">No hay datos suficientes.</div>
             )}
          </div>
        </div>

      </div>

      {/* 4. TOP AGENCIAS Y GRÁFICO BARRAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top 10 Agencias List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex flex-col h-auto">
           <div className="p-4 border-b border-gray-100">
             <h3 className="text-sm font-bold text-[#0B132B]">Top 10 Agencias con Mayor Inventario</h3>
             <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">Acumulado físico en Red</p>
           </div>
           <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
             {top_agencias.length > 0 ? (
               <div className="flex flex-col gap-1 p-3">
                 {top_agencias.map((ag: any, index: number) => {
                   const maxStock = top_agencias[0]?.value || 1;
                   const barWidth = `${(ag.value / maxStock) * 100}%`;
                   const colorClass = index === 0 ? "bg-[#00205B]" : index === 1 ? "bg-[#FE5000]" : index === 2 ? "bg-[#009639]" : "bg-gray-400";
                   const textColor = index === 0 ? "text-[#00205B]" : index === 1 ? "text-[#FE5000]" : index === 2 ? "text-[#009639]" : "text-[#0B132B]";
                   
                   return (
                     <div key={index} className="flex items-center gap-3 bg-gray-50/50 py-1.5 px-2 rounded hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-sm ${colorClass}`}>
                         {index + 1}
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className={`text-[10px] font-black truncate leading-tight mb-1 ${textColor}`}>{ag.name}</p>
                         <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                           <div className={`${colorClass} h-1 rounded-full`} style={{ width: barWidth }}></div>
                         </div>
                       </div>
                       <div className="text-right shrink-0">
                         <p className={`text-xs font-black leading-tight ${textColor}`}>{ag.value.toLocaleString("es-VE")}</p>
                         <p className="text-[8px] text-gray-400 font-bold uppercase mt-0.5">Stock</p>
                       </div>
                     </div>
                   );
                 })}
               </div>
             ) : (
               <div className="flex h-full items-center justify-center text-xs text-gray-400 italic">
                 No hay datos en esta vista.
               </div>
             )}
           </div>
        </div>

        {/* Bar Chart Regiones */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow h-auto">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-[#0B132B]">Distribución de Stock por Regiones</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">Inventario consolidado</p>
          </div>
           <div className="flex-1 min-h-0 relative flex flex-col justify-center py-4">
             {regiones.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={regiones}
                    layout="vertical"
                    margin={{ top: 10, right: 40, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F3F4F6" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6B7280', fontSize: 9, fontWeight: 'bold' }} 
                      width={110}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: '#F9FAFB' }}
                      formatter={(value: number) => [`${value.toLocaleString("es-VE")}`, "Stock"]}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[0, 4, 4, 0]}
                      maxBarSize={32}
                    >
                      <LabelList dataKey="value" position="right" fill="#0B132B" fontSize={10} fontWeight="bold" formatter={(val: number) => val.toLocaleString("es-VE")} />
                      {regiones.map((entry: any, index: number) => {
                        const rName = normalizeString(entry.name);
                        let fillColor = "#00205B";
                        if (rName === "ORIENTE") fillColor = "#00205B";
                        else if (rName === "ARAGUA - LOS LLANOS") fillColor = "#FE5000";
                        else if (rName === "CENTRO OCCIDENTE") fillColor = "#009639";
                        else if (rName === "OCCIDENTE - ANDES") fillColor = "#DC2626";
                        else if (rName === "CAPITAL") fillColor = "#EAB308";
                        else if (rName === "NOMINA EXTERNA") fillColor = "#8B5CF6";
                        return <Cell key={`cell-${index}`} fill={fillColor} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-400 italic">
                  No hay datos en esta vista.
                </div>
             )}
          </div>
        </div>

      </div>

      {/* SECCION PREDICTIVA EN DOS COLUMNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 mb-6">
        
        {/* NUEVA TABLA REGIONAL ACORDEÓN */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[700px]">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-[#0B132B] text-white shrink-0">
            <div>
              <h3 className="text-sm font-bold">Proyección Regional de Inventario</h3>
              <p className="text-[10px] text-gray-300 mt-0.5 uppercase tracking-wider">Desglose jerárquico Región &gt; Zona</p>
            </div>
          </div>
          
          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[500px]">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Región / Zona</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Stock Actual</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Prom. Diario</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Días con Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupedRegions.map((region: any, i: number) => {
                const isExpanded = expandedRegions.includes(region.name);
                let rStatusColor = "bg-green-500";
                let rStatusText = "text-green-700 bg-green-50";
                if (region.dias_stock < 7) { rStatusColor = "bg-red-500"; rStatusText = "text-red-700 bg-red-50"; }
                else if (region.dias_stock <= 15) { rStatusColor = "bg-yellow-400"; rStatusText = "text-yellow-700 bg-yellow-50"; }
                if (region.dias_stock === 999) { rStatusColor = "bg-gray-400"; rStatusText = "text-gray-700 bg-gray-100"; }

                return (
                  <React.Fragment key={region.name}>
                    {/* Fila de la Región (Clickeable) */}
                    <tr 
                      className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${isExpanded ? "bg-blue-50/20" : ""}`}
                      onClick={() => toggleRegion(region.name)}
                    >
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2">
                           <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${isExpanded ? "rotate-90 text-[#0B132B]" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                           <p className="text-xs font-black text-[#0B132B]">{region.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <span className="text-sm font-black text-[#0B132B]">{region.stock_actual.toLocaleString("es-VE")}</span>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <span className="text-xs font-semibold text-gray-500">{region.prom_diario.toLocaleString("es-VE")} / día</span>
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex justify-center">
                          <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 ${rStatusText}`}>
                            <span className={`w-2 h-2 rounded-full ${rStatusColor} ${region.dias_stock < 7 ? "animate-pulse" : ""}`}></span>
                            <span className="text-xs font-bold">
                              {region.dias_stock === 999 ? "Sin Promedio" : `${region.dias_stock} Días`}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Filas de Zonas (Desplegables) */}
                    {isExpanded && region.zonas.map((zona: any) => {
                       let zStatusColor = "bg-green-500";
                       let zStatusText = "text-green-700 bg-green-50";
                       if (zona.dias_stock < 7) { zStatusColor = "bg-red-500"; zStatusText = "text-red-700 bg-red-50"; }
                       else if (zona.dias_stock <= 15) { zStatusColor = "bg-yellow-400"; zStatusText = "text-yellow-700 bg-yellow-50"; }
                       if (zona.dias_stock === 999) { zStatusColor = "bg-gray-400"; zStatusText = "text-gray-700 bg-gray-100"; }
                       
                       return (
                        <tr key={`${region.name}-${zona.name}`} className="bg-gray-50/80 hover:bg-white transition-colors">
                          <td className="py-2.5 px-6 pl-12 border-l-2 border-blue-200">
                            <p className="text-[11px] font-bold text-gray-600">↳ Zona: {zona.name}</p>
                          </td>
                          <td className="py-2.5 px-6 text-right">
                            <span className="text-xs font-bold text-gray-600">{zona.stock_actual.toLocaleString("es-VE")}</span>
                          </td>
                          <td className="py-2.5 px-6 text-right">
                            <span className="text-[11px] font-semibold text-gray-400">{zona.prom_diario.toLocaleString("es-VE")} / día</span>
                          </td>
                          <td className="py-2.5 px-6">
                            <div className="flex justify-center">
                              <div className={`px-2 py-1 rounded flex items-center gap-1.5 ${zStatusText}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${zStatusColor}`}></span>
                                <span className="text-[10px] font-bold">
                                  {zona.dias_stock === 999 ? "N/A" : `${zona.dias_stock} d`}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                       );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* GRÁFICO DE ZONAS (BOTTOM) */}
        {zonasChartData.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0 h-72">
            <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wider text-center">Distribución de Stock por Zonas</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zonasChartData} margin={{ top: 25, right: 10, left: 25, bottom: 65 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 9, fill: '#6b7280' }} 
                  axisLine={false} 
                  tickLine={false} 
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis hide />
                <RechartsTooltip 
                  cursor={{ fill: '#f3f4f6' }} 
                  formatter={(value: number) => [`${value.toLocaleString("es-VE")}`, "Stock"]}
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "12px" }} 
                />
                <Bar dataKey="value" fill="#009639" radius={[4, 4, 0, 0]} barSize={20}>
                  <LabelList dataKey="value" position="top" fill="#00205B" fontSize={9} fontWeight="bold" formatter={(val: number) => val.toLocaleString("es-VE")} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 5. TABLA PREDICTIVA DE AUTONOMÍA DETALLE AGENCIAS */}
      <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[700px]">
        <div className="p-5 border-b border-gray-100 flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center bg-[#0B132B] text-white gap-4 shrink-0">
          <div>
            <h3 className="text-sm font-bold">Detalle por Agencia</h3>
            <p className="text-[10px] text-gray-300 mt-0.5 uppercase tracking-wider">Cálculo en base a históricos de asignación</p>
          </div>
          
          <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4 w-full 2xl:w-auto">
            {/* Buscador Integrado */}
            <div className="relative w-full xl:w-56">
              <input
                type="text"
                placeholder="Buscar agencia o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A2645] border border-gray-700 text-white placeholder-gray-400 text-xs font-semibold rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block p-2 pl-8 transition-colors"
              />
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            </div>

            {/* Leyenda Semáforo */}
            <div className="flex gap-3">
               <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span><span className="text-[10px] font-bold">Crítico (&lt; 7 días)</span></div>
               <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span><span className="text-[10px] font-bold">Precaución (7-15)</span></div>
               <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span><span className="text-[10px] font-bold">Saludable (&gt; 15)</span></div>
            </div>
          </div>
        </div>
        
        <div className="overflow-auto flex-1 custom-scrollbar">
          {proyeccion.filter((item: any) => 
            item.agencia?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            item.codigo_agencia?.toLowerCase().includes(searchQuery.toLowerCase())
          ).length > 0 ? (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Agencia</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Stock Actual</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Prom. Diario Entregas</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-[#00205B] uppercase tracking-wider text-right bg-blue-50/50">Sugerido Mensual (+20%)</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center">Días con Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {proyeccion.filter((item: any) => 
                  item.agencia?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  item.codigo_agencia?.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((item: any, i: number) => {
                  let statusColor = "bg-green-500";
                  let statusText = "text-green-700 bg-green-50";
                  
                  if (item.dias_stock < 7) {
                    statusColor = "bg-red-500";
                    statusText = "text-red-700 bg-red-50";
                  } else if (item.dias_stock <= 15) {
                    statusColor = "bg-yellow-400";
                    statusText = "text-yellow-700 bg-yellow-50";
                  }

                  if (item.dias_stock === 999) {
                    statusColor = "bg-gray-400";
                    statusText = "text-gray-700 bg-gray-100";
                  }

                  return (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-6">
                        <p className="text-xs font-bold text-[#0B132B]">{item.agencia}</p>
                        <p className="text-[10px] text-gray-400">COD: {item.codigo_agencia} | {item.region}</p>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <span className="text-sm font-black text-gray-700">{item.stock_actual.toLocaleString("es-VE")}</span>
                      </td>
                      <td className="py-3 px-6 text-right">
                        <span className="text-xs font-semibold text-gray-500">{item.prom_diario.toLocaleString("es-VE")} / día</span>
                      </td>
                      <td className="py-3 px-6 text-right bg-blue-50/30">
                        <span className="text-sm font-black text-[#00205B]">{item.meta_sugerida.toLocaleString("es-VE")}</span>
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex justify-center">
                          <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 ${statusText}`}>
                            <span className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></span>
                            <span className="text-xs font-bold">
                              {item.dias_stock === 999 ? "Sin Promedio" : `${item.dias_stock} Días`}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400 italic">
              No hay datos para calcular la proyección en esta región.
            </div>
          )}
        </div>
      </div>

      </div>

    </div>
  );
}
