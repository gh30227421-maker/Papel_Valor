'use client'

import { useState } from 'react';
import { verifyDispatch, confirmDispatch } from '@/actions/recepcion';
import { PackageOpen, CheckCircle, Search, AlertCircle, Building, CreditCard, User, FileText } from 'lucide-react';

export default function RecepcionPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Paso 1 Datos
  const [codigoAgencia, setCodigoAgencia] = useState('');
  const [correlativoInicial, setCorrelativoInicial] = useState('');
  const [correlativoFinal, setCorrelativoFinal] = useState('');
  
  // Datos verificados
  const [despacho, setDespacho] = useState<any>(null);
  
  // Paso 2 Datos
  const [recibidoPor, setRecibidoPor] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    
    try {
      const res = await verifyDispatch(codigoAgencia, correlativoInicial, correlativoFinal);
      if (res.success && res.data) {
        setDespacho(res.data);
        setStep(2);
      } else {
        setErrorMsg(res.message || 'Error desconocido al verificar');
      }
    } catch (err) {
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recibidoPor.trim()) {
      setErrorMsg('Debe indicar quién recibe el paquete.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await confirmDispatch(despacho.id, recibidoPor, observaciones);
      if (res.success) {
        setStep(3);
      } else {
        setErrorMsg(res.message || 'Error al confirmar.');
      }
    } catch (err) {
      setErrorMsg('Error de conexión al guardar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header Corporativo */}
        <div className="bg-[#00205B] p-6 text-center">
          <img src="/logo-bnc.png" alt="BNC Logo" className="h-12 mx-auto mb-4 bg-white p-2 rounded-lg" />
          <h1 className="text-white text-xl font-black tracking-tight">Portal de Recepción de Papel Valor</h1>
          <p className="text-blue-200 text-sm mt-1">Distribución de Tarjetas MasterCard Debit</p>
        </div>

        <div className="p-8">
          {/* PASO 1: VERIFICACIÓN */}
          {step === 1 && (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center mx-auto mb-5">
                  <img src="/images/tarjeta-bnc.png" alt="Tarjeta BNC" className="h-28 object-contain drop-shadow-md hover:scale-105 transition-transform duration-300" />
                </div>
                <h2 className="text-gray-800 text-lg font-bold">Verificar Lote Recibido</h2>
                <p className="text-gray-500 text-sm mt-1">Ingrese los datos que aparecen en la etiqueta o correo electrónico para validar la entrega.</p>
              </div>

              {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 border border-red-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <Building className="w-4 h-4 text-gray-400" />
                    Código de Agencia
                  </label>
                  <input
                    type="text"
                    required
                    value={codigoAgencia}
                    onChange={(e) => setCodigoAgencia(e.target.value)}
                    placeholder="Ej: 144"
                    className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00205B] focus:border-transparent outline-none transition-all font-mono text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    Correlativo Inicial Recibido
                  </label>
                  <input
                    type="text"
                    required
                    value={correlativoInicial}
                    onChange={(e) => setCorrelativoInicial(e.target.value)}
                    placeholder="Ej: 5410360218700384"
                    className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00205B] focus:border-transparent outline-none transition-all font-mono text-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    Correlativo Final Recibido
                  </label>
                  <input
                    type="text"
                    required
                    value={correlativoFinal}
                    onChange={(e) => setCorrelativoFinal(e.target.value)}
                    placeholder="Ej: 5410360218700500"
                    className="w-full px-4 py-3 bg-gray-50 text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00205B] focus:border-transparent outline-none transition-all font-mono text-lg font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !codigoAgencia || !correlativoInicial || !correlativoFinal}
                className="w-full bg-[#00205B] hover:bg-[#00153D] text-white font-bold py-3.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Buscar y Validar
                  </>
                )}
              </button>
            </form>
          )}

          {/* PASO 2: CONFIRMACIÓN */}
          {step === 2 && despacho && (
            <form onSubmit={handleConfirm} className="space-y-6">
              <div className="text-center mb-6">
                <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="text-green-600 w-8 h-8" />
                </div>
                <h2 className="text-gray-800 text-lg font-bold">¡Lote Localizado!</h2>
                <p className="text-gray-500 text-sm mt-1">Revise que la información coincida con lo físico antes de confirmar.</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-500 text-sm">Agencia Destino:</span>
                  <span className="font-bold text-gray-900 text-right">{despacho.codigo_agencia} - {despacho.agencias?.nombre}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-500 text-sm">Cantidad a Recibir:</span>
                  <span className="font-black text-[#FE5000] text-lg">{Number(despacho.cantidad).toLocaleString('es-VE')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Rango:</span>
                  <span className="font-mono text-xs text-gray-700">{despacho.correlativo_inicial} <br/><span className="text-gray-400">al</span> {despacho.correlativo_final}</span>
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 border border-red-100">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    Nombre y Apellido de quien recibe
                  </label>
                  <input
                    type="text"
                    required
                    value={recibidoPor}
                    onChange={(e) => setRecibidoPor(e.target.value)}
                    placeholder="Ej: María Pérez - Gerente"
                    className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00205B] focus:border-transparent outline-none transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    Observaciones (Opcional)
                  </label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Todo recibido conforme, cajas selladas..."
                    rows={3}
                    className="w-full px-4 py-3 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00205B] focus:border-transparent outline-none transition-all resize-none text-sm font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={loading || !recibidoPor}
                  className="flex-1 bg-[#009639] hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Confirmar Recepción
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* PASO 3: ÉXITO */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-[#009639] w-12 h-12" />
              </div>
              <h2 className="text-[#00205B] text-2xl font-black mb-2">¡Recepción Exitosa!</h2>
              <p className="text-gray-600 mb-8">El envío ha sido confirmado en el sistema central correctamente. Puede cerrar esta ventana.</p>
              
              <button
                onClick={() => {
                  setStep(1);
                  setCodigoAgencia('');
                  setCorrelativoInicial('');
                  setRecibidoPor('');
                  setObservaciones('');
                  setDespacho(null);
                }}
                className="text-[#00205B] font-bold hover:underline"
              >
                Registrar otra recepción
              </button>
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
          <p className="text-xs text-gray-400 font-medium">Uso exclusivo y confidencial del Banco Nacional de Crédito.</p>
        </div>
      </div>
    </div>
  );
}
