"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#02112e] flex flex-col justify-center items-center p-4">
      
      <div className="w-full max-w-md bg-[#00205B] rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/5 flex flex-col items-center animate-in zoom-in-95 duration-300">
        
        {/* LOGO DE TARJETA */}
        <div className="mb-4 flex justify-center w-full">
          <img src="/images/tarjeta-bnc.png" alt="Tarjeta BNC" className="h-24 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300" />
        </div>

        {/* TITULOS */}
        <div className="text-center mb-2">
          <h2 className="text-[10px] sm:text-xs font-bold text-blue-200/80 uppercase tracking-widest mb-1">
            V.P. Administración de Agencias
          </h2>
          <h1 className="text-lg sm:text-xl font-black text-white tracking-wide whitespace-nowrap">
            INVENTARIO PAPEL VALOR
          </h1>
        </div>
        
        <h2 className="text-sm text-blue-100 font-medium mb-2">
          Inicio de sesión
        </h2>
        
        <div className="text-center mb-4">
          <p className="text-white text-sm">
            ¡{greeting}, <span className="font-bold">Bienvenido</span>!
          </p>
          <p className="text-blue-200 text-xs mt-1 opacity-80">
            Ingrese sus credenciales
          </p>
        </div>

        {/* FORMULARIO */}
        <form className="w-full space-y-4" onSubmit={handleLogin}>
          
          <div className="space-y-1">
            <label className="block text-xs font-bold text-white">
              Correo Electrónico
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 rounded-lg bg-[#02112e] border border-transparent text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FE5000] focus:border-transparent transition-all text-sm"
                placeholder="usuario@banco.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-white">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 rounded-lg bg-[#02112e] border border-transparent text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FE5000] focus:border-transparent transition-all text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/50 rounded-lg text-center">
              <p className="text-xs font-medium text-red-400">
                {error === 'Invalid login credentials' ? 'Credenciales inválidas.' : error}
              </p>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-[#FE5000] hover:bg-[#e04800] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FE5000] focus:ring-offset-[#00205B] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {/* FOOTER */}
          <div className="pt-4 mt-4 border-t border-white/10 text-center space-y-1">
            <p className="text-xs text-blue-200/60 font-medium">
              Uso exclusivo para personal autorizado.
            </p>
            <p className="text-xs text-blue-200/60 font-medium">
              © {new Date().getFullYear()} Papel Valor - Todos los derechos reservados. Desarrollado por Rhainy Hernandez.
            </p>
          </div>
          
        </form>
      </div>
    </div>
  );
}
