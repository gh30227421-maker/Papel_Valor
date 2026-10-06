"use client";

import React, { useState, useEffect, useCallback } from "react";
import LoadingOverlay from "./LoadingOverlay";
import { getAsignacionesPaginated, getEstadosActivos } from "@/actions/asignaciones";
import CustomSelect from "./ui/CustomSelect";

type AsignacionRow = {
  id: string;
  fecha_cod: string;
  transaccion: string;
  detalle_tra: string;
  tipo_tdd: string;
  codigo_agencia: string;
  tdd_nueva: string;
  tdd_vieja: string;
  agencia_nombre: string | null;
  agencia_estado: string | null;
  agencia_region: string | null;
};

export default function AsignacionesTable() {
  const [data, setData] = useState<AsignacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Paginación
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const pageSize = 50; // Para manejar volúmenes altos eficientemente

  // Filtros
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  
  // Catálogos
  const [estados, setEstados] = useState<string[]>([]);

  // Función envuelta en useCallback para recargar la tabla
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAsignacionesPaginated(page, pageSize, {
        search,
        estado: estadoFilter,
        fechaInicio,
        fechaFin,
      });
      setData(response.data as AsignacionRow[]);
      setTotalPages(response.totalPages);
      setTotalRows(response.totalRows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, estadoFilter, fechaInicio, fechaFin]);

  useEffect(() => {
    // Cargar catálogo de estados al inicio
    getEstadosActivos().then((res) => setEstados(res as string[]));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Manejo de reinicio de página cuando cambian los filtros (debounce manual simple)
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    setter(value);
    setPage(1); // Siempre volvemos a la página 1 al filtrar
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col">
      {/* Panel de Filtros Superior */}
      <div className="bg-[#0B132B] p-6 border-b-4 border-[#FE5000]">
        <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
          <div className="flex-1 max-w-sm">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Buscador Global</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                placeholder="Código o nombre de agencia..."
                value={search}
                onChange={(e) => handleFilterChange(setSearch, e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1c2642] text-white border border-[#2d3a5c] rounded-md focus:ring-2 focus:ring-[#FE5000]/50 focus:border-[#FE5000] outline-none text-sm placeholder:text-gray-500 transition-all"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Estado</label>
            <CustomSelect
              value={estadoFilter}
              onChange={(value) => handleFilterChange(setEstadoFilter, value)}
              theme="dark"
              className="w-40"
              buttonClassName="text-sm py-2 px-4 min-h-0 h-[38px] rounded-md"
              options={[
                { value: "", label: "Todos" },
                ...estados.map(est => ({ value: est, label: est }))
              ]}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Desde</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => handleFilterChange(setFechaInicio, e.target.value)}
              className="w-36 px-3 py-2 bg-[#1c2642] text-white border border-[#2d3a5c] rounded-md focus:ring-2 focus:ring-[#FE5000]/50 outline-none text-sm"
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Hasta</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => handleFilterChange(setFechaFin, e.target.value)}
              className="w-36 px-3 py-2 bg-[#1c2642] text-white border border-[#2d3a5c] rounded-md focus:ring-2 focus:ring-[#FE5000]/50 outline-none text-sm"
            />
          </div>

          <button 
            onClick={() => { setSearch(""); setEstadoFilter(""); setFechaInicio(""); setFechaFin(""); setPage(1); }}
            className="px-4 py-2 bg-transparent text-gray-400 hover:text-white border border-gray-600 rounded-md text-sm font-bold transition-colors h-9 flex items-center"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-x-auto min-h-[500px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center min-h-[400px]">
             <LoadingOverlay fullScreen={false} />
          </div>
        )}
        
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-gray-500 whitespace-nowrap">Fecha</th>
              <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-gray-500">Agencia / Ubicación</th>
              <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-gray-500">Tipo / Transacción</th>
              <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-gray-500">TDD Nueva</th>
              <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-gray-500">TDD Vieja</th>
              <th className="py-3 px-4 font-bold text-[10px] uppercase tracking-widest text-gray-500">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">No se encontraron registros para estos filtros.</td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">
                    {/* Evitar el desfase de zona horaria extrayendo directamente de YYYY-MM-DD */}
                    {row.fecha_cod 
                      ? `${row.fecha_cod.substring(8,10)}/${row.fecha_cod.substring(5,7)}/${row.fecha_cod.substring(0,4)}`
                      : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <span className="font-mono font-bold text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 mr-2 border border-gray-200">
                        {row.codigo_agencia}
                      </span>
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${row.agencia_nombre ? 'text-[#0B132B]' : 'text-red-500 italic'}`}>
                          {row.agencia_nombre || "AGENCIA CERRADA / NO CATALOGADA"}
                        </span>
                        {row.agencia_estado && (
                          <span className="text-[10px] text-gray-400 uppercase font-medium">{row.agencia_estado} • {row.agencia_region}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                     <span className="block text-xs font-bold text-gray-800">{row.tipo_tdd}</span>
                     <span className="block text-[10px] text-gray-400 uppercase tracking-wider">{row.transaccion}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#009639] font-bold">{row.tdd_nueva || "—"}</td>
                  <td className="py-3 px-4 font-mono text-xs text-gray-400">{row.tdd_vieja || "—"}</td>
                  <td className="py-3 px-4 text-xs text-gray-500 max-w-xs truncate" title={row.detalle_tra}>{row.detalle_tra || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-between">
        <div className="text-xs text-gray-500 font-medium">
          Mostrando {totalRows === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalRows)} de <span className="font-bold text-[#0B132B]">{totalRows.toLocaleString()}</span> registros
        </div>
        <div className="flex items-center space-x-2">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm font-bold text-[#0B132B] px-3">
            Página {page} de {totalPages || 1}
          </span>
          <button 
            disabled={page === totalPages || totalPages === 0}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
