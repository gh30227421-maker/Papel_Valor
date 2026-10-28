"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import CustomSelect from "./ui/CustomSelect";
import { toast } from "sonner";
import { CheckCircle, Clock, MapPin, Search, Filter, X, Camera, Copy, Download, FileSpreadsheet, Check } from "lucide-react";
import { formatDisplayDate } from "@/lib/dateUtils";
import { toBlob, toPng, toJpeg } from "html-to-image";
import { saveAs } from "file-saver";

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
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");

  // Modal de Detalle del Día
  const [selectedDateModal, setSelectedDateModal] = useState<string | null>(null);
  const [dayDispatches, setDayDispatches] = useState<any[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [modalFilterZona, setModalFilterZona] = useState<string>("");
  const [modalFilterRegion, setModalFilterRegion] = useState<string>("");
  const [modalStatusFilter, setModalStatusFilter] = useState<"todos" | "recibido" | "transito">("todos");
  const [modalSearch, setModalSearch] = useState<string>("");

  // Modal Ficha Ejecutiva para Outlook
  const [showFichaModal, setShowFichaModal] = useState(false);
  const [fichaMode, setFichaMode] = useState<"pendientes" | "todos">("pendientes");
  const [isGeneratingFicha, setIsGeneratingFicha] = useState(false);
  const fichaCardRef = useRef<HTMLDivElement>(null);
  const fichaTableRef = useRef<HTMLTableElement>(null);

  const openDayModal = async (date: string) => {
    setSelectedDateModal(date);
    setLoadingDay(true);
    setModalFilterZona("");
    setModalFilterRegion("");
    setModalStatusFilter("todos");
    setModalSearch("");

    const { data, error } = await supabase
      .from("despachos")
      .select(`
        id,
        codigo_agencia,
        cantidad,
        correlativo_inicial,
        correlativo_final,
        estatus_entrega,
        recibido_por,
        fecha_recepcion,
        agencias ( 
          nombre,
          region,
          zona,
          estado
        )
      `)
      .eq('fecha_despacho', date);
    
    if (data) setDayDispatches(data);
    setLoadingDay(false);
  };

  // Zonas únicas disponibles en el lote diario
  const modalAvailableZonas = useMemo(() => {
    const set = new Set<string>();
    dayDispatches.forEach((d) => {
      const z = d.agencias?.zona?.trim();
      if (z) set.add(z.toUpperCase());
    });
    return Array.from(set).sort();
  }, [dayDispatches]);

  // Regiones únicas disponibles en el lote diario
  const modalAvailableRegiones = useMemo(() => {
    const set = new Set<string>();
    dayDispatches.forEach((d) => {
      const r = d.agencias?.region?.trim();
      if (r) set.add(r.toUpperCase());
    });
    return Array.from(set).sort();
  }, [dayDispatches]);

  // Lista ordenada (RECIBIDOS PRIMERO) y filtrada por zona / región / estatus / texto
  const filteredDayDispatches = useMemo(() => {
    return dayDispatches
      .filter((d) => {
        if (modalStatusFilter === "recibido" && d.estatus_entrega !== "Recibido") return false;
        if (modalStatusFilter === "transito" && d.estatus_entrega === "Recibido") return false;

        if (modalFilterZona) {
          const z = (d.agencias?.zona || "").toUpperCase().trim();
          if (z !== modalFilterZona.toUpperCase().trim()) return false;
        }

        if (modalFilterRegion) {
          const r = (d.agencias?.region || "").toUpperCase().trim();
          if (r !== modalFilterRegion.toUpperCase().trim()) return false;
        }

        if (modalSearch.trim()) {
          const term = modalSearch.toLowerCase().trim();
          const code = String(d.codigo_agencia || "").toLowerCase();
          const name = String(d.agencias?.nombre || "").toLowerCase();
          const zona = String(d.agencias?.zona || "").toLowerCase();
          const reg = String(d.agencias?.region || "").toLowerCase();
          if (!code.includes(term) && !name.includes(term) && !zona.includes(term) && !reg.includes(term)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // 1. REGLA CLAVE: Recibidos siempre de primero
        const isRecibidoA = a.estatus_entrega === "Recibido" ? 0 : 1;
        const isRecibidoB = b.estatus_entrega === "Recibido" ? 0 : 1;
        if (isRecibidoA !== isRecibidoB) {
          return isRecibidoA - isRecibidoB;
        }
        // 2. Por código numérico de agencia
        const codeA = parseInt(a.codigo_agencia, 10) || 0;
        const codeB = parseInt(b.codigo_agencia, 10) || 0;
        return codeA - codeB;
      });
  }, [dayDispatches, modalStatusFilter, modalFilterZona, modalFilterRegion, modalSearch]);

  // Conteos calculados del modal
  const totalModalAgencias = dayDispatches.length;
  const totalModalRecibidos = dayDispatches.filter(d => d.estatus_entrega === 'Recibido').length;
  const totalModalTransito = totalModalAgencias - totalModalRecibidos;

  const filteredModalCount = filteredDayDispatches.length;
  const filteredModalRecibidos = filteredDayDispatches.filter(d => d.estatus_entrega === 'Recibido').length;
  const filteredModalTransito = filteredModalCount - filteredModalRecibidos;
  const filteredModalVolumen = filteredDayDispatches.reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);
  const percentRecibido = filteredModalCount > 0 ? Math.round((filteredModalRecibidos / filteredModalCount) * 100) : 0;

  // Elementos para la ficha de Outlook (pendientes por defecto o todos según el filtro)
  const fichaItems = useMemo(() => {
    return filteredDayDispatches.filter(d => {
      if (fichaMode === "pendientes") {
        return d.estatus_entrega !== "Recibido";
      }
      return true;
    });
  }, [filteredDayDispatches, fichaMode]);

  const fichaTotalQuantity = useMemo(() => {
    return fichaItems.reduce((acc, curr) => acc + (Number(curr.cantidad) || 0), 0);
  }, [fichaItems]);

  const handleCopyFichaImage = async () => {
    if (!fichaCardRef.current) return;
    setIsGeneratingFicha(true);
    try {
      const el = fichaCardRef.current;
      const width = el.offsetWidth || 940;
      const height = el.offsetHeight;

      const blob = await toBlob(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: width,
        height: height,
        canvasWidth: width * 2,
        canvasHeight: height * 2,
      });
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        toast.success("¡Imagen copiada al portapapeles!", {
          description: "Abre Outlook y presiona Ctrl + V para pegarla en el cuerpo del correo."
        });
      }
    } catch (err: any) {
      console.error("Error al copiar imagen:", err);
      toast.error("No se pudo copiar la imagen directa. Prueba con 'Copiar Tabla HTML'.");
    } finally {
      setIsGeneratingFicha(false);
    }
  };

  const handleCopyFichaTable = async () => {
    if (!fichaTableRef.current) return;
    try {
      const html = `<div style="font-family: 'Microsoft Sans Serif', Arial, sans-serif; font-size: 11pt; color: #222222; line-height: 1.4;">${fichaTableRef.current.outerHTML}</div>`;
      const blobHtml = new Blob([html], { type: "text/html" });
      const blobText = new Blob([fichaTableRef.current.innerText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        })
      ]);
      toast.success("¡Tabla copiada para Outlook!", {
        description: "Tipografía Microsoft Sans Serif lista para pegar con Ctrl + V."
      });
    } catch (err) {
      toast.error("Error al copiar la tabla al portapapeles.");
    }
  };

  const handleDownloadFicha = async (format: 'png' | 'jpg') => {
    if (!fichaCardRef.current) return;
    setIsGeneratingFicha(true);
    try {
      const el = fichaCardRef.current;
      const width = el.offsetWidth || 940;
      const height = el.offsetHeight;

      const isPng = format === 'png';
      const safeDate = (selectedDateModal || 'Lote').replace(/[\/\\:*?"<>|]/g, '-');
      const safeFilter = (modalFilterRegion || modalFilterZona || (fichaMode === 'pendientes' ? 'Pendientes' : 'General'))
        .replace(/[\/\\:*?"<>|]/g, '-')
        .replace(/\s+/g, '_');
      const extension = isPng ? 'png' : 'jpg';
      const mimeType = isPng ? 'image/png' : 'image/jpeg';
      const fileName = `Ficha_BNC_${safeDate}_${safeFilter}.${extension}`;

      let blob: Blob | null = null;
      if (isPng) {
        blob = await toBlob(el, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          width: width,
          height: height,
          canvasWidth: width * 2,
          canvasHeight: height * 2,
        });
      } else {
        const jpegDataUrl = await toJpeg(el, {
          quality: 0.96,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          cacheBust: true,
          width: width,
          height: height,
          canvasWidth: width * 2,
          canvasHeight: height * 2,
        });
        const res = await fetch(jpegDataUrl);
        blob = await res.blob();
      }

      if (!blob) throw new Error("No se pudo generar la imagen");

      const typedBlob = new Blob([blob], { type: mimeType });

      // MÉTODO 1 (NATIVO WINDOWS / EDGE / CHROME): Abre el diálogo oficial "Guardar como..."
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: isPng ? 'Imagen PNG (*.png)' : 'Imagen JPEG (*.jpg)',
                accept: { [mimeType]: [`.${extension}`] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(typedBlob);
          await writable.close();
          toast.success(`¡Imagen ${extension.toUpperCase()} guardada con éxito!`, {
            description: `Guardada en su equipo como: ${fileName}`
          });
          return;
        } catch (pickerErr: any) {
          if (pickerErr.name === 'AbortError') {
            // Cancelado por el usuario en el explorador
            return;
          }
          console.warn("showSaveFilePicker no completado, usando saveAs:", pickerErr);
        }
      }

      // MÉTODO 2: file-saver (garantiza compatibilidad en Edge y Chrome)
      saveAs(typedBlob, fileName);
      toast.success(`¡Imagen ${extension.toUpperCase()} descargada con éxito!`, {
        description: `Archivo: ${fileName}`
      });
    } catch (err: any) {
      console.error(`Error al descargar ${format.toUpperCase()}:`, err);
      toast.error(`Error al generar archivo ${format.toUpperCase()}.`);
    } finally {
      setIsGeneratingFicha(false);
    }
  };

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

  const formatCorr = (c: string) => {
    if (!c) return "";
    const digits = String(c).replace(/\D/g, "");
    return digits.length > 0 ? digits.replace(/(.{4})/g, "$1 ").trim() : c;
  };

  const filteredData = data.filter((item) => {
    const matchRegion = filterRegion ? item.agencias?.region?.toLowerCase() === filterRegion.toLowerCase() : true;
    const matchEstado = filterEstado ? item.agencias?.estado?.toLowerCase().includes(filterEstado.toLowerCase()) : true;
    const matchAgency = filterAgency ? item.codigo_agencia.includes(filterAgency) : true;
    
    let matchDateStart = true;
    let matchDateEnd = true;
    if (filterDateStart) {
      matchDateStart = item.fecha_despacho >= filterDateStart;
    }
    if (filterDateEnd) {
      matchDateEnd = item.fecha_despacho <= filterDateEnd;
    }

    return matchRegion && matchEstado && matchAgency && matchDateStart && matchDateEnd;
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
      <div className="px-8 py-5 border-b border-gray-100 bg-gray-50 flex gap-4 flex-wrap">
        <div className="flex flex-col">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Desde</label>
          <input
            type="date"
            value={filterDateStart}
            onChange={(e) => setFilterDateStart(e.target.value)}
            className="w-36 px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] outline-none text-sm font-medium shadow-sm transition-all"
          />
        </div>
        <div className="flex flex-col">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Hasta</label>
          <input
            type="date"
            value={filterDateEnd}
            onChange={(e) => setFilterDateEnd(e.target.value)}
            className="w-36 px-3 py-2.5 bg-white text-gray-900 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] outline-none text-sm font-medium shadow-sm transition-all"
          />
        </div>
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
        {(filterRegion || filterEstado || filterAgency || filterDateStart || filterDateEnd) && (
          <div className="flex flex-col justify-end">
             <button 
                onClick={() => { setFilterRegion(""); setFilterEstado(""); setFilterAgency(""); setFilterDateStart(""); setFilterDateEnd(""); }}
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
                    <button 
                      onClick={() => openDayModal(row.fecha_despacho)}
                      className="hover:underline text-[#00205B] font-bold flex items-center gap-1.5 transition-colors bg-blue-50 px-2 py-1 rounded hover:bg-blue-100"
                      title="Ver todas las agencias despachadas este día"
                    >
                      {formatDisplayDate(row.fecha_despacho)}
                      <svg className="w-3.5 h-3.5 text-[#FE5000]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
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

      {/* MODAL DE RESUMEN DEL DÍA */}
      {selectedDateModal && (
        <div className="fixed inset-0 bg-[#0B132B]/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-5">
          <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full sm:w-[95vw] max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
            {/* Header del Modal */}
            <div className="bg-[#00205B] p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <MapPin className="w-5 h-5 text-[#FE5000]" />
                </div>
                <div>
                  <h3 className="text-white font-black text-xl tracking-tight leading-tight">Distribución del Lote Diario</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-blue-200 text-xs font-bold tracking-widest uppercase">
                      FECHA: {formatDisplayDate(selectedDateModal)}
                    </span>
                    <span className="text-white/40">•</span>
                    <span className="text-blue-200 text-xs font-semibold">
                      {totalModalAgencias} agencias programadas
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDateModal(null)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Filtros por Zona, Región, Estatus y Búsqueda */}
            <div className="bg-slate-50 border-b border-gray-200 p-3.5 shrink-0 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                
                {/* Filtro por Zona */}
                <CustomSelect
                  size="sm"
                  value={modalFilterZona}
                  onChange={setModalFilterZona}
                  className="w-48 sm:w-56"
                  icon={<Filter className="w-3.5 h-3.5 text-[#00205B]" />}
                  placeholder={`Todas las Zonas (${modalAvailableZonas.length})`}
                  options={[
                    { value: "", label: `Todas las Zonas (${modalAvailableZonas.length})` },
                    ...modalAvailableZonas.map((z) => {
                      const countInZona = dayDispatches.filter(d => (d.agencias?.zona || "").toUpperCase().trim() === z).length;
                      return {
                        value: z,
                        label: `Zona: ${z} (${countInZona})`
                      };
                    })
                  ]}
                />

                {/* Filtro por Región */}
                {modalAvailableRegiones.length > 1 && (
                  <CustomSelect
                    size="sm"
                    value={modalFilterRegion}
                    onChange={setModalFilterRegion}
                    className="w-44 sm:w-52"
                    icon={<span className="text-[10px] font-black text-gray-500 uppercase">REG:</span>}
                    placeholder="Todas las Regiones"
                    options={[
                      { value: "", label: "Todas las Regiones" },
                      ...modalAvailableRegiones.map((r) => {
                        const countInReg = dayDispatches.filter(d => (d.agencias?.region || "").toUpperCase().trim() === r).length;
                        return {
                          value: r,
                          label: `${r} (${countInReg})`
                        };
                      })
                    ]}
                  />
                )}

                {/* Buscador de Agencia */}
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Buscar código o nombre..."
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 placeholder-gray-400 outline-none focus:border-[#00205B] focus:ring-2 focus:ring-[#00205B]/10 shadow-2xs"
                  />
                  {modalSearch && (
                    <button 
                      onClick={() => setModalSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Botón limpiar filtros */}
                {(modalFilterZona || modalFilterRegion || modalStatusFilter !== "todos" || modalSearch) && (
                  <button
                    onClick={() => {
                      setModalFilterZona("");
                      setModalFilterRegion("");
                      setModalStatusFilter("todos");
                      setModalSearch("");
                    }}
                    className="text-xs font-bold text-gray-500 hover:text-red-600 px-2 py-1 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpiar
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Botón Ficha para Outlook */}
                <button
                  type="button"
                  onClick={() => setShowFichaModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00205B] hover:bg-[#00153D] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer hover:shadow-md"
                  title="Generar Ficha Ejecutiva para Outlook (Imagen / Tabla)"
                >
                  <Camera className="w-3.5 h-3.5 text-[#FE5000]" />
                  <span>Ficha para Outlook</span>
                  {filteredModalTransito > 0 && (
                    <span className="bg-[#FE5000] text-white px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none">
                      {filteredModalTransito}
                    </span>
                  )}
                </button>

                {/* Segmented Control de Estatus */}
                <div className="flex bg-gray-200/80 p-0.5 rounded-lg text-xs font-bold shadow-2xs">
                  <button
                    onClick={() => setModalStatusFilter("todos")}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                      modalStatusFilter === "todos"
                        ? "bg-white text-gray-900 shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Todos ({totalModalAgencias})
                  </button>
                  <button
                    onClick={() => setModalStatusFilter("recibido")}
                    className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      modalStatusFilter === "recibido"
                        ? "bg-green-600 text-white shadow-xs"
                        : "text-gray-600 hover:text-green-700"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${modalStatusFilter === "recibido" ? "bg-white" : "bg-green-500"}`}></span>
                    Recibidos ({totalModalRecibidos})
                  </button>
                  <button
                    onClick={() => setModalStatusFilter("transito")}
                    className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      modalStatusFilter === "transito"
                        ? "bg-[#FE5000] text-white shadow-xs"
                        : "text-gray-600 hover:text-[#FE5000]"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${modalStatusFilter === "transito" ? "bg-white" : "bg-[#FE5000]"}`}></span>
                    En Tránsito ({totalModalTransito})
                  </button>
                </div>
              </div>
            </div>

            {/* Contenido / Tabla del Modal */}
            <div className="flex-1 overflow-auto p-0 bg-white">
              {loadingDay ? (
                <div className="flex flex-col justify-center items-center h-64">
                  <svg className="animate-spin h-8 w-8 text-[#00205B] mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-sm font-bold text-gray-500">Cargando distribución del lote...</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-100 sticky top-0 z-10 shadow-xs border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-5 font-black text-[10px] uppercase tracking-widest text-[#00205B]">Agencia</th>
                      <th className="py-3 px-4 font-black text-[10px] uppercase tracking-widest text-gray-500">Zona / Región</th>
                      <th className="py-3 px-4 font-black text-[10px] uppercase tracking-widest text-gray-500 text-right">Cant. TDD</th>
                      <th className="py-3 px-4 font-black text-[10px] uppercase tracking-widest text-center text-gray-500">Correlativos</th>
                      <th className="py-3 px-4 font-black text-[10px] uppercase tracking-widest text-center text-gray-500">Estado</th>
                      <th className="py-3 px-5 font-black text-[10px] uppercase tracking-widest text-gray-500">Recibido Por / Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDayDispatches.map((d) => {
                      const isRecibido = d.estatus_entrega === "Recibido";
                      return (
                        <tr 
                          key={d.id} 
                          className={`transition-colors ${
                            isRecibido 
                              ? "bg-green-50/25 hover:bg-green-50/60" 
                              : "hover:bg-blue-50/40"
                          }`}
                        >
                          {/* Agencia */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2.5">
                              <span className={`font-mono text-xs font-black px-2 py-0.5 rounded shadow-2xs shrink-0 ${
                                isRecibido 
                                  ? "bg-green-100 text-green-900 border border-green-200" 
                                  : "bg-gray-100 text-gray-800 border border-gray-200"
                              }`}>
                                {d.codigo_agencia}
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-gray-900 block text-xs truncate leading-tight">
                                  {d.agencias?.nombre}
                                </span>
                                {(d.agencias?.estado || d.agencias?.region) && (
                                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide block mt-0.5">
                                    {d.agencias?.estado || d.agencias?.region}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Zona / Región */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-[11px] text-[#00205B] bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded uppercase block w-fit">
                              {d.agencias?.zona || d.agencias?.region || "—"}
                            </span>
                            {d.agencias?.region && d.agencias?.zona && (
                              <span className="text-[9px] text-gray-400 font-semibold uppercase block mt-0.5">
                                Región: {d.agencias?.region}
                              </span>
                            )}
                          </td>

                          {/* Cantidad */}
                          <td className="py-3.5 px-4 text-right font-black text-gray-900 font-mono text-sm">
                            {new Intl.NumberFormat("es-VE").format(d.cantidad)}
                          </td>

                          {/* Correlativos */}
                          <td className="py-3.5 px-4 text-center">
                            {d.correlativo_inicial && d.correlativo_final ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="font-mono text-[10px] font-bold text-gray-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap shadow-2xs">
                                  {formatCorr(d.correlativo_inicial)}
                                </span>
                                <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider my-0.5">al</span>
                                <span className="font-mono text-[10px] font-bold text-gray-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap shadow-2xs">
                                  {formatCorr(d.correlativo_final)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs italic font-mono">—</span>
                            )}
                          </td>

                          {/* Estado con Badges Modernos */}
                          <td className="py-3.5 px-4 text-center">
                            {isRecibido ? (
                              <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-green-100 text-green-800 border border-green-200 shadow-2xs">
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-600" />
                                Recibido
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-orange-100 text-orange-800 border border-orange-200 shadow-2xs">
                                <Clock className="w-3.5 h-3.5 mr-1 text-orange-600" />
                                En Tránsito
                              </span>
                            )}
                          </td>

                          {/* Recibido por */}
                          <td className="py-3.5 px-5">
                            {isRecibido ? (
                              <div>
                                <span className="block font-bold text-gray-900 text-xs">
                                  {d.recibido_por || "Personal de Agencia"}
                                </span>
                                {d.fecha_recepcion && (
                                  <span className="block text-[10px] text-gray-500 font-mono mt-0.5">
                                    {new Date(d.fecha_recepcion).toLocaleString("es-VE", {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    })}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic flex items-center gap-1">
                                <Clock className="w-3 h-3 text-gray-300" />
                                Pendiente por confirmar
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredDayDispatches.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500">
                          <Filter className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-bold text-gray-700">No hay agencias con los filtros seleccionados.</p>
                          <p className="text-xs text-gray-400 mt-1">Prueba seleccionando otra zona o limpiando la búsqueda.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer Resumen Inteligente */}
            {!loadingDay && dayDispatches.length > 0 && (
              <div className="bg-gray-100/90 p-4 shrink-0 flex flex-wrap justify-between items-center border-t border-gray-200 gap-4">
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">Agencias</span>
                    <span className="font-black text-gray-800 text-lg">
                      {filteredModalCount}
                      {filteredModalCount !== totalModalAgencias && (
                        <span className="text-xs font-normal text-gray-400"> / {totalModalAgencias}</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="w-px h-8 bg-gray-300"></div>

                  <div className="text-center">
                    <span className="block text-[9px] font-black text-green-700 uppercase tracking-wider">Recibidos</span>
                    <span className="font-black text-green-700 text-lg">
                      {filteredModalRecibidos}
                    </span>
                  </div>

                  <div className="w-px h-8 bg-gray-300"></div>

                  <div className="text-center">
                    <span className="block text-[9px] font-black text-[#FE5000] uppercase tracking-wider">En Tránsito</span>
                    <span className="font-black text-[#FE5000] text-lg">
                      {filteredModalTransito}
                    </span>
                  </div>

                  <div className="w-px h-8 bg-gray-300 hidden sm:block"></div>

                  {/* Barra de Progreso / Efectividad */}
                  <div className="hidden sm:block min-w-[120px]">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase text-gray-500 mb-1">
                      <span>Avance</span>
                      <span className="text-green-700 font-bold">{percentRecibido}%</span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-green-600 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percentRecibido}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">Volumen TDD</span>
                  <span className="font-black text-[#FE5000] text-xl">
                    {new Intl.NumberFormat("es-VE").format(filteredModalVolumen)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL FICHA EJECUTIVA PARA OUTLOOK */}
      {showFichaModal && (
        <div 
          className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setShowFichaModal(false)}
        >
          <div 
            className="bg-slate-100 rounded-3xl shadow-2xl border border-slate-300 max-w-7xl w-full sm:w-[95vw] flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="bg-[#00205B] p-4 sm:p-5 flex flex-wrap justify-between items-center gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <Camera className="w-5 h-5 text-[#FE5000]" />
                </div>
                <div>
                  <h3 className="text-white font-black text-lg sm:text-xl tracking-tight leading-tight">
                    Ficha de Seguimiento para Outlook
                  </h3>
                  <p className="text-blue-200 text-xs">
                    Copia en 1 clic la imagen o tabla para pegarla con Ctrl+V en tu correo de Outlook, o descárgala en PNG/JPG
                  </p>
                </div>
              </div>

              {/* Botón Cerrar */}
              <button 
                onClick={() => setShowFichaModal(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Acciones y Modos */}
            <div className="bg-white border-b border-slate-200 p-3 sm:p-4 flex flex-wrap justify-between items-center gap-3 shrink-0">
              {/* Filtro de Modo: Pendientes vs Todos */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold shadow-2xs">
                <button
                  onClick={() => setFichaMode("pendientes")}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    fichaMode === "pendientes"
                      ? "bg-[#FE5000] text-white shadow-xs"
                      : "text-slate-600 hover:text-[#FE5000]"
                  }`}
                >
                  <span>Solo Pendientes</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${fichaMode === "pendientes" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                    {filteredDayDispatches.filter(d => d.estatus_entrega !== "Recibido").length}
                  </span>
                </button>
                <button
                  onClick={() => setFichaMode("todos")}
                  className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                    fichaMode === "todos"
                      ? "bg-[#00205B] text-white shadow-xs"
                      : "text-slate-600 hover:text-[#00205B]"
                  }`}
                >
                  <span>Ver Todos</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${fichaMode === "todos" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>
                    {filteredDayDispatches.length}
                  </span>
                </button>
              </div>

              {/* Botones de Exportación / Copiado */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyFichaImage}
                  disabled={isGeneratingFicha || fichaItems.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#00205B] hover:bg-[#00153D] text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                  title="Copia una imagen de alta resolución para presionar Ctrl+V en Outlook"
                >
                  <Copy className="w-3.5 h-3.5 text-[#FE5000]" />
                  <span>{isGeneratingFicha ? "Generando..." : "Copiar Imagen para Outlook"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyFichaTable}
                  disabled={fichaItems.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 cursor-pointer disabled:opacity-50"
                  title="Copia la tabla HTML con tipografía Microsoft Sans Serif"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#009639]" />
                  <span>Copiar Tabla HTML</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadFicha('png')}
                  disabled={isGeneratingFicha || fichaItems.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-300 cursor-pointer disabled:opacity-50 hover:border-slate-400"
                  title="Descargar imagen oficial en formato PNG (.png)"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Descargar PNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadFicha('jpg')}
                  disabled={isGeneratingFicha || fichaItems.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-300 cursor-pointer disabled:opacity-50 hover:border-slate-400"
                  title="Descargar imagen en formato JPG (.jpg)"
                >
                  <Download className="w-3.5 h-3.5 text-[#FE5000]" />
                  <span>Descargar JPG</span>
                </button>
              </div>
            </div>

            {/* Contenedor del Preview Scrolleable */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-200/70 flex justify-center items-start">
              {fichaItems.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-300 text-center max-w-md my-auto shadow-sm">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h4 className="text-base font-black text-[#00205B]">¡Al Día! No hay agencias pendientes</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Todas las agencias del filtro seleccionado ya confirmaron la recepción de sus tarjetas.
                  </p>
                </div>
              ) : (
                <div 
                  ref={fichaCardRef}
                  className="bg-white p-5 rounded-2xl border border-slate-300 shadow-lg w-[940px] min-w-[940px] shrink-0"
                  style={{ fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}
                >
                  {/* Encabezado Operativo del Envío (Limpio y sin logos pesados) */}
                  <div className="bg-[#00205B] text-white p-4 rounded-xl mb-3 flex justify-between items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 bg-[#FE5000] text-white text-[10px] font-black uppercase tracking-wider rounded">
                          {fichaMode === "pendientes" ? "PENDIENTES POR CONFIRMAR" : "DISTRIBUCIÓN DE LOTE"}
                        </span>
                        <span className="text-white text-xs font-bold">
                          Fecha de Envío: <strong className="text-orange-300 font-black text-sm">{formatDisplayDate(selectedDateModal)}</strong>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-blue-200">
                        <span className="text-blue-300 font-bold uppercase text-[9.5px]">Filtro:</span>
                        <span className="font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                          {modalFilterRegion ? `Región: ${modalFilterRegion}` : ''}
                          {modalFilterRegion && modalFilterZona ? ' • ' : ''}
                          {modalFilterZona ? `Zona: ${modalFilterZona}` : ''}
                          {!modalFilterRegion && !modalFilterZona ? 'Todas las Regiones y Zonas' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-lg text-right">
                        <span className="block text-[9px] font-bold text-blue-200 uppercase tracking-wider">Agencias</span>
                        <span className="text-base font-black text-[#FE5000] leading-none">
                          {fichaItems.length}
                        </span>
                      </div>
                      <div className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-lg text-right">
                        <span className="block text-[9px] font-bold text-blue-200 uppercase tracking-wider">Total TDD</span>
                        <span className="text-base font-black text-[#00E676] leading-none">
                          {new Intl.NumberFormat('es-VE').format(fichaTotalQuantity)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tabla de Agencias (Sin overflow interno para captura completa 100%) */}
                  <table 
                    ref={fichaTableRef}
                    className="w-full text-left text-xs border-collapse rounded-xl overflow-hidden border border-slate-300"
                    style={{ fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}
                  >
                    <thead>
                      <tr className="bg-[#00205B] text-white font-bold text-[9.5px] uppercase tracking-wider" style={{ fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>
                        <th className="py-2.5 px-3 border-r border-[#2d3a5c] text-center w-[65px]">Cód</th>
                        <th className="py-2.5 px-3 border-r border-[#2d3a5c] w-[270px]">Agencia</th>
                        <th className="py-2.5 px-3 border-r border-[#2d3a5c] w-[165px]">Zona / Región</th>
                        <th className="py-2.5 px-3 border-r border-[#2d3a5c] text-center w-[90px]">Cant. TDD</th>
                        <th className="py-2.5 px-3 border-r border-[#2d3a5c] text-center w-[260px]">Correlativos</th>
                        <th className="py-2.5 px-3 text-center w-[90px]">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {fichaItems.map((d: any, idx: number) => (
                        <tr key={d.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"} style={{ fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>
                          <td className="py-2 px-3 font-mono font-bold text-[#00205B] border-r border-slate-200 text-center">
                            {d.codigo_agencia}
                          </td>
                          <td className="py-2 px-3 font-bold text-gray-900 border-r border-slate-200">
                            {d.agencias?.nombre}
                          </td>
                          <td className="py-2 px-3 text-gray-600 border-r border-slate-200 text-[10px]">
                            {d.agencias?.zona || d.agencias?.region}
                          </td>
                          <td className="py-2 px-3 font-mono font-black text-gray-900 text-center border-r border-slate-200">
                            {new Intl.NumberFormat('es-VE').format(d.cantidad)}
                          </td>
                          <td className="py-2 px-3 font-mono text-[10px] text-gray-700 text-center border-r border-slate-200 whitespace-nowrap">
                            {formatCorr(d.correlativo_inicial)} al {formatCorr(d.correlativo_final)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-bold ${d.estatus_entrega === 'Recibido' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-[#FE5000] border border-orange-200'}`}>
                              {d.estatus_entrega || "En Tránsito"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-[#00205B] text-[10.5px] border-t-2 border-slate-300" style={{ fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>
                        <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider border-r border-slate-200">
                          TOTAL ({fichaItems.length} AGENCIAS):
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-center text-[#FE5000] border-r border-slate-200 text-xs">
                          {new Intl.NumberFormat('es-VE').format(fichaTotalQuantity)}
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-[9.5px] text-gray-500 italic">
                          {fichaMode === "pendientes" ? "Lotes en tránsito por confirmar" : "Total consolidado"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Pie de Ficha Operativo */}
                  <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-gray-500" style={{ fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>
                    <p className="italic font-medium">
                      * Favor notificar a las agencias listadas confirmar la recepción en el sistema de Papel Valor.
                    </p>
                    <p className="font-bold text-[#00205B]">
                      Control de Papel Valor • BNC
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
