"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShieldCheck, X, MessageCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [greeting, setGreeting] = useState("Bienvenido");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Buenos días");
    else if (hour < 18) setGreeting("Buenas tardes");
    else setGreeting("Buenas noches");

    // Cargar correo recordado si existe
    try {
      const savedEmail = localStorage.getItem("bnc_remembered_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberUser(true);
      }
    } catch (e) {
      // Ignorar en caso de restricciones de storage
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Guardar o eliminar correo según la opción seleccionada
    try {
      if (rememberUser) {
        localStorage.setItem("bnc_remembered_email", email.trim());
      } else {
        localStorage.removeItem("bnc_remembered_email");
      }
    } catch (e) {
      // Ignorar
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      // Redirección dura para sensación de mayor velocidad (evita la recarga lenta de RSC de Next.js)
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-[#010a1c] relative overflow-hidden flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      
      {/* HALOS DE LUZ AMBIENTAL (AMBIENT GLOWS PARA PROFUNDIDAD 3D) */}
      <div className="absolute top-[-10%] left-[-5%] w-[480px] h-[480px] bg-[#003896]/20 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[450px] h-[450px] bg-[#FE5000]/12 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[25%] w-[350px] h-[350px] bg-[#00205B]/30 rounded-full blur-[120px] pointer-events-none" />

      {/* TARJETA PRINCIPAL SPLIT-SCREEN */}
      <div className="relative z-10 w-full max-w-4xl lg:max-w-5xl bg-white rounded-3xl shadow-2xl shadow-black/40 overflow-hidden border border-white/10 grid grid-cols-1 lg:grid-cols-12 animate-in zoom-in-95 duration-300">
        
        {/* COLUMNA IZQUIERDA: FORMULARIO */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-white text-gray-900 order-1">
          
          {/* HEADER */}
          <div>
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100 gap-3">
              {/* LOGO BNC + MASTERCARD DEBIT */}
              <div className="flex items-center gap-3 sm:gap-3.5">
                <img 
                  src="/logo-bnc.png" 
                  alt="Logo BNC" 
                  className="h-14 sm:h-16 w-auto object-contain"
                />
                <div className="h-11 sm:h-13 w-[2px] bg-[#00205B]/30" />
                <div className="flex flex-col justify-center select-none">
                  <span className="text-[12px] sm:text-[13px] font-bold text-[#00205B] tracking-[0.2em] uppercase leading-none">
                    MASTERCARD
                  </span>
                  <span className="text-[17px] sm:text-lg font-black text-[#00205B] tracking-wider uppercase leading-tight mt-0.5">
                    DEBIT
                  </span>
                </div>
              </div>

              {/* IDENTIFICACIÓN INSTITUCIONAL LIMPIA SIN RECUADRO */}
              <div className="text-right flex flex-col items-end shrink-0 select-none">
                <span className="text-xs sm:text-[13px] font-black uppercase tracking-wider text-[#00205B] leading-none">
                  VPE. Banca Comercial
                </span>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-1 leading-none">
                  VP. Administración de Agencias
                </span>
              </div>
            </div>

            <div className="space-y-1 mb-5">
              <h1 className="text-2xl sm:text-3xl font-black text-[#00205B] tracking-tight">
                Inventario Papel Valor
              </h1>
              <p className="text-gray-500 text-sm">
                ¡{greeting}, <span className="font-bold text-gray-700">Bienvenido</span>! Ingrese sus credenciales para acceder.
              </p>
            </div>
          </div>

          {/* FORMULARIO */}
          <form className="space-y-3.5 my-1" onSubmit={handleLogin}>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FE5000] focus:border-transparent transition-all text-sm font-medium"
                  placeholder="usuario@bnc.com.ve"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-11 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FE5000] focus:border-transparent transition-all text-sm font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                  tabIndex={-1}
                  title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* OPCIONES: RECORDAR USUARIO + SELLO DE SEGURIDAD */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={rememberUser}
                  onChange={(e) => setRememberUser(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FE5000] focus:ring-[#FE5000] border-gray-300 accent-[#FE5000] cursor-pointer"
                />
                <span className="text-xs text-gray-600 font-medium group-hover:text-gray-900 transition-colors">
                  Recordar usuario
                </span>
              </label>

              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium select-none">
                <ShieldCheck className="w-3.5 h-3.5 text-[#009639]" />
                <span>Acceso Seguro SSL</span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-xs font-bold text-red-600">
                  {error === 'Invalid login credentials' ? 'Credenciales de acceso inválidas.' : error}
                </p>
              </div>
            )}

            <div className="pt-1.5">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl shadow-lg shadow-[#FE5000]/25 text-sm font-bold text-white bg-[#FE5000] hover:bg-[#e04800] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FE5000] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Autenticando...</span>
                  </div>
                ) : (
                  <>
                    Iniciar Sesión
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {/* ENLACE DE SOPORTE QUE ABRE EL MENÚ DE CONTACTO */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowSupportModal(true)}
                className="text-[11px] font-semibold text-gray-400 hover:text-[#00205B] transition-colors inline-block underline-offset-2 hover:underline cursor-pointer"
              >
                ¿Problemas para acceder? Contactar a Soporte
              </button>
            </div>

          </form>

          {/* FOOTER IZQUIERDO CENTRADO */}
          <div className="pt-4 mt-2 border-t border-gray-100 text-xs text-gray-400 space-y-1 text-center">
            <p className="font-semibold text-gray-500">
              Uso exclusivo y confidencial de la VP. Administración de Agencias.
            </p>
            <p>
              © {new Date().getFullYear()} Papel Valor - Todos los derechos reservados.
            </p>
          </div>

        </div>

        {/* COLUMNA DERECHA: SHOWCASE DE TARJETA REAL BNC CON EFECTO VITRINA */}
        <div className="lg:col-span-5 bg-gradient-to-b from-[#f8fafc] via-[#edf2f7] to-[#e2e8f0] p-8 sm:p-12 flex flex-col justify-center items-center relative overflow-hidden border-t lg:border-t-0 lg:border-l border-gray-200 order-2">
          
          {/* Marca de agua institucional sutil de fondo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035]">
            <img src="/logo-bnc.png" alt="" className="w-96 h-96 object-contain scale-125 filter grayscale" />
          </div>

          {/* Resplandor radial suave (Efecto Vitrina) */}
          <div className="absolute w-72 h-72 rounded-full bg-white/70 blur-2xl pointer-events-none" />

          {/* CONTENEDOR DE LA TARJETA CON EFECTO HOVER Y SOMBRA REALISTA */}
          <div className="relative group cursor-pointer my-4 flex flex-col items-center z-10">
            <img 
              src="/images/tarjeta-bnc-real.png" 
              alt="Tarjeta MasterCard Debit BNC" 
              className="max-h-[320px] sm:max-h-[360px] w-auto object-contain select-none pointer-events-none group-hover:scale-105 group-hover:-translate-y-2.5 transition-all duration-500 drop-shadow-sm" 
            />
            {/* Sombra de piso suave y realista */}
            <div className="w-36 sm:w-44 h-3.5 bg-black/20 rounded-[100%] blur-[6px] mt-2 group-hover:scale-90 group-hover:bg-black/15 transition-all duration-500" />
          </div>

          <div className="text-center mt-3 max-w-[240px] z-10">
            <h3 className="text-sm font-black text-[#00205B] tracking-tight">
              Control de Papel Valor
            </h3>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              Distribución, custodia y seguimiento nacional de lotes de tarjetas.
            </p>
          </div>

        </div>

      </div>

      {/* VENTANA EMERGENTE DE SOPORTE TÉCNICO */}
      {showSupportModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowSupportModal(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-sm w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 relative text-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-[#00205B] tracking-tight">
                  Soporte
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Seleccione el canal de su preferencia:
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Opciones de contacto */}
            <div className="space-y-3 pt-1">
              {/* Opción 1: WhatsApp */}
              <a
                href="https://wa.me/584123992401?text=Hola,%20solicito%20soporte%20t%C3%A9cnico%20para%20el%20acceso%20al%20portal%20de%20Inventario%20Papel%20Valor."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-green-200 bg-green-50/60 hover:bg-green-100/70 hover:border-green-300 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-green-500/20 group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-green-900 flex items-center justify-between">
                    <span>WhatsApp Directo</span>
                    <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Rápido</span>
                  </div>
                  <p className="text-[11px] text-green-800/80 font-medium truncate mt-0.5">
                    +58 412-3992401
                  </p>
                </div>
              </a>

              {/* Opción 2: Correo */}
              <a
                href="mailto:gh30227421@gmail.com?subject=Soporte%20Acceso%20-%20Inventario%20Papel%20Valor&body=Hola,%20solicito%20asistencia%20con%20mis%20credenciales%20de%20acceso%20para%20el%20portal%20de%20Inventario%20Papel%20Valor.%0A%0ACorreo:%20%0ANombre:%20%0AAgencia:%20"
                className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 hover:border-blue-300 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00205B] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#00205B]/20 group-hover:scale-105 transition-transform">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-[#00205B] flex items-center justify-between">
                    <span>Correo Electrónico</span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Formal</span>
                  </div>
                  <p className="text-[11px] text-gray-600 font-medium truncate mt-0.5">
                    gh30227421@gmail.com
                  </p>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
