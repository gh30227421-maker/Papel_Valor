import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navigation from "@/components/Navigation";
import { createClient } from "@/lib/supabase/server";
import { Toaster } from "sonner";
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
      </body>
    </html>
  );
}
