'use client'

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import LoadingOverlay from "./LoadingOverlay";
import { 
  LayoutDashboard, 
  Truck, 
  FileSpreadsheet, 
  UploadCloud, 
  ShieldCheck, 
  User, 
  LogOut, 
  Download, 
  Menu, 
  X 
} from "lucide-react";

export default function Navigation({ initialRol = 'invitado', initialNombre = '' }: { initialRol?: string, initialNombre?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [rol, setRol] = useState<string>(initialRol);
  const [nombre, setNombre] = useState<string>(initialNombre);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  useEffect(() => {
    setRol(initialRol);
    setNombre(initialNombre);
  }, [initialRol, initialNombre]);

  useEffect(() => {
    setIsNavigating(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Click outside to close user menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLinkClick = (href: string) => {
    if (pathname !== href) {
      setIsNavigating(true);
    }
    setMobileMenuOpen(false);
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

  const isTabActive = (href: string) => {
    if (href === '/asignaciones') {
      return pathname === '/asignaciones' || pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  const navLinks = [
    {
      name: "Métricas Operativas",
      href: "/asignaciones",
      icon: LayoutDashboard,
      visible: true,
    },
    {
      name: "Distribución y Rastreo",
      href: "/distribucion",
      icon: Truck,
      visible: rol === 'admin' || rol === 'usuario',
    },
    {
      name: "Buscador Tabular",
      href: "/reporte-tabular",
      icon: FileSpreadsheet,
      visible: rol === 'admin' || rol === 'usuario',
    },
    {
      name: "Carga Masiva",
      href: "/carga",
      icon: UploadCloud,
      visible: rol === 'admin',
    },
    {
      name: "Panel Admin",
      href: "/admin",
      icon: ShieldCheck,
      visible: rol === 'admin',
    },
  ];

  return (
    <nav className="bg-white border-b-2 border-[#FE5000] shadow-[0_2px_8px_rgba(0,32,91,0.04)] sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* LADO IZQUIERDO: LOGO BNC + TÍTULO */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group py-1.5 focus:outline-none">
              <img 
                src="/logo-bnc.png" 
                alt="Logo BNC" 
                className="h-8 sm:h-9 w-auto object-contain group-hover:scale-105 transition-transform duration-200"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="h-6 w-[1.5px] bg-slate-200" />
              <div className="flex items-center gap-1.5 whitespace-nowrap select-none">
                <span className="text-base sm:text-lg font-black text-[#00205B] tracking-tight">
                  INVENTARIO
                </span>
                <span className="text-base sm:text-lg font-medium text-slate-600 tracking-wide">
                  PAPEL VALOR
                </span>
              </div>
            </Link>

            {/* ENLACES DE NAVEGACIÓN DESKTOP */}
            <div className="hidden lg:flex items-center space-x-1.5 xl:space-x-2 ml-4 xl:ml-6">
              {navLinks.filter(item => item.visible).map((item) => {
                const IconComponent = item.icon;
                const active = isTabActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => handleLinkClick(item.href)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                      active
                        ? "bg-[#00205B] text-white font-black shadow-sm"
                        : "text-slate-800 hover:text-[#00205B] hover:bg-slate-100 font-bold"
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 shrink-0 ${active ? "text-white" : "text-slate-700"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* LADO DERECHO: ACCIONES Y USUARIO */}
          <div className="flex items-center gap-3">
            {/* BOTÓN INSTALAR PWA */}
            {isInstallable && (
              <button 
                onClick={handleInstallClick}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#FE5000] text-white rounded-lg text-xs font-bold hover:bg-[#e04800] transition-colors shadow-xs"
                title="Instalar como aplicación de escritorio o móvil"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </button>
            )}

            {/* AVATAR CIRCULAR DE USUARIO (IDÉNTICO AL EJEMPLO) */}
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-9 h-9 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 hover:text-[#00205B] transition-colors focus:outline-none focus:ring-2 focus:ring-[#FE5000]/40 shadow-xs"
                title="Menú de Usuario"
                aria-label="Perfil de Usuario"
              >
                <User className="w-4 h-4 text-slate-700" />
              </button>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2.5 w-60 bg-white rounded-2xl shadow-xl py-2 border border-slate-100 animate-in fade-in zoom-in-95 duration-150 z-50 text-gray-900">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#00205B] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(nombre)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-[#00205B] truncate">{nombre || 'Usuario BNC'}</p>
                        <span className="inline-block text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full capitalize mt-0.5">
                          {rol}
                        </span>
                      </div>
                    </div>
                  </div>

                  {rol === 'admin' && (
                    <Link
                      href="/admin"
                      onClick={() => { setShowUserMenu(false); handleLinkClick('/admin'); }}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#00205B] transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-slate-700" />
                      <span>Panel de Administración</span>
                    </Link>
                  )}

                  <button 
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 font-semibold flex items-center gap-2.5 transition-colors border-t border-slate-50 mt-1"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>

            {/* BOTÓN HAMBURGUESA MÓVIL */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-[#00205B] hover:bg-slate-100 transition-colors"
              title="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* MENÚ DESPLEGABLE MÓVIL / TABLET */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-100 py-3 space-y-1 animate-in slide-in-from-top-2 duration-150">
            {navLinks.filter(item => item.visible).map((item) => {
              const IconComponent = item.icon;
              const active = isTabActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => handleLinkClick(item.href)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    active
                      ? "bg-[#00205B] text-white shadow-sm"
                      : "text-slate-800 hover:bg-slate-100 hover:text-[#00205B]"
                  }`}
                >
                  <IconComponent className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-slate-700"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Overlay de carga forzado al navegar */}
      {isNavigating && <LoadingOverlay />}
    </nav>
  );
}
