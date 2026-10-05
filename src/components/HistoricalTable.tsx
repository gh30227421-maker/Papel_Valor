"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import CustomSelect from "./ui/CustomSelect";
import { toast } from "sonner";

type DespachoItem = {
  id: string;
  fecha_despacho: string;
  codigo_agencia: string;
  correlativo_inicial: string;
  correlativo_final: string;
  cantidad: number;
  estatus_entrega?: string;
  agencias?: {
    nombre: string;
    region: string;
    estado: string;
  };
};

export default function HistoricalTable() {
  const [data, setData] = useState<DespachoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [filterRegion, setFilterRegion] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterAgency, setFilterAgency] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data: result, error } = await supabase
      .from("despachos")
      .select(`
        id,
        fecha_despacho,
        codigo_agencia,
        correlativo_inicial,
        correlativo_final,
        cantidad,
        estatus_entrega,
        agencias (
          nombre,
          region,
          estado
        )
      `)
      .order('fecha_despacho', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching despachos:", error);
      setFetchError(error.message);
    } else {
      setFetchError(null);
      if (result) {
        setData(result as unknown as DespachoItem[]);
      }
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este despacho? Esta acción no se puede deshacer.")) return;
    
    setLoading(true);
    const { error } = await supabase.from("despachos").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar: " + error.message);
      setLoading(false);
    } else {
      toast.success("Despacho eliminado correctamente");
      fetchData();
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCorr = (c: string) => c.length === 16 ? c.replace(/(.{4})/g, '$1 ').trim() : c;

  const filteredData = data.filter((item) => {
    const matchRegion = filterRegion ? item.agencias?.region?.toLowerCase() === filterRegion.toLowerCase() : true;
    const matchEstado = filterEstado ? item.agencias?.estado?.toLowerCase().includes(filterEstado.toLowerCase()) : true;
    const matchAgency = filterAgency ? item.codigo_agencia.includes(filterAgency) : true;
    return matchRegion && matchEstado && matchAgency;
  });

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-16rem)] min-h-[500px]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#00205B] tracking-tight">Histórico de Movimientos</h2>
          <p className="text-sm text-gray-500 mt-1">Consulta y trazabilidad en tiempo real de lotes asignados</p>
        </div>
        
        <div className="flex gap-4">
          <button onClick={fetchData} className="p-2 text-gray-400 hover:text-[#00205B] hover:bg-gray-50 rounded-md transition-colors" title="Actualizar datos">
            <svg className={`w-5 h-5 ${loading ? 'animate-spin text-[#00205B]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <div className="bg-[#FE5000]/10 border border-[#FE5000]/20 px-4 py-2 rounded-lg flex items-center shadow-sm">
            <span className="text-sm font-bold text-[#FE5000]">{filteredData.length}</span>
            <span className="text-[10px] font-bold text-[#FE5000]/80 ml-2 uppercase tracking-widest">Registros</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-5 border-b border-gray-100 bg-gray-50 flex gap-6 flex-wrap">
        <div className="flex flex-col">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Filtrar por Región</label>
          <CustomSelect
            value={filterRegion}
            onChange={setFilterRegion}
            className="w-48"
            options={[
              { value: "", label: "Todas las Regiones" },
              { value: "Capital", label: "Capital" },
              { value: "Oriente", label: "Oriente" },
              { value: "Occidente", label: "Occidente" },
              { value: "Guayana", label: "Guayana" },
              { value: "Los Andes", label: "Los Andes" }
            ]}
          />
        </div>
        <div className="flex flex-col">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Filtrar por Estado</label>
          <input
            type="text"
            placeholder="Ej. Miranda"
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="w-40 px-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] outline-none text-sm font-medium shadow-sm transition-all placeholder:text-gray-300"
          />
        </div>
        <div className="flex flex-col">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Buscar Agencia</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Ej. 1001"
              value={filterAgency}
              onChange={(e) => setFilterAgency(e.target.value.replace(/\D/g, ""))}
              maxLength={4}
              className="w-48 pl-9 pr-4 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] outline-none text-sm font-medium shadow-sm transition-all placeholder:text-gray-300"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        
        {/* Clear Filters Button */}
        {(filterRegion || filterEstado || filterAgency) && (
          <div className="flex flex-col justify-end">
             <button 
                onClick={() => { setFilterRegion(""); setFilterEstado(""); setFilterAgency(""); }}
                className="px-4 py-2.5 text-sm font-bold text-gray-500 hover:text-red-500 transition-colors flex items-center"
             >
               <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               Limpiar Filtros
             </button>
          </div>
        )}
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto flex-1 bg-white relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-10">
             <div className="flex flex-col items-center">
               <svg className="animate-spin h-8 w-8 text-[#00205B] mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
               <span className="text-sm font-bold text-[#00205B]">Cargando registros...</span>
             </div>
          </div>
        )}
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-500">Lote ID</th>
              <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-500">Fecha</th>
              <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-500">Agencia</th>
              <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-500">Ubicación</th>
              <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-500">Correlativos</th>
              <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-500 text-right">Cant. TDD</th>
              <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-500 text-center">Estado</th>
              <th className="py-4 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-500 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fetchError ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-12 h-12 text-red-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-red-500 font-bold">Error de conexión con la base de datos:</p>
                    <p className="text-gray-600 font-mono text-xs mt-2 max-w-lg bg-red-50 p-3 rounded">{fetchError}</p>
                  </div>
                </td>
              </tr>
            ) : filteredData.length > 0 ? (
              filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="py-4 px-6 font-mono text-[11px] font-bold text-gray-400 group-hover:text-[#00205B] transition-colors" title={row.id}>
                    {row.id.split('-')[0]}...
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-700 font-medium">
                    {new Date(row.fecha_despacho).toLocaleDateString('es-VE')}
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-bold text-gray-900 block">{row.codigo_agencia}</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wide">{row.agencias?.nombre}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-600 font-medium block">{row.agencias?.region || '—'}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{row.agencias?.estado || '—'}</span>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex flex-col text-[10px] font-mono tracking-wider text-gray-500">
                      <span>I: {formatCorr(row.correlativo_inicial)}</span>
                      <span>F: {formatCorr(row.correlativo_final)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right font-bold text-gray-900 font-mono text-base tracking-wide">
                    {new Intl.NumberFormat("es-VE").format(row.cantidad)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    {row.estatus_entrega === 'Recibido' ? (
                      <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md bg-[#009639]/10 text-[#009639] border border-[#009639]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#009639] mr-1.5"></span>
                        Recibido
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md bg-[#FE5000]/10 text-[#FE5000] border border-[#FE5000]/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FE5000] mr-1.5 animate-pulse"></span>
                        En Tránsito
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button 
                      onClick={() => handleDelete(row.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                      title="Eliminar registro"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              !loading && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <p className="text-gray-500 font-medium">No se encontraron registros para los filtros aplicados.</p>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
