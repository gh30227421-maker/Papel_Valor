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
  X,
  Bell,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { checkSudebanSchedule } from "@/lib/sudebanUtils";

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

  // Estado de Recordatorio Automático SUDEBAN (Miércoles, 15 y Fin de Mes)
  const [sudebanInfo, setSudebanInfo] = useState<{
    isDueToday: boolean;
    reason: string;
    dateKey: string;
    isSentToday: boolean;
  }>({ isDueToday: false, reason: "", dateKey: "", isSentToday: false });
  const [showSudebanPopover, setShowSudebanPopover] = useState(false);
  const sudebanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncSudebanAlert = () => {
      const sched = checkSudebanSchedule(new Date());
      let isSent = false;
      try {
        isSent = localStorage.getItem(`sudeban_sent_${sched.dateKey}`) === "true";
      } catch {}
      setSudebanInfo({
        isDueToday: sched.isDueToday,
        reason: sched.reason,
        dateKey: sched.dateKey,
        isSentToday: isSent,
      });

      // Si hoy corresponde enviar y aún no se ha enviado ni avisado en esta sesión, mostrar Toast y Notificación de Windows
      if (sched.isDueToday && !isSent) {
        const sessionNotifiedKey = `sudeban_toast_shown_${sched.dateKey}`;
        if (!sessionStorage.getItem(sessionNotifiedKey)) {
          sessionStorage.setItem(sessionNotifiedKey, "true");
          setTimeout(() => {
            toast.warning(`🔔 Recordatorio SUDEBAN: Hoy corresponde enviar el Reporte de TDD Activas (${sched.reason})`, {
              duration: 12000,
              action: {
                label: "Ir a Generar",
                onClick: () => {
                  window.location.href = "/asignaciones?tab=stock&sudeban=open";
                },
              },
            });

            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification("Recordatorio SUDEBAN - Papel Valor BNC", {
                  body: `Hoy corresponde enviar el Reporte de Stock por Estado (${sched.reason}). Haz clic en el portal para descargarlo en 1 clic.`,
                  icon: "/icon-192.png",
                });
              } catch {}
            }
          }, 1500);
        }
      }
    };

    syncSudebanAlert();
    window.addEventListener("sudeban-status-changed", syncSudebanAlert);
    return () => window.removeEventListener("sudeban-status-changed", syncSudebanAlert);
  }, []);

  const handleMarkSudebanSent = (sent: boolean) => {
    try {
      if (sent) {
        localStorage.setItem(`sudeban_sent_${sudebanInfo.dateKey}`, "true");
        toast.success("Reporte SUDEBAN marcado como enviado por el día de hoy.");
      } else {
        localStorage.removeItem(`sudeban_sent_${sudebanInfo.dateKey}`);
      }
      setSudebanInfo((prev) => ({ ...prev, isSentToday: sent }));
      window.dispatchEvent(new Event("sudeban-status-changed"));
    } catch {}
  };

  const handleEnableBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Tu navegador no soporta notificaciones de escritorio.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      toast.success("¡Notificaciones de escritorio activadas! Te avisaremos los Miércoles, días 15 y Fin de Mes.");
      new Notification("Notificaciones Activas - Papel Valor BNC", {
        body: "Recibirás avisos automáticos los Miércoles, días 15 y último de cada mes.",
        icon: "/icon-192.png",
      });
    } else {
      toast.info("Permiso de notificaciones denegado en el navegador.");
    }
  };

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

  // Click outside to close user menu and sudeban popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (sudebanRef.current && !sudebanRef.current.contains(event.target as Node)) {
        setShowSudebanPopover(false);
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
            {/* CAMPANA DE RECORDATORIO SUDEBAN (MIÉRCOLES, 15 Y FIN DE MES) */}
            {(rol === "admin" || rol === "usuario") && (
              <div className="relative" ref={sudebanRef}>
                <button
                  type="button"
                  onClick={() => setShowSudebanPopover(!showSudebanPopover)}
                  className={`relative px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    sudebanInfo.isDueToday && !sudebanInfo.isSentToday
                      ? "bg-orange-50 border-[#FE5000] text-[#FE5000] hover:bg-orange-100"
                      : sudebanInfo.isSentToday
                      ? "bg-emerald-50 border-emerald-200 text-[#009639]"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:text-[#00205B] hover:bg-slate-100"
                  }`}
                  title="Calendario y Generador de Reporte SUDEBAN (Miércoles, 15 y Fin de Mes)"
                >
                  <Bell className={`w-4 h-4 ${sudebanInfo.isDueToday && !sudebanInfo.isSentToday ? "animate-bounce text-[#FE5000]" : ""}`} />
                  <span className="hidden md:inline">
                    {sudebanInfo.isDueToday && !sudebanInfo.isSentToday
                      ? "¡Hoy Toca SUDEBAN!"
                      : sudebanInfo.isSentToday
                      ? "SUDEBAN Enviado ✓"
                      : "SUDEBAN"}
                  </span>
                  {sudebanInfo.isDueToday && !sudebanInfo.isSentToday && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FE5000] animate-ping" />
                  )}
                </button>

                {showSudebanPopover && (
                  <div className="absolute right-0 mt-2.5 w-80 bg-white rounded-2xl shadow-2xl p-4 border border-slate-200 z-50 text-gray-900 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-[#00205B]">
                          Calendario Regulatorio
                        </span>
                        <h4 className="text-sm font-black text-[#00205B] mt-1">
                          Reporte SUDEBAN (Stock por Estado)
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSudebanPopover(false)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="py-3 space-y-2.5 text-xs">
                      <div className={`p-3 rounded-xl border ${
                        sudebanInfo.isDueToday && !sudebanInfo.isSentToday
                          ? "bg-orange-50/80 border-orange-200 text-orange-950"
                          : sudebanInfo.isSentToday
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}>
                        <p className="font-black text-xs">
                          {sudebanInfo.isDueToday
                            ? `🔔 Hoy es día de corte: ${sudebanInfo.reason}`
                            : "📅 Próximos cortes programados:"}
                        </p>
                        <ul className="mt-1.5 space-y-1 text-[11px] text-gray-600 font-medium list-disc list-inside">
                          <li>Todos los <strong>Miércoles</strong></li>
                          <li>Día <strong>15 de cada mes</strong> (Quincena)</li>
                          <li><strong>Último día</strong> de cada mes</li>
                        </ul>
                      </div>

                      <div className="flex flex-col gap-2 pt-1">
                        <Link
                          href="/asignaciones?tab=stock&sudeban=open"
                          onClick={() => setShowSudebanPopover(false)}
                          className="w-full py-2.5 px-3 bg-[#009639] hover:bg-[#007a2e] text-white font-black text-xs rounded-xl text-center shadow-sm transition-colors flex items-center justify-center gap-1.5"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Abrir y Descargar Excel (1-Clic)</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleMarkSudebanSent(!sudebanInfo.isSentToday)}
                          className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#009639]" />
                          <span>
                            {sudebanInfo.isSentToday
                              ? "Desmarcar como enviado hoy"
                              : "Marcar como Ya Enviado hoy"}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleEnableBrowserNotifications}
                          className="w-full py-1.5 px-3 text-[11px] font-bold text-[#00205B] hover:underline text-center cursor-pointer"
                        >
                          🔔 Activar avisos en Escritorio de Windows
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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
