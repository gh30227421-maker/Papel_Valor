import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "@/components/Navigation";
import { createClient } from "@/lib/supabase/server";
import { Toaster } from "sonner";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Papel Valor - Operaciones",
  description: "Sistema de gestión centralizada de papel valor y tarjetas.",
  manifest: "/manifest.json",
  themeColor: "#FE5000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Papel Valor",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let serverRol = "invitado";
  let serverNombre = "";
  
  if (user) {
    const { data } = await supabase.from('perfiles').select('rol, nombre').eq('id', user.id).single();
    if (data) {
      serverRol = data.rol;
      serverNombre = data.nombre || "";
    }
  }

  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-gray-50" suppressHydrationWarning>
        <Navigation initialRol={serverRol} initialNombre={serverNombre} />
        {children}
        <Toaster position="top-right" richColors />
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('Service Worker registration successful with scope: ', registration.scope);
                  },
                  function(err) {
                    console.log('Service Worker registration failed: ', err);
                  }
                );
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
