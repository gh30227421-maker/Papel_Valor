"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import CustomSelect from "./ui/CustomSelect";
import { toast } from "sonner";

export default function ReportGenerator() {
  const [operator, setOperator] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [despachos, setDespachos] = useState<any[]>([]);
  const [availableOperators, setAvailableOperators] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showLabelPrintModal, setShowLabelPrintModal] = useState(false);
  const emailRef = useRef<HTMLDivElement>(null);

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
    
    // Primero buscamos los despachos
    const { data: despachosData, error } = await supabase
      .from("despachos")
      .select("*")
      .eq("fecha_despacho", date)
      .eq("elaborador", operator)
      .order("id", { ascending: true });

    if (error || !despachosData || despachosData.length === 0) {
      console.error("Error o sin datos:", error);
      setDespachos([]);
      setIsLoading(false);
      return;
    }

    // Luego buscamos los detalles de las agencias de forma manual
    // (Porque en la base de datos actual despachos y agencias no tienen Foreign Key configurada)
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

  const handlePrint = () => {
    setShowPrintModal(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handlePrintLabels = () => {
    setShowLabelPrintModal(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleCopyEmail = async () => {
    if (!emailRef.current) return;
    
    try {
      // Método moderno para copiar HTML enriquecido
      const htmlContent = emailRef.current.innerHTML;
      const blobHtml = new Blob([htmlContent], { type: "text/html" });
      const blobText = new Blob([emailRef.current.innerText], { type: "text/plain" });
      
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        })
      ]);
      toast.success("¡Correo copiado al portapapeles!", {
        description: "Listo para pegar en Outlook o similar."
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in duration-300">
      
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
              ...availableOperators.map(op => ({ value: op, label: op }))
            ]}
          />
        </div>
        
        <div className="w-full lg:w-2/4 flex gap-3">
           <button 
              disabled={despachos.length === 0}
              onClick={handlePrintLabels}
              className="flex-1 bg-[#009639] text-white py-3 px-2 rounded-lg font-bold text-sm hover:bg-[#007a2e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md whitespace-nowrap"
           >
              Imprimir Etiquetas
           </button>
           <button 
              disabled={despachos.length === 0}
              onClick={handlePrint}
              className="flex-1 bg-[#00205B] text-white py-3 px-2 rounded-lg font-bold text-sm hover:bg-[#00153B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md whitespace-nowrap"
           >
              Imprimir Relación
           </button>
           <button 
              disabled={despachos.length === 0}
              onClick={handleCopyEmail}
              className="flex-1 bg-[#FE5000] text-white py-3 px-2 rounded-lg font-bold text-sm hover:bg-[#d94400] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md whitespace-nowrap"
           >
              Copiar Correo
           </button>
        </div>
      </div>

      {/* Resultados Preview */}
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
                {/* Reference for copying */}
                <div 
                  ref={emailRef} 
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  style={{ fontFamily: '"Microsoft Sans Serif", sans-serif', fontSize: "14px", color: "#333", outline: "none" }}
                >
                  <p><strong>Buen Día,</strong></p>
                  <br />
                  <p><strong>Estimados Regionales:</strong></p>
                  <br />
                  <p>Por medio de la presente, cumplo con informarles que se llevó a cabo la distribución de Tarjetas MasterCard Debit a las agencias detalladas a continuación.</p>
                  <br />
                  <p>Asimismo, es importante señalar que las oficinas que no hayan recibido el despacho correspondiente en la fecha actual se debe a que cuentan con un inventario adecuado de papel valor, calculado en base a sus consumos.</p>
                  <br />
                  <p>Aunado a eso a todas aquellas oficinas que dispongan de alguna Nomina, Jornada Especial, Operativos (Agencia Móvil), es sumamente importante que esta solicitud sea remitidas a nuestro buzón: <strong>papelvalor@bncenlinea.net</strong>, para que sean atendidas y estas no afecten el inventario mensual de la agencia.</p>
                  <br />
                  <p>En virtud de lo anterior, les solicitamos transmitir esta información de manera oportuna a todas las agencias pertenecientes a cada Región para asegurar que confirmen la recepción del envío, esencial para un seguimiento y control adecuado.</p>
                  <br />
                  <ol style={{ paddingLeft: "20px", margin: "10px 0" }}>
                    <li style={{ marginBottom: "8px" }}><strong>Conteo y Verificación:</strong> Se debe realizar un conteo físico exhaustivo de las tarjetas recibidas.</li>
                    <li><strong>Confirmación de Recepción:</strong> solicitamos que todas las oficinas confirmen la recepción de las tarjetas y la cantidad exacta recibida utilizando el siguiente enlace: <a href={typeof window !== 'undefined' ? `${window.location.origin}/recepcion` : '#'} style={{color: "#00205B", textDecoration: "underline"}}>{typeof window !== 'undefined' ? `${window.location.origin}/recepcion` : 'Enlace de Recepción'}</a></li>
                  </ol>
                  <br />
                  <p>Agradecemos de antemano su colaboración y la difusión urgente de estas instrucciones a los funcionarios correspondientes para garantizar el control y la seguridad del Papel Valor.</p>
                  <br />
                  <p>Adjunto la relación de correspondencia del día de hoy:</p>
                  <br />
                  
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd", fontSize: "12px", cursor: "default", fontFamily: "Arial, sans-serif" }} contentEditable={false}>
                    <thead>
                      <tr style={{ backgroundColor: "#00205B", color: "white" }}>
                        <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Cód</th>
                        <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Agencia</th>
                        <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Región</th>
                        <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Zona</th>
                        <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>Cant.</th>
                        <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>Correlativo Inicial</th>
                        <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>Correlativo Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {despachos.map((d) => (
                        <tr key={d.id}>
                          <td style={{ border: "1px solid #ddd", padding: "8px" }}>{d.codigo_agencia}</td>
                          <td style={{ border: "1px solid #ddd", padding: "8px" }}>{d.agencias?.nombre}</td>
                          <td style={{ border: "1px solid #ddd", padding: "8px" }}>{d.agencias?.region}</td>
                          <td style={{ border: "1px solid #ddd", padding: "8px" }}>{d.agencias?.zona}</td>
                          <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center", fontWeight: "bold" }}>{Number(d.cantidad).toLocaleString('es-VE')}</td>
                          <td style={{ border: "1px solid #ddd", padding: "8px", fontFamily: "monospace", textAlign: "center" }}>{d.correlativo_inicial}</td>
                          <td style={{ border: "1px solid #ddd", padding: "8px", fontFamily: "monospace", textAlign: "center" }}>{d.correlativo_final}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: "#f9f9f9", fontWeight: "bold" }}>
                        <td colSpan={4} style={{ border: "1px solid #ddd", padding: "8px", textAlign: "right" }}>TOTAL GENERAL:</td>
                        <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center", color: "#009639" }}>{Number(totalQuantity).toLocaleString('es-VE')}</td>
                        <td colSpan={2} style={{ border: "1px solid #ddd", padding: "8px" }}></td>
                      </tr>
                    </tbody>
                  </table>

                  <br />
                  <p>Saludos cordiales,</p>
                  <p><strong>{operator}</strong><br />Distribución Papel Valor<br />Banco Nacional de Crédito</p>
                </div>
              </div>
            </div>
            
          </div>
        )}
      </div>

      {/* MODAL / VISTA DE IMPRESIÓN RELACIÓN */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-gray-500/80 overflow-y-auto print:static print:bg-transparent">
          <div className="max-w-6xl mx-auto my-8 print:m-0 print:max-w-none print:w-full flex flex-col gap-8">
            
            {/* Controles Solo Pantalla */}
            <div className="flex justify-end bg-white p-4 rounded-lg shadow-md print:hidden sticky top-4 z-10">
              <button 
                onClick={() => setShowPrintModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors mr-4"
              >
                Cerrar Vista Previa
              </button>
              <button 
                onClick={() => window.print()}
                className="px-6 py-2 bg-[#00205B] text-white font-bold rounded-lg hover:bg-[#00153B] transition-colors"
              >
                Imprimir Documento
              </button>
            </div>

            {/* DOCUMENTO OFICIAL BNC (PAGINADO) */}
            <div className="print-document flex flex-col gap-8 print:gap-0">
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  html, body { width: 100%; margin: 0 !important; padding: 0 !important; }
                  body * { visibility: hidden; }
                  .print-document, .print-document * { visibility: visible; }
                  .print-document { position: absolute; left: 0; top: 0; width: 100%; max-width: 100%; box-sizing: border-box; }
                  @page { size: letter landscape; margin: 10mm; }
                  .page-break { break-after: page; page-break-after: always; }
                }
              `}} />

              {Array.from({ length: Math.ceil(despachos.length / 20) || 1 }, (_, pageIndex) => {
                const chunk = despachos.slice(pageIndex * 20, (pageIndex + 1) * 20);
                const isLastPage = pageIndex === Math.ceil(despachos.length / 20) - 1;
                const pageTotalQuantity = chunk.reduce((acc, curr) => acc + (curr.cantidad || 0), 0);

                return (
                  <div key={pageIndex} className={`bg-white p-6 shadow-lg print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-full ${!isLastPage ? 'page-break' : ''} flex flex-col box-border`}>
                    
                    {/* Header */}
                    <div className="flex justify-between items-start border-b-2 border-[#00205B] pb-2 mb-3 shrink-0 print:w-full">
                      {/* Movido un poco a la derecha */}
                      <div className="flex items-center gap-4 print:ml-8">
                        <img 
                          src="/logo-bnc.png" 
                          alt="Logo BNC" 
                          className="h-14 w-auto object-contain print:h-10"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div>
                          <h1 className="text-xl font-black text-[#00205B] tracking-tight">BANCO NACIONAL DE CRÉDITO</h1>
                          <h2 className="text-[10px] font-bold text-gray-800 mt-1 uppercase tracking-widest">V.P.E BANCA COMERCIAL / ADMINISTRACIÓN DE AGENCIAS</h2>
                          <h3 className="text-[9px] font-bold text-gray-500 mt-0.5 uppercase tracking-widest">Inventario Papel Valor / Distribución MasterCard Debit</h3>
                        </div>
                      </div>
                      {/* Movido un poco a la izquierda */}
                      <div className="text-right print:mr-12">
                        <p className="text-xs font-bold text-gray-800">Fecha de Relación</p>
                        <p className="text-base font-black text-[#FE5000]">{new Date(date).toLocaleDateString('es-VE')}</p>
                        <p className="text-[10px] text-gray-500">Pág. {pageIndex + 1} / {Math.ceil(despachos.length / 20) || 1}</p>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 print:w-full print:px-4">
                      <table className="w-full text-left text-[10px] border-collapse" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="bg-gray-100 border-b-2 border-gray-300">
                            <th className="w-[5%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider">Cód</th>
                            <th className="w-[25%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider">Agencia</th>
                            <th className="w-[15%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider">Región</th>
                            <th className="w-[15%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider">Zona</th>
                            <th className="w-[8%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider text-center">Cant.</th>
                            <th className="w-[16%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider text-center">Corr. Inicial</th>
                            <th className="w-[16%] py-1 px-1 font-black text-gray-800 uppercase tracking-wider text-center">Corr. Final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chunk.map((d, i) => (
                            <tr key={d.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                              <td className="py-1 px-1 font-bold text-gray-900 break-words">{d.codigo_agencia}</td>
                              <td className="py-1 px-1 text-gray-800 break-words">{d.agencias?.nombre}</td>
                              <td className="py-1 px-1 text-gray-600 text-[9px] break-words">{d.agencias?.region}</td>
                              <td className="py-1 px-1 text-gray-600 text-[9px] break-words">{d.agencias?.zona}</td>
                              <td className="py-1 px-1 font-black text-center text-gray-900 break-words">{Number(d.cantidad).toLocaleString('es-VE')}</td>
                              <td className="py-1 px-1 font-mono text-[9px] text-center text-gray-800 break-words">{d.correlativo_inicial}</td>
                              <td className="py-1 px-1 font-mono text-[9px] text-center text-gray-800 break-words">{d.correlativo_final}</td>
                            </tr>
                          ))}
                          
                          {/* Subtotal de Página */}
                          <tr className="border-t-2 border-gray-400 bg-gray-50">
                            <td colSpan={4} className="py-2 px-1 font-bold text-right text-[10px] text-gray-600">TOTAL DE ESTA PÁGINA:</td>
                            <td className="py-2 px-1 font-bold text-center text-xs text-[#00205B]">{Number(pageTotalQuantity).toLocaleString('es-VE')}</td>
                            <td colSpan={2}></td>
                          </tr>

                          {/* Total General (Solo Última Página) */}
                          {isLastPage && Math.ceil(despachos.length / 20) > 1 && (
                            <tr className="border-t-4 border-gray-800 bg-gray-100">
                              <td colSpan={4} className="py-2 px-1 font-black text-right text-xs">TOTAL GENERAL (TODAS LAS PÁGINAS):</td>
                              <td className="py-2 px-1 font-black text-center text-sm text-[#009639]">{Number(totalQuantity).toLocaleString('es-VE')}</td>
                              <td colSpan={2}></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Firmas (En todas las páginas) */}
                    <div className="flex justify-around items-end mt-4 pt-4 shrink-0 print:w-full">
                      {/* Firma 1: Más corta (25%) */}
                      <div className="w-[25%] text-center border-t-2 border-gray-800 pt-1">
                        <p className="font-bold text-xs text-gray-900">{operator}</p>
                        <p className="font-semibold text-[10px] text-gray-500 uppercase">Elaborado Por</p>
                      </div>
                      {/* Firma 2: Más corta (25%) */}
                      <div className="w-[25%] text-center border-t-2 border-gray-800 pt-1">
                        <p className="font-bold text-xs text-gray-900 mt-4"></p>
                        <p className="font-semibold text-[10px] text-gray-500 uppercase">Recibido Por (Correspondencia)</p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 text-center text-[8px] text-gray-400 font-bold uppercase tracking-widest border-t border-gray-200 pt-2 shrink-0 print:w-full">
                      Generado por Sistema Central de Distribución TDD - Banco Nacional de Crédito
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL / VISTA DE IMPRESIÓN ETIQUETAS */}
      {showLabelPrintModal && (
        <div className="fixed inset-0 z-50 bg-gray-500/80 overflow-y-auto print:static print:bg-transparent">
          <div className="max-w-4xl mx-auto my-8 print:m-0 print:max-w-none print:w-full flex flex-col gap-8">
            
            {/* Controles Solo Pantalla */}
            <div className="flex justify-end bg-white p-4 rounded-lg shadow-md print:hidden sticky top-4 z-10">
              <button 
                onClick={() => setShowLabelPrintModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors mr-4"
              >
                Cerrar Vista Previa
              </button>
              <button 
                onClick={() => window.print()}
                className="px-6 py-2 bg-[#009639] text-white font-bold rounded-lg hover:bg-[#007a2e] transition-colors"
              >
                Imprimir Etiquetas
              </button>
            </div>

            {/* ETIQUETAS BNC */}
            <div className="print-labels flex flex-col gap-8 print:gap-0">
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  html, body { width: 100%; margin: 0 !important; padding: 0 !important; }
                  body * { visibility: hidden; }
                  .print-labels, .print-labels * { visibility: visible; }
                  .print-labels { position: absolute; left: 0; top: 0; width: 100%; max-width: 100%; box-sizing: border-box; }
                  @page { size: letter portrait; margin: 10mm; }
                  .page-break { break-after: page; page-break-after: always; }
                }
              `}} />

              {Array.from({ length: Math.ceil(despachos.length / 4) || 1 }, (_, pageIndex) => {
                const chunk = despachos.slice(pageIndex * 4, (pageIndex + 1) * 4);
                const isLastPage = pageIndex === Math.ceil(despachos.length / 4) - 1;

                return (
                  <div key={pageIndex} className={`bg-white p-8 shadow-lg print:shadow-none print:p-0 print:m-0 print:w-full print:h-[calc(100vh-20mm)] ${!isLastPage ? 'page-break' : ''}`}>
                    <div className="flex flex-col gap-6 print:gap-4 h-full">
                      {chunk.map((d, i) => (
                        <div key={d.id} className="border-2 border-dashed border-gray-400 p-4 flex flex-col justify-between relative bg-white h-full max-h-[23vh]">
                          
                          <div className="flex-1 flex items-center gap-4">
                            {/* COL 1: Logo & Info Bancaria */}
                            <div className="w-[25%] flex flex-col items-center justify-center border-r-2 border-gray-200 pr-4 h-full">
                              <img 
                                src="/logo-bnc.png" 
                                alt="Logo BNC" 
                                className="h-10 w-auto object-contain mb-3"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <h2 className="text-xs font-black text-[#00205B] text-center leading-tight">BANCO NACIONAL DE CRÉDITO</h2>
                              <h3 className="text-[8px] font-bold text-gray-500 mt-1 uppercase tracking-widest text-center">V.P.E BANCA COMERCIAL</h3>
                              <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 border border-gray-300 text-[9px] font-bold text-gray-800 tracking-widest rounded-sm text-center">
                                INVENTARIO PAPEL VALOR
                              </span>
                            </div>
                            
                            {/* COL 2: Producto y Destino */}
                            <div className="w-[45%] flex flex-col justify-center px-2 h-full">
                              <div className="mb-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Producto</p>
                                <p className="text-lg font-black text-[#FE5000] tracking-tight">MASTERCARD DEBIT</p>
                              </div>

                              <div className="bg-gray-50 p-3 border border-gray-200 rounded-lg">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Destino</p>
                                <div className="flex items-center gap-3">
                                  <p className="text-4xl font-black text-[#00205B] leading-none">
                                    {d.codigo_agencia}
                                  </p>
                                  <div>
                                    <p className="text-sm font-bold text-gray-800 uppercase line-clamp-1">
                                      {d.agencias?.nombre}
                                    </p>
                                    <p className="text-[10px] text-gray-600 uppercase mt-0.5">
                                      {d.agencias?.region} / {d.agencias?.zona}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* COL 3: Cantidad y Fecha */}
                            <div className="w-[30%] flex flex-col justify-center gap-3 pl-4 border-l-2 border-gray-200 h-full">
                              <div className="bg-blue-50/50 p-3 border border-blue-100 rounded-lg">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Cantidad Enviada</p>
                                <p className="text-2xl font-black text-[#009639]">
                                  {Number(d.cantidad).toLocaleString('es-VE')} <span className="text-xs text-gray-600 font-bold">UND</span>
                                </p>
                              </div>
                              <div className="bg-gray-50 p-3 border border-gray-100 rounded-lg">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Fecha de Envío</p>
                                <p className="text-sm font-bold text-gray-800">
                                  {new Date(date).toLocaleDateString('es-VE')}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-gray-200 text-center shrink-0">
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
