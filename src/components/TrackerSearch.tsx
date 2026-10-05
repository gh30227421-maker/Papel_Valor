"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

type SearchResult = {
  id: string;
  codigo_agencia: string;
  tipo?: string;
  correlativo?: string;
  updated_at?: string;
  correlativo_inicial?: string;
  correlativo_final?: string;
  fecha_despacho?: string;
  estatus_entrega?: string;
  cantidad?: number;
  fecha_recepcion?: string;
  recibido_por?: string;
  source?: 'stock' | 'despacho';
  agencias: {
    nombre: string;
    region: string;
    estado: string;
    zona: string;
    gerente: string;
  };
};

export default function TrackerSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setResult(null);

    const termClean = searchTerm.replace(/\D/g, "");
    const termSpaced = termClean.replace(/(.{4})/g, '$1 ').trim();

    // 1. Primero buscamos en el stock real (físico)
    // Intentamos coincidencia exacta o que contenga el número (por si está escrito con/sin espacios)
    let { data: stockData, error: stockError } = await supabase
      .from("stock_actual")
      .select(`
        id,
        codigo_agencia,
        tipo,
        correlativo,
        updated_at
      `)
      .in("correlativo", [termClean, termSpaced])
      .limit(1)
      .maybeSingle();

    // Si no hubo coincidencia directa, buscamos si está dentro de un rango (ej: A-B)
    if (!stockData && termClean.length > 0) {
      const { data: allStock } = await supabase
        .from("stock_actual")
        .select(`
          id,
          codigo_agencia,
          tipo,
          correlativo,
          updated_at
        `)
        .ilike('correlativo', '%-%'); // Solo traemos los rangos

      if (allStock) {
        try {
          const searchBigInt = BigInt(termClean);
          for (const item of allStock) {
            if (item.correlativo && item.correlativo.includes("-")) {
              const parts = item.correlativo.split("-");
              if (parts.length === 2) {
                const startStr = parts[0].replace(/\D/g, '');
                const endStr = parts[1].replace(/\D/g, '');
                if (startStr && endStr) {
                  const start = BigInt(startStr);
                  const end = BigInt(endStr);
                  if (searchBigInt >= start && searchBigInt <= end) {
                    stockData = item;
                    stockError = null;
                    break;
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignorar errores de parseo BigInt
        }
      }
    }

    if (!stockError && stockData) {
      // Fetch agency manually because FK might be missing in DB
      let agencias = { nombre: "Desconocida", region: "—", estado: "—", zona: "—", gerente: "—" };
      if (stockData.codigo_agencia) {
        const { data: agenciaData } = await supabase
          .from("agencias")
          .select("nombre, region, estado, zona, gerente")
          .eq("codigo", stockData.codigo_agencia)
          .single();
        if (agenciaData) agencias = agenciaData;
      }
      
      setResult({ ...stockData, agencias, source: 'stock' } as any);
      setIsSearching(false);
      return;
    }

    // 2. Si no está en stock, buscamos en los lotes despachados (en tránsito o recién recibidos)
    const { data: despachoData, error: despachoError } = await supabase
      .from("despachos")
      .select(`
        id,
        codigo_agencia,
        correlativo_inicial,
        correlativo_final,
        fecha_despacho,
        estatus_entrega,
        cantidad,
        fecha_recepcion,
        recibido_por,
        agencias (
          nombre,
          region,
          estado,
          zona,
          gerente
        )
      `)
      .or(`and(correlativo_inicial.lte.${termClean},correlativo_final.gte.${termClean}),and(correlativo_inicial.lte.${termSpaced},correlativo_final.gte.${termSpaced})`)
      .order('fecha_despacho', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!despachoError && despachoData) {
      setResult({ ...despachoData, source: 'despacho' } as any);
    }
    
    setIsSearching(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden min-h-[500px]">
      <div className="bg-[#00205B] border-b border-blue-900 px-8 py-8 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M0 40V0H40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-2xl text-center">
          <h2 className="text-3xl font-black text-white tracking-tight mb-2">Rastreo de Plásticos</h2>
          <p className="text-blue-200 text-sm mb-8">Consulta en tiempo real la ubicación física de cualquier correlativo de TDD a nivel nacional</p>
          
          <form onSubmit={handleSearch} className="relative w-full">
            <div className="flex items-center bg-white rounded-lg p-1.5 shadow-xl border-4 border-white/20">
              <div className="pl-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                placeholder="Ingrese el número correlativo exacto..."
                className="w-full px-4 py-3 text-lg font-mono tracking-wider outline-none text-gray-800 placeholder:text-gray-400 bg-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                type="submit"
                disabled={isSearching || !searchTerm.trim()}
                className="bg-[#FE5000] text-white px-8 py-3 rounded-md font-bold hover:bg-[#e04800] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSearching ? (
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : "Buscar"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="p-8">
        {hasSearched && !isSearching && !result && (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-50 text-red-400 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">Correlativo no encontrado</h3>
            <p className="text-gray-500 max-w-md">El número <span className="font-mono text-gray-700 font-bold bg-gray-100 px-1 py-0.5 rounded">{searchTerm}</span> no se encuentra en el inventario físico (stock_actual) de ninguna agencia.</p>
          </div>
        )}

        {result && (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-[#009639]/10 rounded-full flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-[#009639]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Tarjeta Localizada</h3>
                {result.source === 'stock' ? (
                  <p className="text-sm text-gray-500">En inventario físico al {new Date(result.updated_at).toLocaleString('es-VE')}</p>
                ) : (
                  <p className="text-sm text-gray-500">Pertenece al lote despachado el {new Date(result.fecha_despacho).toLocaleDateString('es-VE')}</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col md:flex-row">
              {/* Info Plástico */}
              <div className="bg-gray-50 p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-gray-200">
                <div className="text-center md:text-left">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Número Buscado</span>
                  <span className="font-mono text-2xl text-[#00205B] font-black tracking-widest block">{searchTerm.length === 16 ? searchTerm.replace(/(.{4})/g, '$1 ').trim() : searchTerm}</span>
                  
                  <div className="mt-6 pt-6 border-t border-gray-200">
                     <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                       {result.source === 'stock' ? 'Estado del Plástico' : 'Estado del Lote'}
                     </span>
                     
                     {result.source === 'stock' ? (
                       <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-md bg-[#009639]/10 text-[#009639] border border-[#009639]/20">
                         <span className="w-1.5 h-1.5 rounded-full bg-[#009639] mr-1.5"></span>
                         En Bóveda (Stock)
                       </span>
                     ) : result.estatus_entrega === 'Recibido' ? (
                       <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                         <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5"></span>
                         Lote Recibido
                       </span>
                     ) : (
                       <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-md bg-[#FE5000]/10 text-[#FE5000] border border-[#FE5000]/20">
                         <span className="w-1.5 h-1.5 rounded-full bg-[#FE5000] mr-1.5 animate-pulse"></span>
                         {result.estatus_entrega || 'En Tránsito'}
                       </span>
                     )}
                  </div>
                </div>
              </div>

              {/* Info Agencia */}
              <div className="p-6 md:w-2/3">
                <span className="block text-[10px] font-bold text-[#FE5000] uppercase tracking-widest mb-4">Ubicación Asignada</span>
                
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Agencia (Código)</span>
                    <span className="font-bold text-gray-900 text-lg">{result.codigo_agencia}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nombre</span>
                    <span className="font-bold text-gray-800">{result.agencias?.nombre}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Estado</span>
                    <span className="font-bold text-gray-800">{result.agencias?.estado || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Región / Zona</span>
                    <span className="font-bold text-gray-800">{result.agencias?.region} / {result.agencias?.zona}</span>
                  </div>
                  
                  {result.source === 'despacho' && (
                    <>
                      <div className="col-span-2 pt-4 border-t border-gray-100">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Rango del Lote Asignado</span>
                        <div className="flex justify-between max-w-sm mt-1">
                           <span className="font-mono text-gray-600 text-xs font-bold">I: {result.correlativo_inicial?.replace(/(.{4})/g, '$1 ').trim()}</span>
                           <span className="font-mono text-gray-600 text-xs font-bold">F: {result.correlativo_final?.replace(/(.{4})/g, '$1 ').trim()}</span>
                        </div>
                      </div>
                      
                      <div className="col-span-2 pt-4 border-t border-gray-100 grid grid-cols-2 gap-y-4 gap-x-4">
                        <div>
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Volumen Despachado</span>
                          <span className="font-bold text-gray-800">{result.cantidad ? Number(result.cantidad).toLocaleString('es-VE') : "—"} UND</span>
                        </div>
                        {result.estatus_entrega === 'Recibido' && (
                          <>
                            <div>
                              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha de Recepción</span>
                              <span className="font-bold text-[#009639]">{result.fecha_recepcion ? new Date(result.fecha_recepcion).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : "—"}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Recibido Por</span>
                              <span className="font-bold text-gray-800">{result.recibido_por || "—"}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {result.source === 'stock' && (
                    <div className="col-span-2 pt-4 border-t border-gray-100">
                      <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Gerente a Cargo</span>
                      <span className="font-bold text-gray-800">{result.agencias?.gerente || "—"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
