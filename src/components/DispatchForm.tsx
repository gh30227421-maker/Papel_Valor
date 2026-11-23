"use client";

import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { createClient as createAuthClient } from "@/lib/supabase/client";
import { getStockStats } from "@/actions/dashboard";
import { saveStockCustodia } from "@/actions/custodia";
import CustomSelect from "./ui/CustomSelect";
import AgencyCombobox from "./ui/AgencyCombobox";
import { getLocalTodayDate } from "@/lib/dateUtils";

type AgencyData = {
  codigo: string;
  nombre: string;
  region: string;
  estado: string;
  zona: string;
  gerente: string;
};

export default function DispatchForm({ onSuccess }: { onSuccess?: () => void }) {
  const [dispatchDate, setDispatchDate] = useState(() => getLocalTodayDate());
  const [agencyCode, setAgencyCode] = useState("");
  const [agencyData, setAgencyData] = useState<AgencyData | null>(null);
  const [agencyError, setAgencyError] = useState("");
  const [isSearchingAgency, setIsSearchingAgency] = useState(false);
  const [allAgencies, setAllAgencies] = useState<AgencyData[]>([]);
  const [lastCorrelativeUsed, setLastCorrelativeUsed] = useState<string>("");
  const [bovedaDisponible, setBovedaDisponible] = useState<number | null>(null);
  const [custodiaActual, setCustodiaActual] = useState<number>(0);
  const [deductFromCustodia, setDeductFromCustodia] = useState<boolean>(false);
  
  const [initialCorrelative, setInitialCorrelative] = useState("");
  const [finalCorrelative, setFinalCorrelative] = useState("");
  const [correlativeError, setCorrelativeError] = useState("");
  
  const [elaborator, setElaborator] = useState("");
  const [operatorOptions, setOperatorOptions] = useState([
    { value: "Rhainy Hernandez", label: "Rhainy Hernandez" },
    { value: "Alfredo Machado", label: "Alfredo Machado" },
  ]);

  useEffect(() => {
    const loadOperators = async () => {
      try {
        const names = new Set<string>(["Rhainy Hernandez", "Alfredo Machado"]);
        const authSupabase = createAuthClient();
        const { data: perfiles } = await authSupabase
          .from("perfiles")
          .select("nombre, rol")
          .in("rol", ["admin", "usuario"]);

        if (perfiles) {
          perfiles.forEach((p: any) => {
            if (p.nombre && p.nombre.trim()) {
              names.add(p.nombre.trim());
            }
          });
        }

        const { data: { user } } = await authSupabase.auth.getUser();
        if (user) {
          const { data: myProfile } = await authSupabase
            .from("perfiles")
            .select("nombre")
            .eq("id", user.id)
            .maybeSingle();
          if (myProfile?.nombre?.trim()) {
            const myName = myProfile.nombre.trim();
            names.add(myName);
            setElaborator((prev) => prev || myName);
          }
        }

        setOperatorOptions(
          Array.from(names).map((n) => ({ value: n, label: n }))
        );
      } catch (e) {
        // Fallback silencioso a las opciones predeterminadas
      }
    };
    loadOperators();

    // Cargar catálogo de agencias para el buscador por Nombre/Código, último correlativo y saldo de Bóveda
    const loadCatalogAndLastCorr = async () => {
      try {
        const [{ data: ags }, { data: lastDesp }, stockInfo] = await Promise.all([
          supabase.from("agencias").select("codigo, nombre, region, estado, zona, gerente").order("nombre"),
          supabase.from("despachos").select("correlativo_final").order("created_at", { ascending: false }).limit(1),
          getStockStats("").catch(() => null)
        ]);
        if (ags) setAllAgencies(ags as AgencyData[]);
        if (lastDesp && lastDesp.length > 0 && lastDesp[0].correlativo_final) {
          setLastCorrelativeUsed(lastDesp[0].correlativo_final.replace(/\D/g, ""));
        }
        if (stockInfo) {
          setBovedaDisponible(Number(stockInfo.stock_boveda) || 0);
          setCustodiaActual(Number(stockInfo.stock_custodia) || 0);
        }
      } catch {
        // Ignore
      }
    };
    loadCatalogAndLastCorr();
  }, []);
  
  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: 'initial' | 'final') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const agencyInputRef = useRef<HTMLInputElement>(null);
  const initialCorrelativeRef = useRef<HTMLInputElement>(null);
  const finalCorrelativeRef = useRef<HTMLInputElement>(null);
  const despacharBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const isValidInitial = initialCorrelative.length === 16 && /^\d+$/.test(initialCorrelative);
  const isValidFinal = finalCorrelative.length === 16 && /^\d+$/.test(finalCorrelative);
  
  let quantity = 0;
  let formattedQuantity = "0";

  if (isValidInitial && isValidFinal) {
    const extractedInitial = parseInt(initialCorrelative.substring(8, 14), 10);
    const extractedFinal = parseInt(finalCorrelative.substring(8, 14), 10);
    quantity = extractedFinal - extractedInitial + 1;
    if (quantity > 0) {
      formattedQuantity = new Intl.NumberFormat("es-VE").format(quantity);
    } else {
      formattedQuantity = "Inválida";
    }
  }

  const isFormValid = dispatchDate && agencyData && isValidInitial && isValidFinal && quantity > 0 && elaborator && !correlativeError;

  // Búsqueda Dinámica de Agencia
  useEffect(() => {
    const searchAgency = async () => {
      const code = agencyCode.trim();
      if (code.length < 1) {
        setAgencyData(null);
        setAgencyError("");
        return;
      }
      
      setIsSearchingAgency(true);
      setAgencyError("");
      
      const noZeros = code.replace(/^0+/, "") || "0";
      const candidates = Array.from(new Set([code, noZeros, noZeros.padStart(2, "0"), noZeros.padStart(3, "0")]));
      
      const { data, error } = await supabase
        .from("agencias")
        .select("*")
        .in("codigo", candidates)
        .limit(1);

      setIsSearchingAgency(false);

      if (error || !data || data.length === 0) {
        setAgencyData(null);
        if (code.length >= 1) setAgencyError("Agencia no encontrada");
      } else {
        setAgencyData(data[0]);
        setAgencyError("");
      }
    };

    const debounceTimer = setTimeout(searchAgency, 400);
    return () => clearTimeout(debounceTimer);
  }, [agencyCode]);

  const handleCorrelativeChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 16);
    setter(val);
    setCorrelativeError("");
  };

  // Calcula un correlativo de 16 dígitos sumando delta a los dígitos centrales [8..14]
  const computeCorrelativeOffset = (base16: string, delta: number): string | null => {
    if (base16.length !== 16 || !/^\d+$/.test(base16)) return null;
    const prefix = base16.substring(0, 8);
    const serialNum = parseInt(base16.substring(8, 14), 10);
    const suffix = base16.substring(14, 16);
    const nextSerial = serialNum + delta;
    if (nextSerial < 0 || nextSerial > 999999) return null;
    return `${prefix}${String(nextSerial).padStart(6, "0")}${suffix}`;
  };

  const handleApplyQuickBatch = (batchSize: number) => {
    if (!isValidInitial) return;
    const computedFinal = computeCorrelativeOffset(initialCorrelative, batchSize - 1);
    if (computedFinal) {
      setFinalCorrelative(computedFinal);
      setCorrelativeError("");
      setTimeout(() => despacharBtnRef.current?.focus(), 50);
    }
  };

  const handleSuggestNextInitial = () => {
    if (!lastCorrelativeUsed || lastCorrelativeUsed.length !== 16) return;
    const nextInitial = computeCorrelativeOffset(lastCorrelativeUsed, 1);
    if (nextInitial) {
      setInitialCorrelative(nextInitial);
      setCorrelativeError("");
      setTimeout(() => finalCorrelativeRef.current?.focus(), 50);
    }
  };

  const handleSubmit = async () => {
    setCorrelativeError("");
    setIsSubmitting(true);

    const { data: overlapping, error: overlapError } = await supabase
      .from("despachos")
      .select("id")
      .lte("correlativo_inicial", finalCorrelative)
      .gte("correlativo_final", initialCorrelative)
      .limit(1);

    if (overlapError) {
      setCorrelativeError("Error al verificar disponibilidad: " + overlapError.message);
      setIsSubmitting(false);
      setShowPreview(false);
      return;
    }

    if (overlapping && overlapping.length > 0) {
      setCorrelativeError("Los rangos ingresados se solapan con un lote ya despachado en la base de datos.");
      setIsSubmitting(false);
      setShowPreview(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("despachos")
      .insert([
        {
          fecha_despacho: dispatchDate,
          codigo_agencia: agencyData!.codigo,
          correlativo_inicial: initialCorrelative,
          correlativo_final: finalCorrelative,
          cantidad: quantity,
          elaborador: elaborator,
          estatus_entrega: 'En Tránsito'
        }
      ]);

    if (insertError) {
      setCorrelativeError("Error al registrar el despacho: " + insertError.message);
      setIsSubmitting(false);
      setShowPreview(false);
      return;
    }

    setIsSubmitting(false);
    setShowPreview(false);
    setSuccessMessage("Despacho registrado y centralizado exitosamente en Supabase.");
    setLastCorrelativeUsed(finalCorrelative);
    if (bovedaDisponible !== null) {
      setBovedaDisponible(Math.max(0, bovedaDisponible - quantity));
    }
    if (deductFromCustodia && custodiaActual > 0) {
      const nextCustodia = Math.max(0, custodiaActual - quantity);
      setCustodiaActual(nextCustodia);
      saveStockCustodia({
        cantidad: nextCustodia,
        concepto: "Custodia Bóveda Central (Descuento automático por despacho)",
        observaciones: `Descontadas ${quantity} TDD despachadas a Agencia ${agencyData!.codigo}`,
      }).catch(() => {});
    }
    
    setAgencyCode("");
    setAgencyData(null);
    setInitialCorrelative("");
    setFinalCorrelative("");
    // setElaborator(""); // <-- Mantenemos el elaborador seleccionado
    
    // Ya no navegamos al histórico, nos quedamos en el formulario
    // if (onSuccess) {
    //   setTimeout(onSuccess, 2000);
    // }
    
    setTimeout(() => {
      setSuccessMessage("");
      agencyInputRef.current?.focus();
    }, 4000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-3 rounded-lg bg-[#009639]/10 border border-[#009639]/20 flex items-center shadow-sm">
          <div className="flex-shrink-0 w-8 h-8 bg-[#009639] rounded-full flex items-center justify-center mr-3 shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <h4 className="text-[#009639] font-black text-sm tracking-tight">Operación Exitosa</h4>
            <span className="text-[#009639]/80 text-xs font-semibold">{successMessage}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        
        {/* =========================================================
            BLOQUE 1: DATOS DE ORIGEN Y DESTINO (COMPACTO)
            ========================================================= */}
        <div className="bg-white border-l-4 border-l-[#00205B] rounded-lg shadow-sm border border-gray-200 p-4 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 gap-4">
             <h3 className="text-xs font-black text-[#00205B] flex items-center uppercase tracking-wider">
               <span className="bg-[#00205B]/10 text-[#00205B] w-6 h-6 flex items-center justify-center rounded mr-2 text-[10px]">1</span>
               Datos de Origen y Ruta de Destino
             </h3>
             
             <div className="flex gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Fecha de Despacho</label>
                  <input
                    type="date"
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="px-3 py-1.5 bg-gray-50 text-gray-900 font-bold border border-gray-200 rounded text-xs outline-none focus:border-[#00205B]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Operador Responsable</label>
                  <CustomSelect
                    value={elaborator}
                    onChange={setElaborator}
                    className="w-44"
                    options={operatorOptions}
                  />
                </div>
             </div>
          </div>

          {/* BUSCADOR HORIZONTAL PLANO Y COMPACTO */}
          <div className="flex flex-wrap lg:flex-nowrap items-end gap-3 transition-all relative">
             <div className="w-full lg:w-32 shrink-0">
                <label className="block text-[9px] font-bold text-[#00205B] mb-1">Cód. Centro Costo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                    {isSearchingAgency ? (
                      <svg className="animate-spin h-3.5 w-3.5 text-[#FE5000]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                      <svg className={`w-3.5 h-3.5 ${agencyData ? 'text-[#009639]' : agencyError ? 'text-red-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    )}
                  </div>
                  <input
                    ref={agencyInputRef}
                    type="text"
                    maxLength={6}
                    value={agencyCode}
                    onChange={(e) => setAgencyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && agencyCode.length > 0) {
                        e.preventDefault();
                        initialCorrelativeRef.current?.focus();
                      }
                    }}
                    className={`w-full pl-8 pr-2 py-1.5 bg-white text-gray-900 border-2 rounded outline-none transition-all font-bold text-sm tracking-wide ${
                      agencyData ? "border-[#009639]" : agencyError ? "border-red-400 focus:border-red-500" : "border-gray-300 focus:border-[#00205B]"
                    }`}
                    placeholder="Ej. 175"
                  />
                </div>
                {agencyError && <p className="text-red-500 text-[9px] font-bold mt-1 absolute -bottom-4 animate-in fade-in">{agencyError}</p>}
             </div>

             <div className="flex-1 min-w-[220px]">
                <label className="block text-[9px] font-bold text-[#00205B] mb-1">Buscar Agencia por Nombre o Código</label>
                <AgencyCombobox
                  agencies={allAgencies}
                  value={agencyData?.codigo || agencyCode}
                  onChange={(selectedCode) => {
                    setAgencyCode(selectedCode);
                    const found = allAgencies.find(a => a.codigo === selectedCode);
                    if (found) {
                      setAgencyData(found);
                      setAgencyError("");
                      setTimeout(() => initialCorrelativeRef.current?.focus(), 80);
                    } else if (!selectedCode) {
                      setAgencyData(null);
                      setAgencyError("");
                    }
                  }}
                  placeholder={agencyData?.nombre || "Buscar agencia por nombre, ciudad o código..."}
                />
             </div>
             
             <div className="w-full lg:w-32 shrink-0">
                <label className="block text-[9px] font-bold text-[#00205B] mb-1">Región</label>
                <input disabled value={agencyData?.region || ""} className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 font-semibold text-xs shadow-sm" placeholder="—" />
             </div>

             <div className="w-full lg:w-40 shrink-0">
                <label className="block text-[9px] font-bold text-[#00205B] mb-1">Gerente</label>
                <input disabled value={agencyData?.gerente || ""} className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 font-semibold text-xs shadow-sm" placeholder="—" />
             </div>

             <div className="w-full lg:w-40 shrink-0">
                <label className="block text-[9px] font-bold text-[#00205B] mb-1">Zona</label>
                <input disabled value={agencyData?.zona || ""} className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 font-semibold text-xs shadow-sm" placeholder="—" />
             </div>
          </div>
        </div>

        {/* =========================================================
            BLOQUE 2: ESCÁNER DE INVENTARIO Y TOTALIZADOR (COMPACTO)
            ========================================================= */}
        <div className="bg-white border-l-4 border-l-[#009639] rounded-lg shadow-sm border border-gray-200 p-4 relative">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-xs font-black text-[#009639] flex items-center uppercase tracking-wider">
              <span className="bg-[#009639]/10 text-[#009639] w-6 h-6 flex items-center justify-center rounded mr-2 text-[10px]">2</span>
              Escáner de Bloque Asignado
            </h3>

            {lastCorrelativeUsed && lastCorrelativeUsed.length === 16 && (
              <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200/80 px-3 py-1 rounded-lg">
                <span className="text-[10px] font-bold text-gray-500">
                  Último despachado: <strong className="font-mono text-[#00205B]">{lastCorrelativeUsed.replace(/(.{4})/g, "$1 ").trim()}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleSuggestNextInitial}
                  className="text-[10px] font-black bg-[#00205B] hover:bg-[#00153D] text-white px-2 py-0.5 rounded shadow-2xs transition-colors cursor-pointer"
                  title="Rellenar el Correlativo Inicial con el siguiente serial disponible (+1)"
                >
                  Usar Siguiente (+1)
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-end">
            <div className="flex-1 w-full space-y-4">
              {/* Input Correlativo Inicial */}
              <div className="relative group">
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider">Correlativo Inicial (Lote)</label>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${initialCorrelative.length === 16 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {initialCorrelative.length}/16
                  </span>
                </div>
                <div className="relative">
                  <input
                    ref={initialCorrelativeRef}
                    type="text"
                    value={initialCorrelative}
                    onChange={handleCorrelativeChange(setInitialCorrelative)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && initialCorrelative.length === 16) {
                        e.preventDefault();
                        finalCorrelativeRef.current?.focus();
                      }
                    }}
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 text-gray-900 font-mono text-lg font-bold tracking-[0.2em] border-2 border-gray-200 rounded focus:ring-0 focus:border-[#00205B] outline-none transition-all"
                    placeholder="0000000000000000"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 ${isValidInitial ? 'bg-[#009639] border-[#009639]' : 'border-gray-300'}`}>
                      {isValidInitial && <svg className="w-full h-full text-white p-px" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                    <button
                      type="button"
                      onClick={() => handleCopy(initialCorrelative, 'initial')}
                      disabled={!initialCorrelative}
                      className="p-1.5 text-gray-400 hover:text-[#00205B] hover:bg-gray-200 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      title="Copiar Correlativo"
                    >
                      {copiedField === 'initial' ? (
                        <svg className="w-5 h-5 text-[#009639]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Input Correlativo Final */}
              <div className="relative group">
                <div className="flex flex-wrap justify-between items-end gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-wider">Correlativo Final (Lote)</label>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold text-gray-400 mr-0.5">Autocalcular lote:</span>
                      {[
                        { qty: 250, label: "+250" },
                        { qty: 500, label: "+500 (1 Blíster)" },
                        { qty: 1000, label: "+1.000 (2 Blíster)" },
                        { qty: 1500, label: "+1.500 (3 Blíster)" },
                        { qty: 2000, label: "+2.000" },
                      ].map((preset) => (
                        <button
                          key={preset.qty}
                          type="button"
                          disabled={!isValidInitial}
                          onClick={() => handleApplyQuickBatch(preset.qty)}
                          className="px-2 py-0.5 text-[9.5px] font-black rounded border border-emerald-200 bg-emerald-50 text-[#009639] hover:bg-[#009639] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          title={`Autocompletar correlativo final para ${preset.qty} tarjetas`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${finalCorrelative.length === 16 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {finalCorrelative.length}/16
                  </span>
                </div>
                <div className="relative">
                  <input
                    ref={finalCorrelativeRef}
                    type="text"
                    value={finalCorrelative}
                    onChange={handleCorrelativeChange(setFinalCorrelative)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && finalCorrelative.length === 16 && isFormValid) {
                        e.preventDefault();
                        despacharBtnRef.current?.focus();
                      }
                    }}
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 text-gray-900 font-mono text-lg font-bold tracking-[0.2em] border-2 border-gray-200 rounded focus:ring-0 focus:border-[#00205B] outline-none transition-all"
                    placeholder="0000000000000000"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 ${isValidFinal ? 'bg-[#009639] border-[#009639]' : 'border-gray-300'}`}>
                      {isValidFinal && <svg className="w-full h-full text-white p-px" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </div>
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                    <button
                      type="button"
                      onClick={() => handleCopy(finalCorrelative, 'final')}
                      disabled={!finalCorrelative}
                      className="p-1.5 text-gray-400 hover:text-[#00205B] hover:bg-gray-200 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                      title="Copiar Correlativo"
                    >
                      {copiedField === 'final' ? (
                        <svg className="w-5 h-5 text-[#009639]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {correlativeError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start animate-in fade-in">
                  <svg className="w-4 h-4 text-red-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <span className="text-red-700 text-[10px] font-bold">{correlativeError}</span>
                </div>
              )}
            </div>

            {/* TOTALIZADOR DINÁMICO HORIZONTAL + SALDO BÓVEDA EN VIVO */}
            <div className={`w-full lg:w-72 shrink-0 p-4 rounded-lg border-2 transition-all duration-300 flex flex-col justify-center items-center h-full min-h-[160px] ${quantity > 0 ? 'bg-[#009639]/10 border-[#009639]/30' : 'bg-gray-50 border-gray-100'}`}>
              <span className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 text-center">Volumen Neto</span>
              <span className={`text-5xl font-black tracking-tighter my-1.5 ${quantity > 0 ? 'text-[#009639]' : 'text-gray-300'}`}>
                {formattedQuantity}
              </span>
              <span className={`text-xs font-bold text-center ${quantity > 0 ? 'text-[#009639]' : 'text-gray-400'}`}>Plásticos TDD</span>

              {bovedaDisponible !== null && (
                <div className="w-full mt-3 pt-2.5 border-t border-gray-200/80 text-center space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold px-1">
                    <span className="text-gray-500 uppercase">Bóveda Central:</span>
                    <span className="font-mono font-black text-[#00205B]">
                      {Math.max(0, bovedaDisponible - (quantity > 0 ? quantity : 0)).toLocaleString("es-VE")} TDD
                    </span>
                  </div>
                  {custodiaActual > 0 && (
                    <label className="flex items-center justify-center gap-1.5 text-[9.5px] font-bold text-[#FE5000] bg-orange-50 border border-orange-200/80 rounded px-2 py-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={deductFromCustodia}
                        onChange={(e) => setDeductFromCustodia(e.target.checked)}
                        className="w-3 h-3 rounded text-[#FE5000] cursor-pointer"
                      />
                      <span>Descontar de Custodia ({custodiaActual.toLocaleString("es-VE")})</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            ref={despacharBtnRef}
            type="button"
            disabled={!isFormValid}
            onClick={() => {
              setShowPreview(true);
              setTimeout(() => confirmBtnRef.current?.focus(), 100);
            }}
            className="group relative px-8 py-3 bg-[#FE5000] text-white font-black text-sm rounded shadow-[0_4px_10px_-4px_rgba(254,80,0,0.6)] hover:shadow-[0_6px_15px_-5px_rgba(254,80,0,0.8)] focus:ring-4 focus:ring-[#FE5000]/40 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-all overflow-hidden"
          >
            <span className="relative z-10 flex items-center tracking-wider uppercase">
              Despachar
              <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
          </button>
        </div>
      </div>

      {/* =========================================================
          MODAL DE CONFIRMACIÓN (TIPO TICKET BANCARIO)
          ========================================================= */}
      {showPreview && (
        <div className="fixed inset-0 bg-[#0B132B]/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full animate-in zoom-in-95 duration-300 relative overflow-hidden">
            
            {/* Ticket Header */}
            <div className="bg-[#00205B] p-4 text-center relative">
              <h3 className="text-white font-black text-lg tracking-widest uppercase">Validación</h3>
              <p className="text-blue-200 text-[10px] font-bold tracking-widest uppercase mt-0.5">Lote de Plásticos TDD</p>
            </div>

            {/* Ticket Body */}
            <div className="p-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
              
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div className="flex justify-between border-b border-gray-200 pb-2 border-dashed">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Fecha</span>
                  <span className="font-black text-gray-900">
                    {dispatchDate 
                      ? `${dispatchDate.substring(8,10)}/${dispatchDate.substring(5,7)}/${dispatchDate.substring(0,4)}` 
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-2 border-dashed">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Operador</span>
                  <span className="font-black text-gray-900">{elaborator}</span>
                </div>
                
                <div className="flex flex-col border-b border-gray-200 pb-2 border-dashed">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px] mb-1">Agencia Destino</span>
                  <div className="flex justify-between items-center">
                    <span className="font-black text-[#FE5000] text-base">{agencyCode}</span>
                    <span className="font-bold text-gray-900 text-[11px] uppercase text-right">{agencyData?.nombre}</span>
                  </div>
                </div>
                
                {agencyData && (
                  <div className="flex flex-col border-b border-gray-200 pb-2 border-dashed">
                    <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px] mb-1">Distribución</span>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800 text-[10px] uppercase">{agencyData.region}</span>
                      <span className="font-bold text-gray-600 text-[10px] uppercase text-right">{agencyData.zona}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Barcode Section (Side by side) */}
              <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200 text-center relative overflow-hidden flex flex-col items-center">
                <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Rango Correlativo Verificado</span>
                
                <div className="flex items-center justify-center gap-4 w-full">
                  <div className="font-mono text-gray-900 text-sm tracking-widest font-black bg-white py-1.5 px-3 rounded border border-gray-100 shadow-sm">
                    {initialCorrelative.replace(/(.{4})/g, '$1 ').trim()}
                  </div>
                  
                  <div className="text-[#00205B]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </div>
                  
                  <div className="font-mono text-gray-900 text-sm tracking-widest font-black bg-white py-1.5 px-3 rounded border border-gray-100 shadow-sm">
                    {finalCorrelative.replace(/(.{4})/g, '$1 ').trim()}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center bg-[#009639]/10 py-3 px-5 rounded-xl border border-[#009639]/20">
                <span className="text-[#009639] font-black uppercase tracking-widest text-[11px]">Total Neto a Despachar</span>
                <span className="text-3xl font-black text-[#009639] leading-none drop-shadow-sm">{Number(quantity).toLocaleString('es-VE')}</span>
              </div>
            </div>

            {/* Ticket Footer Buttons */}
            <div className="p-4 bg-gray-100 flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="w-1/3 py-3 bg-red-600 text-white font-black text-sm uppercase tracking-wider hover:bg-red-700 rounded-lg shadow-md transition-colors"
              >
                Cancelar
              </button>
              <button
                ref={confirmBtnRef}
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-2/3 py-3 bg-[#009639] text-white font-black text-sm uppercase tracking-wider rounded-lg shadow-md hover:bg-[#007A2E] focus:ring-4 focus:ring-[#009639]/40 disabled:opacity-50 transition-all flex justify-center items-center"
              >
                {isSubmitting ? (
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  "Confirmar y Emitir"
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
