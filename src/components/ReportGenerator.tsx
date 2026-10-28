"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import CustomSelect from "./ui/CustomSelect";
import AgencyCombobox from "./ui/AgencyCombobox";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { getLocalTodayDate } from "@/lib/dateUtils";
import { Printer } from "lucide-react";

export default function ReportGenerator() {
  const [operator, setOperator] = useState("");
  const [date, setDate] = useState(() => getLocalTodayDate());
  const [despachos, setDespachos] = useState<any[]>([]);
  const [availableOperators, setAvailableOperators] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showLabelPrintModal, setShowLabelPrintModal] = useState(false);
  const emailRef = useRef<HTMLDivElement>(null);
  const printDocumentRef = useRef<HTMLDivElement>(null);
  const printLabelsRef = useRef<HTMLDivElement>(null);

  // Estados para Modo Coexistente: Histórico vs Etiquetas Masivas / Pre-Despacho
  const [activeMode, setActiveMode] = useState<"historico" | "masivo">("historico");
  const [masivoDate, setMasivoDate] = useState(() => getLocalTodayDate());
  const [masivoItems, setMasivoItems] = useState<any[]>([]);
  const [allAgencies, setAllAgencies] = useState<any[]>([]);
  const [selectedManualAgency, setSelectedManualAgency] = useState("");
  const [manualQuantity, setManualQuantity] = useState<number>(500);
  const [isDragging, setIsDragging] = useState(false);
  const [hasSavedPlan, setHasSavedPlan] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar lista de todas las agencias del sistema y verificar si hay plan previo
  useEffect(() => {
    const fetchAgencias = async () => {
      const { data } = await supabase
        .from("agencias")
        .select("codigo, nombre, region, zona")
        .order("nombre");
      if (data) {
        setAllAgencies(data);
      }
    };
    fetchAgencias();

    // Comprobar si se solicitó abrir en modo masivo o si hay un plan guardado del planificador
    const savedSubtab = localStorage.getItem('reporte_subtab');
    if (savedSubtab === 'masivo') {
      setActiveMode('masivo');
    }
    const savedPlan = localStorage.getItem('etiquetas_masivas_plan');
    if (savedPlan) {
      setHasSavedPlan(true);
      try {
        const parsed = JSON.parse(savedPlan);
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
          setMasivoItems(parsed.items);
          if (parsed.fecha) setMasivoDate(parsed.fecha);
        }
      } catch (e) {
        console.error("Error al leer plan inicial:", e);
      }
    }
  }, []);

  // Cargar lista dinámica de operadores únicos desde la base de datos y setear operador actual
  useEffect(() => {
    const fetchOperators = async () => {
      let currentUserNombre = "";

      // 1. Obtener el usuario actual y su perfil para autoseleccionarlo
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase.from("perfiles").select("nombre").eq("id", user.id).single();
        if (perfil && perfil.nombre) {
          currentUserNombre = perfil.nombre.trim();
          setOperator(currentUserNombre);
        }
      }

      // 2. Cargar operadores históricos
      const { data } = await supabase.from("despachos").select("elaborador");
      if (data) {
        const uniqueOps = Array.from(new Set(data.map(d => d.elaborador?.trim()).filter(Boolean))) as string[];
        
        // Asegurarnos de que el usuario actual esté en la lista aunque no tenga despachos previos
        if (currentUserNombre && !uniqueOps.includes(currentUserNombre)) {
          uniqueOps.push(currentUserNombre);
        }
        
        setAvailableOperators(uniqueOps.sort());
      }
    };
    fetchOperators();
  }, []);

  useEffect(() => {
    if (operator && date) {
      fetchDespachos();
    } else {
      setDespachos([]);
    }
  }, [operator, date]);

  const fetchDespachos = async () => {
    setIsLoading(true);
    
    // Si operator es "TODOS", traemos los despachos de ambos operadores para esa fecha
    let query = supabase
      .from("despachos")
      .select("*")
      .eq("fecha_despacho", date)
      .order("id", { ascending: true });

    if (operator !== "TODOS") {
      query = query.eq("elaborador", operator);
    }

    const { data: despachosData, error } = await query;

    if (error || !despachosData || despachosData.length === 0) {
      console.error("Error o sin datos:", error);
      setDespachos([]);
      setIsLoading(false);
      return;
    }

    // Luego buscamos los detalles de las agencias de forma manual
    const codigos = Array.from(new Set(despachosData.map(d => d.codigo_agencia).filter(Boolean)));
    
    let agenciasMap: any = {};
    if (codigos.length > 0) {
      const { data: agenciasData } = await supabase
        .from("agencias")
        .select("codigo, nombre, region, zona")
        .in("codigo", codigos);
        
      if (agenciasData) {
        agenciasMap = agenciasData.reduce((acc: any, ag: any) => {
          acc[ag.codigo] = ag;
          return acc;
        }, {});
      }
    }

    // Combinamos los datos
    let finalData = despachosData.map(d => ({
      ...d,
      agencias: agenciasMap[d.codigo_agencia] || { nombre: "Desconocida", region: "-", zona: "-" }
    }));

    // Ordenamiento Jerárquico: Región -> Zona -> Nombre de Agencia
    finalData.sort((a, b) => {
      const regA = (a.agencias.region || "").toLowerCase();
      const regB = (b.agencias.region || "").toLowerCase();
      if (regA !== regB) return regA.localeCompare(regB);
      
      const zonA = (a.agencias.zona || "").toLowerCase();
      const zonB = (b.agencias.zona || "").toLowerCase();
      if (zonA !== zonB) return zonA.localeCompare(zonB);
      
      const nomA = (a.agencias.nombre || "").toLowerCase();
      const nomB = (b.agencias.nombre || "").toLowerCase();
      return nomA.localeCompare(nomB);
    });

    setDespachos(finalData);
    setIsLoading(false);
  };

  const printElementIsolated = (element: HTMLElement, title: string, landscape: boolean) => {
    const existingIframe = document.getElementById("print-iframe");
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement("iframe");
    iframe.id = "print-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join("\n");

    const pageCss = landscape 
      ? `@page { size: letter landscape; margin: 6mm 8mm; }`
      : `@page { size: letter portrait; margin: 5mm; }`;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          ${styles}
          <style>
            ${pageCss}
            *, *::before, *::after {
              box-sizing: border-box;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
            }
            .page-break {
              break-after: page !important;
              page-break-after: always !important;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.warn("Fallback to standard print:", e);
        window.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 3000);
      }
    };

    const images = doc.querySelectorAll("img");
    if (images.length === 0) {
      setTimeout(triggerPrint, 300);
    } else {
      let loaded = 0;
      const total = images.length;
      const checkAllLoaded = () => {
        loaded++;
        if (loaded >= total) {
          setTimeout(triggerPrint, 200);
        }
      };
      images.forEach(img => {
        if (img.complete) {
          checkAllLoaded();
        } else {
          img.onload = checkAllLoaded;
          img.onerror = checkAllLoaded;
        }
      });
      setTimeout(triggerPrint, 1000);
    }
  };

  const handlePrint = () => {
    setShowPrintModal(true);
    setTimeout(() => {
      if (printDocumentRef.current) {
        printElementIsolated(printDocumentRef.current, "Relación de Despacho BNC", true);
      } else {
        window.print();
      }
    }, 400);
  };

  const handlePrintLabels = () => {
    setShowLabelPrintModal(true);
    setTimeout(() => {
      if (printLabelsRef.current) {
        printElementIsolated(printLabelsRef.current, "Etiquetas de Despacho BNC", false);
      } else {
        window.print();
      }
    }, 400);
  };

  const handleCopyEmail = async () => {
    if (!emailRef.current) return;
    
    try {
      // Método moderno para copiar HTML enriquecido garantizando tipografía Microsoft Sans Serif
      const innerHtml = emailRef.current.innerHTML;
      const htmlContent = `<div style="font-family: 'Microsoft Sans Serif', Arial, sans-serif; font-size: 14px; color: #222222; line-height: 1.5;">${innerHtml}</div>`;
      const blobHtml = new Blob([htmlContent], { type: "text/html" });
      const blobText = new Blob([emailRef.current.innerText], { type: "text/plain" });
      
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        })
      ]);
      toast.success("¡Correo copiado al portapapeles!", {
        description: "Tipografía Microsoft Sans Serif lista para Outlook."
      });
    } catch (err) {
      // Fallback
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(emailRef.current);
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("copy");
      selection?.removeAllRanges();
      toast.success("¡Correo copiado al portapapeles (modo fallback)!");
    }
  };

  const totalQuantity = despachos.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);
  const masivoTotalQuantity = masivoItems.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

  // Solución segura para evitar que la zona horaria le reste 1 día (ej. 5/10 se vuelva 4/10)
  const formatLocalDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Función para dar formato a los correlativos con espacios
  const formatCorrelativo = (corr: string) => {
    if (!corr) return "";
    return corr.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
  };

  // Configuración de paginación para reportes impresos
  const AGENCIAS_POR_PAGINA_RELACION = 25;
  const ETIQUETAS_POR_PAGINA = 4;

  // Función adaptativa de tamaño de fuente para que ningún nombre de agencia salga cortado en la etiqueta
  const getAdaptiveAgencyFontSize = (name?: string) => {
    if (!name) return "text-sm";
    const len = name.length;
    if (len > 38) return "text-[11px] leading-tight";
    if (len > 26) return "text-xs leading-tight";
    if (len > 16) return "text-[13px] leading-snug";
    return "text-sm leading-snug";
  };

  const handleModeChange = (newMode: "historico" | "masivo") => {
    setActiveMode(newMode);
    localStorage.setItem("reporte_subtab", newMode);
  };

  // Descarga de Plantilla Modelo en Excel
  const handleDownloadTemplate = () => {
    const wsData = [
      ["Codigo_Agencia", "Cantidad"],
      ["0102", 1000],
      ["0103", 500],
      ["0105", 1500]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 18 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Etiquetas");
    XLSX.writeFile(wb, "Plantilla_Etiquetas_Masivas.xlsx");
    toast.success("Plantilla descargada con éxito. Rellena los datos y súbela.");
  };

  // Procesamiento del archivo Excel / CSV subido
  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!json || json.length < 2) {
          toast.error("El archivo está vacío o no contiene filas de datos.");
          return;
        }

        // Buscar columnas correspondientes
        const headerRow = json[0].map((h: any) => String(h || "").trim().toLowerCase());
        let codeIdx = headerRow.findIndex((h: string) => 
          h.includes("cod") || h.includes("agencia") || h.includes("oficina")
        );
        let qtyIdx = headerRow.findIndex((h: string) => 
          h.includes("cant") || h.includes("unid") || h.includes("tdd") || h.includes("total") || h.includes("enviar")
        );

        if (codeIdx === -1) codeIdx = 0;
        if (qtyIdx === -1) qtyIdx = 1;

        const agenciasMap: Record<string, any> = {};
        allAgencies.forEach((ag) => {
          agenciasMap[String(ag.codigo).trim().toLowerCase()] = ag;
          const numOnly = String(ag.codigo).replace(/^0+/, "").toLowerCase();
          if (numOnly) agenciasMap[numOnly] = ag;
        });

        const parsedItems: any[] = [];
        let unknownCount = 0;

        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (!row || row.length === 0) continue;

          let rawCode = String(row[codeIdx] ?? "").trim();
          let rawQty = Number(row[qtyIdx] ?? 0);

          if (!rawCode || isNaN(rawQty) || rawQty <= 0) continue;
          if (rawCode.toLowerCase().includes("total")) continue;

          const codeKey = rawCode.toLowerCase();
          const codeKeyNoZeros = rawCode.replace(/^0+/, "").toLowerCase();
          const agData = agenciasMap[codeKey] || agenciasMap[codeKeyNoZeros];

          if (!agData) unknownCount++;

          parsedItems.push({
            id: `masivo-${Date.now()}-${i}-${rawCode}`,
            codigo_agencia: agData ? agData.codigo : rawCode,
            cantidad: rawQty,
            agencias: agData ? {
              nombre: agData.nombre,
              region: agData.region,
              zona: agData.zona
            } : {
              nombre: `Agencia ${rawCode}`,
              region: "—",
              zona: "—"
            }
          });
        }

        if (parsedItems.length === 0) {
          toast.error("No se encontraron registros válidos de código y cantidad en el archivo.");
          return;
        }

        // Orden jerárquico
        parsedItems.sort((a, b) => {
          const regA = (a.agencias.region || "").toLowerCase();
          const regB = (b.agencias.region || "").toLowerCase();
          if (regA !== regB) return regA.localeCompare(regB);
          const nomA = (a.agencias.nombre || "").toLowerCase();
          const nomB = (b.agencias.nombre || "").toLowerCase();
          return nomA.localeCompare(nomB);
        });

        setMasivoItems(parsedItems);
        toast.success(`¡Se importaron ${parsedItems.length} agencias listas para etiquetar!`);
        if (unknownCount > 0) {
          toast.info(`${unknownCount} códigos no coincidieron en el maestro, pero se etiquetarán con su código.`);
        }
      } catch (err) {
        console.error("Error al procesar archivo:", err);
        toast.error("Hubo un error al procesar el archivo Excel. Verifica el formato.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Cargar cálculo activo del Planificador de Envíos
  const handleLoadFromPlanner = () => {
    try {
      const savedPlan = localStorage.getItem("etiquetas_masivas_plan");
      if (!savedPlan) {
        toast.info("No se encontró ningún plan activo guardado en el Planificador de Envíos.");
        return;
      }
      const parsed = JSON.parse(savedPlan);
      if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        setMasivoItems(parsed.items);
        if (parsed.fecha) setMasivoDate(parsed.fecha);
        toast.success(`Se cargaron ${parsed.items.length} agencias desde el Planificador de Envíos.`);
      } else {
        toast.info("El plan guardado no contiene agencias con cantidades de envío.");
      }
    } catch (err) {
      console.error("Error al cargar plan:", err);
    }
  };

  // Agregar agencia manual
  const handleAddManualAgency = () => {
    if (!selectedManualAgency) {
      toast.error("Seleccione una agencia para agregar.");
      return;
    }
    if (!manualQuantity || manualQuantity <= 0) {
      toast.error("Ingrese una cantidad válida mayor a 0.");
      return;
    }

    const ag = allAgencies.find(a => a.codigo === selectedManualAgency);
    if (!ag) return;

    const existingIdx = masivoItems.findIndex(item => item.codigo_agencia === ag.codigo);
    if (existingIdx !== -1) {
      const updated = [...masivoItems];
      updated[existingIdx].cantidad += manualQuantity;
      setMasivoItems(updated);
      toast.success(`Cantidad actualizada para ${ag.codigo} - ${ag.nombre}`);
    } else {
      const newItem = {
        id: `manual-${Date.now()}-${ag.codigo}`,
        codigo_agencia: ag.codigo,
        cantidad: manualQuantity,
        agencias: {
          nombre: ag.nombre,
          region: ag.region,
          zona: ag.zona
        }
      };
      setMasivoItems(prev => [newItem, ...prev]);
      toast.success(`Agencia ${ag.codigo} agregada a la lista.`);
    }

    setSelectedManualAgency("");
  };

  const itemsToPrint = activeMode === "masivo" ? masivoItems : despachos;
  const dateToPrint = activeMode === "masivo" ? masivoDate : date;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
      
      {/* SELECTOR DE MODO SUPERIOR (COEXISTENCIA) */}
      <div className="p-3 bg-gray-100 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex bg-white p-1 rounded-xl shadow-xs border border-gray-200 w-full sm:w-auto">
          <button
            onClick={() => handleModeChange("historico")}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMode === "historico"
                ? "bg-[#00205B] text-white shadow-sm"
                : "text-gray-600 hover:text-[#00205B] hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Relación & Despachos Registrados
          </button>
          <button
            onClick={() => handleModeChange("masivo")}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
              activeMode === "masivo"
                ? "bg-[#FE5000] text-white shadow-sm"
                : "text-gray-600 hover:text-[#FE5000] hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            Etiquetas Masivas / Pre-Despacho (Plantilla)
            {hasSavedPlan && activeMode !== "masivo" && (
              <span className="w-2 h-2 rounded-full bg-orange-400 absolute top-2 right-2 animate-ping"></span>
            )}
          </button>
        </div>

        <div className="text-[11px] font-bold text-gray-500">
          {activeMode === "historico" ? (
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00205B]"></span> Generación oficial con correlativos y correo</span>
          ) : (
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#FE5000]"></span> Preparación previa de valijas sin alterar la base de datos</span>
          )}
        </div>
      </div>

      {/* =========================================================
          MODO 1: HISTÓRICO Y DESPACHOS REGISTRADOS
          ========================================================= */}
      {activeMode === "historico" && (
        <div>
          {/* Controles de Filtro */}
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex flex-col lg:flex-row gap-6 items-end">
            <div className="w-full lg:w-1/4">
              <label className="block text-xs font-bold text-[#00205B] mb-2 uppercase tracking-wider">Fecha Histórica</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-white text-gray-900 font-bold border border-gray-300 rounded-lg outline-none focus:border-[#00205B] shadow-sm"
              />
            </div>
            <div className="w-full lg:w-1/4">
              <label className="block text-xs font-bold text-[#00205B] mb-2 uppercase tracking-wider">Operador</label>
              <CustomSelect
                value={operator}
                onChange={setOperator}
                className="w-full"
                placeholder="Seleccione un Operador..."
                options={[
                  { value: "", label: "Seleccione un Operador..." },
                  { value: "TODOS", label: "👥 Ambos Operadores" },
                  ...availableOperators.map(op => ({ value: op, label: op }))
                ]}
              />
            </div>
            
            <div className="w-full lg:w-2/4 flex gap-3">
              <button 
                  disabled={despachos.length === 0}
                  onClick={handlePrintLabels}
                  className="flex-1 bg-[#009639] text-white py-3 px-2 rounded-lg font-bold text-sm hover:bg-[#007a2e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md whitespace-nowrap cursor-pointer"
              >
                  Imprimir Etiquetas ({despachos.length})
              </button>
              <button 
                  disabled={despachos.length === 0}
                  onClick={handlePrint}
                  className="flex-1 bg-[#00205B] text-white py-3 px-2 rounded-lg font-bold text-sm hover:bg-[#00153B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md whitespace-nowrap cursor-pointer"
              >
                  Imprimir Relación ({Math.ceil(despachos.length / AGENCIAS_POR_PAGINA_RELACION) || 1} pág)
              </button>
              <button 
                  disabled={despachos.length === 0}
                  onClick={handleCopyEmail}
                  className="flex-1 bg-[#FE5000] text-white py-3 px-2 rounded-lg font-bold text-sm hover:bg-[#d94400] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md whitespace-nowrap cursor-pointer"
              >
                  Copiar Correo
              </button>
            </div>
          </div>

          {/* Resultados Preview Histórico */}
          <div className="p-8">
            {isLoading ? (
              <div className="text-center py-10 text-gray-400">Cargando...</div>
            ) : despachos.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-500 font-bold">No hay registros para la fecha y operador seleccionados.</p>
                <p className="text-sm text-gray-400 mt-1">Seleccione un operador y asegúrese de que la fecha sea correcta.</p>
              </div>
            ) : (
              <div className="space-y-12">
                
                {/* EMAIL PREVIEW */}
                <div>
                  <h4 className="text-[#009639] font-black text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Vista Previa del Correo Oficial
                  </h4>
                  <p className="text-xs text-gray-500 mb-4 italic">Puede hacer clic y editar cualquier parte del texto del correo antes de copiarlo.</p>
                  <div 
                    className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 shadow-sm text-sm text-gray-800 overflow-auto max-h-[500px] hover:border-gray-400 transition-colors cursor-text"
                  >
                    <div 
                      ref={emailRef} 
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      style={{ fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px", color: "#333", outline: "none" }}
                    >
                      <p style={{ margin: "0 0 12px 0", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px" }}><strong>Buen Día,</strong></p>
                      <p style={{ margin: "0 0 12px 0", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px" }}><strong>Estimados Regionales:</strong></p>
                      <p style={{ margin: "0 0 12px 0", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px" }}>Por medio de la presente, cumplo con informarles que se llevó a cabo la distribución de Tarjetas MasterCard Debit a las agencias detalladas a continuación.</p>
                      <p style={{ margin: "0 0 12px 0", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px" }}>Asimismo, es importante señalar que las oficinas que no hayan recibido el despacho correspondiente en la fecha actual se debe a que cuentan con un inventario adecuado de papel valor, calculado en base a sus consumos.</p>
                      <p style={{ margin: "0 0 12px 0", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px" }}>Aunado a eso a todas aquellas oficinas que dispongan de alguna Nomina, Jornada Especial, Operativos (Agencia Móvil), es sumamente importante que esta solicitud sea remitidas a nuestro buzón: <strong>papelvalor@bncenlinea.net</strong>, para que sean atendidas y estas no afecten el inventario mensual de la agencia.</p>
                      <p style={{ margin: "0 0 12px 0", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px" }}>En virtud de lo anterior, les solicitamos transmitir esta información de manera oportuna a todas las agencias pertenecientes a cada Región para asegurar que confirmen la recepción del envío, esencial para un seguimiento y control adecuado.</p>
                      
                      <ol style={{ paddingLeft: "20px", margin: "0 0 12px 0", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px" }}>
                        <li style={{ marginBottom: "8px", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}><strong>Conteo y Verificación:</strong> Se debe realizar un conteo físico exhaustivo de las tarjetas recibidas.</li>
                        <li style={{ fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}><strong>Confirmación de Recepción:</strong> solicitamos que todas las oficinas confirmen la recepción de las tarjetas y la cantidad exacta recibida utilizando el siguiente enlace: <a href={typeof window !== 'undefined' ? `${window.location.origin}/recepcion` : '#'} style={{color: "#00205B", textDecoration: "underline", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif"}}>{typeof window !== 'undefined' ? `${window.location.origin}/recepcion` : 'Enlace de Recepción'}</a></li>
                      </ol>
                      
                      <p style={{ margin: "0 0 12px 0", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px" }}>Agradecemos de antemano su colaboración y la difusión urgente de estas instrucciones a los funcionarios correspondientes para garantizar el control y la seguridad del Papel Valor.</p>
                      
                      <p style={{ margin: "0 0 12px 0", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif", fontSize: "14px" }}>Adjunto la relación de correspondencia del día de hoy:</p>
                      
                      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd", fontSize: "12px", cursor: "default", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }} contentEditable={false}>
                        <thead>
                          <tr style={{ backgroundColor: "#00205B", color: "white", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>
                            <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>Cód</th>
                            <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>Agencia</th>
                            <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>Región</th>
                            <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>Zona</th>
                            <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>Cant.</th>
                            <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>Correlativo Inicial</th>
                            <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>Correlativo Final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {despachos.map((d) => (
                            <tr key={d.id} style={{ fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>
                              <td style={{ border: "1px solid #ddd", padding: "8px", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>{d.codigo_agencia}</td>
                              <td style={{ border: "1px solid #ddd", padding: "8px", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>{d.agencias?.nombre}</td>
                              <td style={{ border: "1px solid #ddd", padding: "8px", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>{d.agencias?.region}</td>
                              <td style={{ border: "1px solid #ddd", padding: "8px", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>{d.agencias?.zona}</td>
                              <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center", fontWeight: "bold", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>{Number(d.cantidad).toLocaleString('es-VE')}</td>
                              <td style={{ border: "1px solid #ddd", padding: "8px", fontFamily: "monospace, 'Microsoft Sans Serif'", textAlign: "center" }}>{formatCorrelativo(d.correlativo_inicial)}</td>
                              <td style={{ border: "1px solid #ddd", padding: "8px", fontFamily: "monospace, 'Microsoft Sans Serif'", textAlign: "center" }}>{formatCorrelativo(d.correlativo_final)}</td>
                            </tr>
                          ))}
                          <tr style={{ backgroundColor: "#f9f9f9", fontWeight: "bold", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>
                            <td colSpan={4} style={{ border: "1px solid #ddd", padding: "8px", textAlign: "right", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>TOTAL GENERAL:</td>
                            <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center", color: "#009639", fontFamily: "'Microsoft Sans Serif', Arial, sans-serif" }}>{Number(totalQuantity).toLocaleString('es-VE')}</td>
                            <td colSpan={2} style={{ border: "1px solid #ddd", padding: "8px" }}></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          MODO 2: ETIQUETAS MASIVAS / PRE-DESPACHO (PLANTILLA)
          ========================================================= */}
      {activeMode === "masivo" && (
        <div className="p-6 sm:p-8 space-y-8 animate-in fade-in duration-300">
          
          {/* Panel Superior: 3 Vías de Carga */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* 1. Subir Plantilla Excel */}
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processExcelFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging 
                  ? "border-[#009639] bg-green-50/50 scale-[1.01]" 
                  : "border-gray-300 hover:border-[#00205B] bg-gray-50/60 hover:bg-white shadow-xs"
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processExcelFile(e.target.files[0]);
                  }
                }}
                className="hidden" 
              />
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#00205B] flex items-center justify-center mb-2.5 shadow-xs">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <h3 className="text-sm font-black text-gray-900 leading-tight">Cargar Archivo Excel o CSV</h3>
              <p className="text-[11px] text-gray-500 mt-1 max-w-[220px]">
                Arrastra tu lista aquí o haz clic para buscar (.xlsx, .csv)
              </p>
              <span className="mt-2.5 px-2.5 py-1 bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-600">
                Columnas: Código y Cantidad
              </span>
            </div>

            {/* 2. Descargar Plantilla Modelo */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="w-10 h-10 rounded-lg bg-green-50 text-[#009639] flex items-center justify-center mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </div>
                <h3 className="text-sm font-black text-gray-900">Plantilla Modelo Excel</h3>
                <p className="text-[11px] text-gray-500 mt-1">
                  Descarga un archivo con las columnas <code className="font-mono bg-gray-100 px-1 rounded text-gray-800">Codigo_Agencia</code> y <code className="font-mono bg-gray-100 px-1 rounded text-gray-800">Cantidad</code> para rellenar fácilmente.
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="mt-4 w-full py-2.5 px-3 bg-[#009639] hover:bg-[#007a2e] text-white text-xs font-black rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Descargar Plantilla (.xlsx)
              </button>
            </div>

            {/* 3. Traer desde el Planificador de Envíos */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between shadow-xs">
              <div>
                <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#FE5000] flex items-center justify-center mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-sm font-black text-gray-900">Desde Planificador TDD</h3>
                <p className="text-[11px] text-gray-500 mt-1">
                  Si calculaste un envío en el Planificador de Distribución, puedes importarlo directamente sin exportar archivos.
                </p>
              </div>
              <button
                onClick={handleLoadFromPlanner}
                className="mt-4 w-full py-2.5 px-3 bg-[#FE5000] hover:bg-[#d94400] text-white text-xs font-black rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Cargar Cálculo Activo
              </button>
            </div>

          </div>

          {/* Agregar Agencia Manualmente */}
          <div 
            className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-end shadow-2xs relative"
            style={{ zIndex: 30 }}
          >
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-black text-[#00205B] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#00205B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                Agregar Agencia Individual
              </label>
              <AgencyCombobox
                agencies={allAgencies}
                value={selectedManualAgency}
                onChange={setSelectedManualAgency}
                placeholder="Buscar agencia por código (#47), nombre o región..."
              />
            </div>
            <div className="w-full sm:w-44">
              <label className="block text-[10px] font-black text-[#00205B] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#00205B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                Cantidad (TDD)
              </label>
              <input 
                type="number"
                min="1"
                step="50"
                value={manualQuantity}
                onChange={(e) => setManualQuantity(Number(e.target.value) || 0)}
                className="w-full min-h-[44px] px-3.5 py-2 bg-white text-xs font-bold text-gray-800 border border-gray-300 rounded-xl outline-none focus:border-[#00205B] focus:ring-2 focus:ring-[#00205B]/15 shadow-xs"
              />
            </div>
            <button
              onClick={handleAddManualAgency}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2 bg-[#00205B] hover:bg-[#00153B] text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Agregar a la Lista
            </button>
          </div>

          {/* Resumen del Lote + Botón Principal de Impresión */}
          <div className="bg-gradient-to-r from-[#00205B] to-[#0B132B] text-white rounded-xl p-6 shadow-md flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            
            {/* Controles de Lote */}
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <label className="block text-[9px] font-bold text-blue-200 uppercase tracking-widest mb-1">
                  Fecha de Envío en Etiqueta
                </label>
                <input 
                  type="date"
                  value={masivoDate}
                  onChange={(e) => setMasivoDate(e.target.value)}
                  className="px-3 py-2 bg-white/10 border border-white/20 text-white font-bold text-xs rounded-lg outline-none focus:border-white shadow-inner"
                />
              </div>

              {/* KPIs */}
              <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                <div>
                  <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Agencias</p>
                  <p className="text-2xl font-black text-white leading-none mt-0.5">{masivoItems.length}</p>
                </div>
                <div className="h-8 w-px bg-white/10"></div>
                <div>
                  <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Total TDD</p>
                  <p className="text-2xl font-black text-[#FE5000] leading-none mt-0.5">
                    {masivoTotalQuantity.toLocaleString("es-VE")}
                  </p>
                </div>
                <div className="h-8 w-px bg-white/10"></div>
                <div>
                  <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Hojas Carta</p>
                  <p className="text-2xl font-black text-green-400 leading-none mt-0.5">
                    {Math.ceil(masivoItems.length / ETIQUETAS_POR_PAGINA) || 0}
                  </p>
                  <span className="text-[8px] text-gray-400 font-semibold">(4 por hoja)</span>
                </div>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
              {masivoItems.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("¿Deseas vaciar la lista actual de etiquetas?")) {
                      setMasivoItems([]);
                    }
                  }}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Limpiar Lista
                </button>
              )}

              <button
                disabled={masivoItems.length === 0}
                onClick={handlePrintLabels}
                className="flex-1 lg:flex-none px-8 py-3 bg-[#009639] hover:bg-[#007a2e] text-white text-sm font-black rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Imprimir Etiquetas Masivas ({masivoItems.length})
              </button>
            </div>

          </div>

          {/* Tabla Previa de Agencias a Etiquetar */}
          {masivoItems.length > 0 ? (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <p className="text-xs font-black text-gray-700 uppercase tracking-wider">
                  Listado de Etiquetas a Generar ({masivoItems.length})
                </p>
                <p className="text-[11px] text-gray-500">
                  Puedes editar la cantidad de cada agencia directamente antes de imprimir.
                </p>
              </div>
              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-100/70 sticky top-0 border-b border-gray-200 text-gray-700">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center font-bold">#</th>
                      <th className="py-2.5 px-3 w-24 font-bold">Cód.</th>
                      <th className="py-2.5 px-4 font-bold">Agencia</th>
                      <th className="py-2.5 px-4 font-bold">Región / Zona</th>
                      <th className="py-2.5 px-4 w-40 text-center font-bold">Cantidad TDD</th>
                      <th className="py-2.5 px-4 w-28 text-center font-bold">Ubicación Hoja</th>
                      <th className="py-2.5 px-3 w-16 text-center font-bold">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {masivoItems.map((item, idx) => {
                      const sheetNumber = Math.floor(idx / 4) + 1;
                      const posInSheet = (idx % 4) + 1;

                      return (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                          <td className="py-2 px-3 text-center text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 bg-[#00205B] text-white rounded font-mono font-bold text-xs">
                              {item.codigo_agencia}
                            </span>
                          </td>
                          <td className="py-2 px-4 font-bold text-gray-900">{item.agencias?.nombre}</td>
                          <td className="py-2 px-4 text-gray-600 text-[11px]">
                            {item.agencias?.region} &bull; {item.agencias?.zona}
                          </td>
                          <td className="py-2 px-4 text-center">
                            <input 
                              type="number"
                              min="1"
                              step="50"
                              value={item.cantidad}
                              onChange={(e) => {
                                const newQty = Number(e.target.value) || 0;
                                setMasivoItems(prev => prev.map(m => m.id === item.id ? { ...m, cantidad: newQty } : m));
                              }}
                              className="w-24 px-2 py-1 text-center font-bold text-[#009639] border border-gray-300 rounded focus:border-[#009639] outline-none"
                            />
                          </td>
                          <td className="py-2 px-4 text-center text-[10px] text-gray-500 font-medium">
                            Hoja {sheetNumber} (Pos. {posInSheet})
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => setMasivoItems(prev => prev.filter(m => m.id !== item.id))}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                              title="Quitar de la lista"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
              <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              </div>
              <p className="text-gray-700 font-bold text-sm">No hay agencias cargadas para etiquetar.</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Carga un archivo Excel/CSV con los códigos de agencia, impórtalas desde el Planificador o agrega agencias manualmente usando el selector superior.
              </p>
            </div>
          )}

        </div>
      )}

      {/* MODAL / VISTA DE IMPRESIÓN RELACIÓN (HISTÓRICO) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-gray-500/80 overflow-y-auto print:static print:bg-transparent">
          <div className="max-w-6xl mx-auto my-8 print:m-0 print:max-w-none print:w-full flex flex-col gap-8">
            
            {/* Controles Solo Pantalla */}
            <div className="flex justify-end bg-white p-4 rounded-lg shadow-md print:hidden sticky top-4 z-10">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors mr-4 cursor-pointer"
              >
                Cerrar Vista Previa
              </button>
              <button 
                onClick={() => {
                  if (printDocumentRef.current) {
                    printElementIsolated(printDocumentRef.current, "Relación de Despacho BNC", true);
                  } else {
                    window.print();
                  }
                }}
                className="px-6 py-2 bg-[#00205B] text-white font-bold rounded-lg hover:bg-[#00153B] transition-colors cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Documento</span>
              </button>
            </div>

            {/* DOCUMENTO OFICIAL BNC (PAGINADO) */}
            <div ref={printDocumentRef} className="print-document flex flex-col gap-8 print:gap-0">
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
                  nav, header, footer, button, .print\\:hidden { display: none !important; }
                  .print-document { display: block !important; position: static !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; }
                  @page { size: letter landscape; margin: 6mm 8mm; }
                  .page-break { break-after: page !important; page-break-after: always !important; }
                }
              `}} />

              {Array.from({ length: Math.ceil(despachos.length / AGENCIAS_POR_PAGINA_RELACION) || 1 }, (_, pageIndex) => {
                const chunk = despachos.slice(pageIndex * AGENCIAS_POR_PAGINA_RELACION, (pageIndex + 1) * AGENCIAS_POR_PAGINA_RELACION);
                const totalPages = Math.ceil(despachos.length / AGENCIAS_POR_PAGINA_RELACION) || 1;
                const isLastChunk = pageIndex === totalPages - 1;
                const pageTotalQuantity = chunk.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

                return ['ORIGINAL', 'COPIA (CORRESPONDENCIA)'].map((tipoCopia, copyIndex) => {
                  const isVeryLastElement = isLastChunk && copyIndex === 1;

                  return (
                    <div key={`${pageIndex}-${copyIndex}`} className={`bg-white p-6 shadow-lg print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-full ${!isVeryLastElement ? 'page-break' : ''} flex flex-col box-border`}>
                      
                      {/* Header */}
                      <div className="flex justify-between items-start border-b-2 border-[#00205B] pb-1.5 mb-2 shrink-0 print:w-full">
                        <div className="flex items-center gap-3 print:ml-4">
                          <img 
                            src="/logo-bnc.png" 
                            alt="Logo BNC" 
                            className="h-12 w-auto object-contain print:h-9"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div>
                            <h1 className="text-lg font-black text-[#00205B] tracking-tight leading-tight">BANCO NACIONAL DE CRÉDITO</h1>
                            <h2 className="text-[9.5px] font-bold text-gray-800 uppercase tracking-widest leading-tight">V.P.E BANCA COMERCIAL / ADMINISTRACIÓN DE AGENCIAS</h2>
                            <h3 className="text-[8.5px] font-bold text-gray-500 uppercase tracking-widest leading-tight">Inventario Papel Valor / Distribución MasterCard Debit</h3>
                          </div>
                        </div>
                        <div className="text-right print:mr-4">
                          <p className="text-[11px] font-bold text-gray-800">Fecha de Relación</p>
                          <p className="text-sm font-black text-[#FE5000] leading-tight">{formatLocalDate(date)}</p>
                          <p className="text-[9.5px] text-gray-500">Pág. {pageIndex + 1} / {totalPages}</p>
                          <p className="text-[9px] font-black text-[#009639] mt-0.5 border border-[#009639] px-2 py-0.5 rounded uppercase inline-block">{tipoCopia}</p>
                        </div>
                      </div>

                      {/* Table */}
                      <div className="flex-1 print:w-full print:px-2">
                        <table className="w-full text-left text-[9px] print:text-[8.5px] border-collapse" style={{ tableLayout: 'fixed' }}>
                          <thead>
                            <tr className="bg-gray-100 border-b-2 border-gray-300">
                              <th className="w-[6%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider">Cód</th>
                              <th className="w-[26%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider">Agencia</th>
                              <th className="w-[14%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider">Región</th>
                              <th className="w-[13%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider">Zona</th>
                              <th className="w-[8%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider text-center">Cant.</th>
                              <th className="w-[16.5%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider text-center">Corr. Inicial</th>
                              <th className="w-[16.5%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider text-center">Corr. Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chunk.map((d, i) => (
                              <tr key={d.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                <td className="py-[2.5px] px-1 font-bold text-gray-900 truncate">{d.codigo_agencia}</td>
                                <td className="py-[2.5px] px-1 text-gray-800 truncate" title={d.agencias?.nombre}>{d.agencias?.nombre}</td>
                                <td className="py-[2.5px] px-1 text-gray-600 text-[8.5px] truncate">{d.agencias?.region}</td>
                                <td className="py-[2.5px] px-1 text-gray-600 text-[8.5px] truncate">{d.agencias?.zona}</td>
                                <td className="py-[2.5px] px-1 font-black text-center text-gray-900">{Number(d.cantidad).toLocaleString('es-VE')}</td>
                                <td className="py-[2.5px] px-1 font-mono text-[8.5px] text-center text-gray-800">{formatCorrelativo(d.correlativo_inicial)}</td>
                                <td className="py-[2.5px] px-1 font-mono text-[8.5px] text-center text-gray-800">{formatCorrelativo(d.correlativo_final)}</td>
                              </tr>
                            ))}
                            
                            {/* Subtotal de Página */}
                            <tr className="border-t-2 border-gray-400 bg-gray-50">
                              <td colSpan={4} className="py-1 px-1 font-bold text-right text-[9px] text-gray-600">TOTAL DE ESTA PÁGINA:</td>
                              <td className="py-1 px-1 font-bold text-center text-[10px] text-[#00205B]">{Number(pageTotalQuantity).toLocaleString('es-VE')}</td>
                              <td colSpan={2}></td>
                            </tr>

                            {/* Total General (Solo Última Página) */}
                            {isLastChunk && totalPages > 1 && (
                              <tr className="border-t-2 border-gray-800 bg-gray-100">
                                <td colSpan={4} className="py-1 px-1 font-black text-right text-[10px]">TOTAL GENERAL (TODAS LAS PÁGINAS):</td>
                                <td className="py-1 px-1 font-black text-center text-xs text-[#009639]">{Number(totalQuantity).toLocaleString('es-VE')}</td>
                                <td colSpan={2}></td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Firmas (En todas las páginas) */}
                      <div className="flex justify-around items-end mt-2 pt-2 shrink-0 print:w-full print:mt-1 print:pt-1">
                        {/* Firma 1 */}
                        <div className="w-[28%] text-center border-t-2 border-gray-800 pt-1">
                          <p className="font-bold text-[11px] text-gray-900">
                            {operator === "TODOS" ? "PAPEL VALOR" : operator}
                          </p>
                          <p className="font-semibold text-[9px] text-gray-500 uppercase">Elaborado Por</p>
                        </div>
                        {/* Firma 2 */}
                        <div className="w-[28%] text-center border-t-2 border-gray-800 pt-1">
                          <p className="font-bold text-[11px] text-gray-900 mt-2"></p>
                          <p className="font-semibold text-[9px] text-gray-500 uppercase">Recibido Por (Correspondencia)</p>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-2 text-center text-[7.5px] text-gray-400 font-bold uppercase tracking-widest border-t border-gray-200 pt-1 shrink-0 print:w-full">
                        Generado por Sistema Central de Distribución TDD - Banco Nacional de Crédito
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL / VISTA DE IMPRESIÓN ETIQUETAS (UNIVERSAL: HISTÓRICO O MASIVO) */}
      {showLabelPrintModal && (
        <div className="fixed inset-0 z-50 bg-gray-500/80 overflow-y-auto print:static print:bg-transparent">
          <div className="max-w-4xl mx-auto my-8 print:m-0 print:max-w-none print:w-full flex flex-col gap-8">
            
            {/* Controles Solo Pantalla */}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-md print:hidden sticky top-4 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#009639]"></span>
                <span className="text-sm font-bold text-gray-800">
                  {activeMode === "masivo" ? "Etiquetas Masivas (Pre-Despacho)" : "Etiquetas de Despacho Registrado"}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                  {itemsToPrint.length} etiquetas ({Math.ceil(itemsToPrint.length / ETIQUETAS_POR_PAGINA) || 1} hojas)
                </span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowLabelPrintModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors cursor-pointer"
                >
                  Cerrar Vista Previa
                </button>
                <button 
                  onClick={() => {
                    if (printLabelsRef.current) {
                      printElementIsolated(printLabelsRef.current, "Etiquetas de Despacho BNC", false);
                    } else {
                      window.print();
                    }
                  }}
                  className="px-6 py-2 bg-[#009639] text-white font-bold rounded-lg hover:bg-[#007a2e] transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Etiquetas</span>
                </button>
              </div>
            </div>

            {/* ETIQUETAS BNC */}
            <div ref={printLabelsRef} className="print-labels flex flex-col gap-8 print:gap-0">
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  html, body { width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
                  nav, header, footer, button, .print\\:hidden { display: none !important; }
                  .print-labels { display: block !important; position: static !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; }
                  @page { size: letter portrait; margin: 5mm; }
                  .page-break { break-after: page !important; page-break-after: always !important; }
                }
              `}} />

              {Array.from({ length: Math.ceil(itemsToPrint.length / ETIQUETAS_POR_PAGINA) || 1 }, (_, pageIndex) => {
                const chunk = itemsToPrint.slice(pageIndex * ETIQUETAS_POR_PAGINA, (pageIndex + 1) * ETIQUETAS_POR_PAGINA);
                const isLastPage = pageIndex === Math.ceil(itemsToPrint.length / ETIQUETAS_POR_PAGINA) - 1;

                return (
                  <div key={pageIndex} className={`bg-white p-8 shadow-lg print:shadow-none print:p-0 print:m-0 print:w-full ${!isLastPage ? 'page-break' : ''}`}>
                    <div className="flex flex-col gap-6 print:gap-4 h-full">
                      {chunk.map((d, i) => (
                        <div key={d.id} className="border-2 border-dashed border-gray-400 p-4 flex flex-col justify-between relative bg-white min-h-[200px] print:min-h-[22vh]">
                          
                          <div className="flex-1 flex items-center gap-4">
                            {/* COL 1: Logo & Info Bancaria */}
                            <div className="w-[22%] flex flex-col items-center justify-center border-r-2 border-gray-200 pr-3 h-full">
                              <img 
                                src="/logo-bnc.png" 
                                alt="Logo BNC" 
                                className="h-10 w-auto object-contain mb-2"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <h2 className="text-[11px] font-black text-[#00205B] text-center leading-tight">BANCO NACIONAL DE CRÉDITO</h2>
                              <h3 className="text-[7.5px] font-bold text-gray-500 mt-1 uppercase tracking-widest text-center">V.P.E BANCA COMERCIAL</h3>
                              <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 border border-gray-300 text-[8.5px] font-bold text-gray-800 tracking-wider rounded-sm text-center">
                                INVENTARIO PAPEL VALOR
                              </span>
                            </div>
                            
                            {/* COL 2: Producto y Destino */}
                            <div className="w-[51%] flex flex-col justify-center px-2 h-full">
                              <div className="mb-1.5 flex items-center justify-between">
                                <div>
                                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Producto</p>
                                  <p className="text-base font-black text-[#FE5000] tracking-tight leading-none">MASTERCARD DEBIT</p>
                                </div>
                                <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-200 text-[#FE5000] text-[8.5px] font-black rounded uppercase">
                                  TDD
                                </span>
                              </div>

                              <div className="bg-gray-50 p-2.5 border border-gray-200 rounded-lg">
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Destino</p>
                                <div className="flex items-center gap-2.5">
                                  <div className="shrink-0 text-center border-r-2 border-gray-200 pr-2.5">
                                    <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400 leading-none">CÓDIGO</p>
                                    <p className="text-2xl sm:text-3xl font-black text-[#00205B] leading-none mt-0.5 tracking-tight">
                                      {d.codigo_agencia}
                                    </p>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p 
                                      className={`font-black text-gray-900 uppercase tracking-tight break-words leading-tight ${getAdaptiveAgencyFontSize(d.agencias?.nombre)}`}
                                      style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                                    >
                                      {d.agencias?.nombre || "Agencia No Especificada"}
                                    </p>
                                    <p className="text-[9.5px] font-semibold text-gray-600 uppercase mt-0.5">
                                      {d.agencias?.region} / {d.agencias?.zona}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* COL 3: Cantidad y Fecha */}
                            <div className="w-[27%] flex flex-col justify-center gap-2.5 pl-3 border-l-2 border-gray-200 h-full">
                              <div className="bg-blue-50/50 p-2.5 border border-blue-100 rounded-lg">
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Cantidad Enviada</p>
                                <p className="text-xl font-black text-[#009639] leading-tight">
                                  {Number(d.cantidad).toLocaleString('es-VE')} <span className="text-[10px] text-gray-600 font-bold">UND</span>
                                </p>
                              </div>
                              <div className="bg-gray-50 p-2 border border-gray-100 rounded-lg">
                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Fecha de Envío</p>
                                <p className="text-xs font-bold text-gray-800">
                                  {formatLocalDate(dateToPrint)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-1.5 pt-1 border-t border-gray-200 text-center shrink-0">
                            <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">
                              Uso exclusivo del área de distribución
                            </p>
                          </div>

                          {/* Lineas de corte visuales */}
                          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-gray-400 -translate-x-0.5 -translate-y-0.5"></div>
                          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gray-400 translate-x-0.5 -translate-y-0.5"></div>
                          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-gray-400 -translate-x-0.5 translate-y-0.5"></div>
                          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gray-400 translate-x-0.5 translate-y-0.5"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


