"use client";

import React from "react";
import AsignacionesTable from "@/components/AsignacionesTable";

export default function ReporteTabularModule() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F5F7FA] flex flex-col font-sans">
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        
        {/* Module Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#0B132B] tracking-tight">Buscador Tabular de Asignaciones</h1>
            <p className="text-gray-500 mt-2 max-w-2xl text-sm leading-relaxed">
              Búsqueda y visualización de registros individuales en tiempo real.
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">PostgreSQL Activo</span>
          </div>
        </div>

        <AsignacionesTable />
        
      </main>
    </div>
  );
}
