"use client";

import React, { useState, useEffect } from "react";
import DispatchForm from "@/components/DispatchForm";
import HistoricalTable from "@/components/HistoricalTable";
import TrackerSearch from "@/components/TrackerSearch";
import ReportGenerator from "@/components/ReportGenerator";
import { supabase } from "@/lib/supabase";

export default function DistribucionModule() {
  const [activeTab, setActiveTab] = useState<"registro" | "historico" | "rastreo" | "reporte">("registro");
  const [metrics, setMetrics] = useState({ totalLotes: 0, totalVolumen: 0 });

  useEffect(() => {
    const saved = localStorage.getItem('distribucion_tab');
    if (saved) {
      setActiveTab(saved as any);
    }
  }, []);

  const changeTab = (tab: "registro" | "historico" | "rastreo" | "reporte") => {
    setActiveTab(tab);
    localStorage.setItem('distribucion_tab', tab);
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      const { data, error } = await supabase.from("despachos").select("cantidad");
      if (!error && data) {
        setMetrics({
          totalLotes: data.length,
          totalVolumen: data.reduce((acc, row) => acc + row.cantidad, 0)
        });
      }
    };
    fetchMetrics();
  }, [activeTab]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex flex-col font-sans">
      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full animate-in fade-in duration-500">
        
        {/* Top Panel: Metrics & Tabs */}
        <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          
          {/* Tabs */}
          <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200">
            <button
              onClick={() => changeTab("registro")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === "registro" 
                  ? "bg-[#00205B] text-white shadow-md" 
                  : "text-gray-500 hover:text-[#00205B] hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Despacho
            </button>
            <button
              onClick={() => changeTab("historico")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === "historico" 
                  ? "bg-[#00205B] text-white shadow-md" 
                  : "text-gray-500 hover:text-[#00205B] hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Histórico / Seguimiento
            </button>
            <button
              onClick={() => changeTab("rastreo")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === "rastreo" 
                  ? "bg-[#00205B] text-white shadow-md" 
                  : "text-gray-500 hover:text-[#00205B] hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Rastreo de TDD
            </button>
            <button
              onClick={() => changeTab("reporte")}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === "reporte" 
                  ? "bg-[#00205B] text-white shadow-md" 
                  : "text-gray-500 hover:text-[#00205B] hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
              Reportes y Relación
            </button>
          </div>

          {/* Metrics Pills */}
          <div className="flex gap-3 w-full lg:w-auto">
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
              <div className="w-2 h-8 bg-[#009639] rounded-full"></div>
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Total Lotes</p>
                <p className="text-lg font-black text-[#00205B] leading-none mt-1">{metrics.totalLotes}</p>
              </div>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3">
              <div className="w-2 h-8 bg-[#FE5000] rounded-full"></div>
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Volumen Despachado</p>
                <p className="text-lg font-black text-[#00205B] leading-none mt-1">{new Intl.NumberFormat("es-VE").format(metrics.totalVolumen)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="transition-all">
          {activeTab === "registro" && <DispatchForm onSuccess={() => changeTab("historico")} />}
          {activeTab === "historico" && <HistoricalTable />}
          {activeTab === "rastreo" && <TrackerSearch />}
          {activeTab === "reporte" && <ReportGenerator />}
        </div>
      </main>
    </div>
  );
}
