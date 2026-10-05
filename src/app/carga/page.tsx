"use client";

import React, { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

const TABLES = [
  { id: "asignaciones_diarias", name: "Asignaciones Diarias", cols: ["fecha_cod", "transaccion", "detalle_tra", "tipo_tdd", "codigo_agencia", "tdd_nueva", "tdd_vieja"], desc: "Carga diaria acumulativa. Actualiza el Dashboard automáticamente." },
  { id: "stock_actual", name: "Stock Actual", cols: ["codigo_agencia", "tipo", "correlativo"], desc: "¡ATENCIÓN! Reemplaza totalmente el inventario actual (Sustitución Total)." },
  { id: "agencias", name: "Agencias", cols: ["codigo", "nombre", "region", "estado", "zona", "gerente", "estatus"], desc: "Carga del maestro de agencias." },
  { id: "metas_agencias", name: "Metas de Agencias", cols: ["codigo_agencia", "mes", "anio", "meta_cantidad"], desc: "Carga de objetivos mensuales." },
];

export default function CargaMasiva() {
  const [selectedTable, setSelectedTable] = useState(TABLES[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTableDef = TABLES.find(t => t.id === selectedTable)!;

  const handleDownloadTemplate = () => {
    const table = activeTableDef;
    const wb = XLSX.utils.book_new();
    const wsData = [table.cols];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, `plantilla_${table.id}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("idle");
      setMessage("");
    }
  };

  const handleRemoveFile = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setFile(null);
    setStatus("idle");
    setMessage("");
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const processExcel = async () => {
    if (!file) return;
    
    setStatus("loading");
    setMessage("Analizando archivo Excel...");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Extraer cabeceras reales para validación
        const headerRow: string[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
        if (!headerRow) throw new Error("El archivo no tiene cabeceras.");

        const expectedCols = activeTableDef.cols;
        const missingCols = expectedCols.filter(col => !headerRow.map(h => h?.trim().toLowerCase()).includes(col.toLowerCase()));
        
        if (missingCols.length > 0) {
          throw new Error(`Faltan columnas requeridas: ${missingCols.join(", ")}. Por favor usa la Plantilla Oficial.`);
        }

        const records = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { 
          defval: null,
          raw: false, 
          dateNF: 'yyyy-mm-dd'
        });
        
        if (records.length === 0) {
          throw new Error("El archivo Excel está vacío (solo contiene la cabecera).");
        }

        const cleanedRecords = records.map(record => {
          const cleanRecord: Record<string, any> = {};
          Object.keys(record).forEach(key => {
            const cleanKey = key.trim().toLowerCase();
            if (expectedCols.map(c => c.toLowerCase()).includes(cleanKey)) {
              cleanRecord[cleanKey] = record[key] !== null ? String(record[key]).trim() : null;
            }
          });
          return cleanRecord;
        });

        // -------------------------------------------------------------
        // LÓGICA ESPECIAL POR MÓDULO
        // -------------------------------------------------------------
        if (selectedTable === "stock_actual") {
          setMessage("Borrando inventario anterior (Sustitución Total)...");
          // Borrar todo el stock actual (usamos not is null para asegurar el borrado masivo)
          const { error: delErr } = await supabase.from("stock_actual").delete().not("codigo_agencia", "is", null);
          if (delErr) throw new Error(`Error al borrar stock anterior: ${delErr.message}`);
        }

        // -------------------------------------------------------------
        // INSERCIÓN POR LOTES (CHUNKS)
        // -------------------------------------------------------------
        const CHUNK_SIZE = 5000;
        const totalChunks = Math.ceil(cleanedRecords.length / CHUNK_SIZE);

        for (let i = 0; i < cleanedRecords.length; i += CHUNK_SIZE) {
          const chunk = cleanedRecords.slice(i, i + CHUNK_SIZE);
          setMessage(`Insertando bloque ${Math.floor(i / CHUNK_SIZE) + 1} de ${totalChunks}... (${chunk.length} registros)`);
          
          const { error } = await supabase.from(selectedTable).insert(chunk);
          if (error) {
            console.error("Supabase Error en lote:", error);
            throw new Error(`Fallo en el bloque ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message}`);
          }
        }

        // -------------------------------------------------------------
        // ACCIONES POST-INSERCIÓN
        // -------------------------------------------------------------
        if (selectedTable === "asignaciones_diarias") {
          setMessage("Actualizando el Dashboard en tiempo real...");
          const { error: rpcErr } = await supabase.rpc("fn_refresh_dashboard_mv");
          if (rpcErr) {
            console.warn("Error al refrescar la vista materializada", rpcErr);
            throw new Error("Se subieron los datos, pero falló la actualización del dashboard.");
          }
        }

        setStatus("success");
        setMessage(`¡Éxito! Se procesaron ${cleanedRecords.length} registros en '${activeTableDef.name}'.`);
        setFile(null);
        if(fileInputRef.current) fileInputRef.current.value = '';

      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Error desconocido al procesar el Excel.");
      }
    };
    reader.onerror = () => {
      setStatus("error");
      setMessage("Ocurrió un error al intentar leer el archivo.");
    };
    
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] w-full">
      <main className="max-w-6xl mx-auto px-4 py-8 w-full animate-in fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#00205B] tracking-tight">Importación Masiva</h1>
          <p className="text-gray-500 mt-2">Carga centralizada de archivos Excel (.xlsx) y CSV (.csv). Selecciona el módulo a operar.</p>
        </div>

        {/* TABS SUPERIORES */}
        <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-gray-200 mb-6 overflow-x-auto">
          {TABLES.map((table) => (
            <button
              key={table.id}
              onClick={() => { setSelectedTable(table.id); handleRemoveFile(); }}
              className={`flex-1 min-w-[150px] py-3 px-4 rounded-lg text-sm font-bold transition-all ${
                selectedTable === table.id 
                  ? "bg-[#00205B] text-white shadow-md" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-[#00205B]"
              }`}
            >
              {table.name}
            </button>
          ))}
        </div>

        {/* CONTENEDOR DEL MÓDULO ACTIVO */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8">
            
            {/* Header del Tab */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-[#00205B]">Módulo: {activeTableDef.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{activeTableDef.desc}</p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="shrink-0 px-4 py-2 bg-blue-50 border border-blue-100 text-[#00205B] text-sm font-bold rounded-lg shadow-sm hover:bg-blue-100 transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Descargar Plantilla
              </button>
            </div>

            {/* ZONA DE CARGA */}
            <div className="mb-8">
              <label className="block text-sm font-bold text-gray-700 mb-3">Archivo a Procesar</label>
              
              {!file ? (
                // DROPZONE VACÍO
                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:bg-slate-50 transition-colors group cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className="text-base font-medium text-gray-700">Arrastra tu archivo Excel o CSV aquí o haz clic para explorar</p>
                  <p className="text-xs text-gray-400 mt-2">Solo archivos .xlsx o .csv con la estructura de la plantilla</p>
                </div>
              ) : (
                // ARCHIVO SELECCIONADO CON BOTÓN X
                <div className="border-2 border-[#009639] bg-[#009639]/5 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center">
                    <div className="w-14 h-14 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center mr-4 shrink-0">
                      <svg className="w-8 h-8 text-[#009639]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div>
                      <p className="text-base font-bold text-[#009639] break-all">{file.name}</p>
                      <p className="text-sm text-gray-600 mt-1">{(file.size / 1024).toFixed(2)} KB • Archivo cargado correctamente</p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveFile}
                    className="shrink-0 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg shadow-sm hover:bg-red-50 text-sm font-bold flex items-center transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    Remover Archivo
                  </button>
                </div>
              )}
            </div>

            {/* MENSAJES DE ESTADO */}
            {status === "error" && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium flex items-start animate-in fade-in">
                <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="leading-relaxed">{message}</span>
              </div>
            )}
            {status === "success" && (
              <div className="mb-6 p-4 bg-[#009639]/10 border border-[#009639]/20 text-[#009639] rounded-lg text-sm font-bold flex items-center animate-in fade-in">
                <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {message}
              </div>
            )}

            {/* BOTÓN DE EJECUCIÓN FINAL */}
            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={processExcel}
                disabled={!file || status === "loading"}
                className="px-8 py-3 bg-[#FE5000] text-white font-bold rounded-lg shadow-md hover:bg-[#e04800] focus:ring-4 focus:ring-[#FE5000]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {status === "loading" ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Procesando y Sincronizando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    Ejecutar Carga Masiva
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
