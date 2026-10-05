'use client'

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LoadingOverlay from "./LoadingOverlay";

export default function Navigation({ initialRol = 'invitado', initialNombre = '' }: { initialRol?: string, initialNombre?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [rol, setRol] = useState<string>(initialRol);
  const [nombre, setNombre] = useState<string>(initialNombre);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    // Sincronizar si cambia desde el servidor
    setRol(initialRol);
    setNombre(initialNombre);
  }, [initialRol, initialNombre]);

  useEffect(() => {
    // Apagar el loader cada vez que la ruta termina de cambiar
    setIsNavigating(false);
  }, [pathname]);

  const handleLinkClick = (href: string) => {
    if (pathname !== href) {
      setIsNavigating(true);
    }
  };

  // No mostrar la barra de navegación en páginas públicas
  if (pathname?.startsWith('/recepcion') || pathname?.startsWith('/login')) {
    return null;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getInitials = (name: string) => {
    if (!name) return "PV";
    const parts = name.trim().split(" ").filter(p => p !== "");
    if (parts.length === 0) return "PV";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getLinkClass = (href: string) => {
    const isActive = pathname === href;
    return `px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 flex items-center border-b-[3px] ${
      isActive 
        ? "bg-white/10 text-white border-[#FE5000]" 
        : "border-transparent text-blue-100 hover:text-white hover:bg-white/5"
    }`;
  };

  return (
    <nav className="bg-[#00205B] shadow-md z-50 sticky top-0 border-b-4 border-[#FE5000]">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center">
            
            {/* LOGO INSTITUCIONAL PRO */}
            <Link href="/" className="mr-8 flex items-center gap-4 group py-2">
              <div className="bg-white p-2 rounded-lg shadow-md flex items-center justify-center group-hover:shadow-lg transition-all duration-300 shrink-0">
                <img 
                  src="/logo-bnc.png" 
                  alt="Logo BNC" 
                  className="h-9 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[9px] font-medium text-blue-200/70 uppercase tracking-wider leading-tight">V.P.E. Banca Comercial</span>
                <span className="text-[9px] font-medium text-blue-200/70 uppercase tracking-wider leading-tight mb-1">V.P. Administración de Agencias</span>
                <span className="text-lg font-black text-white tracking-widest leading-none drop-shadow-md">INVENTARIO PAPEL VALOR</span>
              </div>
            </Link>

            {/* ENLACES DE NAVEGACIÓN */}
            <div className="hidden md:flex space-x-2">
              
              {/* Visible para todos (Pasa a ser el primero) */}
              <Link href="/asignaciones" onClick={() => handleLinkClick('/asignaciones')} className={getLinkClass('/asignaciones')}>
                Métricas Operativas
              </Link>

              {/* Visible para Admin y Usuario (Pasa a ser el segundo) */}
              {(rol === 'admin' || rol === 'usuario') && (
                <Link href="/distribucion" onClick={() => handleLinkClick('/distribucion')} className={getLinkClass('/distribucion')}>
                  Distribución y Rastreo
                </Link>
              )}
              
              {/* Visible para Admin y Usuario */}
              {(rol === 'admin' || rol === 'usuario') && (
                <Link href="/reporte-tabular" onClick={() => handleLinkClick('/reporte-tabular')} className={getLinkClass('/reporte-tabular')}>
                  Buscador Tabular
                </Link>
              )}

              {/* Visible solo para Admin */}
              {rol === 'admin' && (
                <Link href="/carga" onClick={() => handleLinkClick('/carga')} className={getLinkClass('/carga')}>
                  Carga Masiva
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {rol === 'admin' && (
              <Link href="/admin" onClick={() => handleLinkClick('/admin')} className={`transition-colors ${pathname === '/admin' ? 'text-[#FE5000] font-black' : 'text-white hover:text-orange-200 font-bold'} text-sm`}>
                Panel Admin
              </Link>
            )}
            
            {/* DROPDOWN DE USUARIO */}
            <div className="relative ml-2">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                onBlur={() => setTimeout(() => setShowUserMenu(false), 200)}
                className="flex items-center gap-2 focus:outline-none"
                title="Menú de Usuario"
              >
                <div className="w-10 h-10 bg-[#FE5000] rounded-full flex items-center justify-center text-sm font-bold shadow-inner text-white hover:bg-[#e04800] transition-colors border-2 border-[#00205B]">
                  {getInitials(nombre)}
                </div>
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-2xl py-2 border border-gray-100 animate-in fade-in slide-in-from-top-2">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <p className="text-sm font-black text-[#00205B] truncate">{nombre || 'Usuario'}</p>
                    <p className="text-xs font-bold text-gray-500 capitalize mt-0.5">{rol}</p>
                  </div>
                  <button 
                    onClick={handleSignOut}
                    className="w-full text-left px-5 py-3 text-sm text-red-600 hover:bg-red-50 font-bold flex items-center gap-3 transition-colors mt-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
      {/* Overlay de carga forzado al navegar */}
      {isNavigating && <LoadingOverlay />}
    </nav>
  );
}
