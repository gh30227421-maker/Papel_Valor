"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// Usamos el SERVICE_ROLE_KEY si está disponible para operaciones administrativas garantizadas
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

export interface StockCustodiaData {
  id?: number;
  concepto: string;
  cantidad: number;
  observaciones?: string;
  actualizado_por?: string;
  updated_at?: string;
}

/**
 * Verifica si el usuario actual en sesión tiene rol de 'admin'
 */
export async function checkIsAdmin(): Promise<{ isAdmin: boolean; userName: string }> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return { isAdmin: false, userName: "" };
    }
    const { data: profile } = await supabase
      .from("perfiles")
      .select("rol, nombre")
      .eq("id", user.id)
      .single();

    return {
      isAdmin: profile?.rol === "admin",
      userName: profile?.nombre || user.email || "Administrador",
    };
  } catch (e) {
    console.error("Error al verificar permisos de admin:", e);
    return { isAdmin: false, userName: "" };
  }
}

/**
 * Obtiene el registro actual de stock en custodia física
 */
export async function getStockCustodia(): Promise<StockCustodiaData> {
  try {
    const { data, error } = await supabaseAdmin
      .from("stock_custodia")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("Tabla stock_custodia no disponible aún o vacía:", error.message);
      return {
        concepto: "Custodia Bóveda Central (Lote Físico)",
        cantidad: 0,
        observaciones: "",
      };
    }

    if (!data) {
      return {
        concepto: "Custodia Bóveda Central (Lote Físico)",
        cantidad: 0,
        observaciones: "",
      };
    }

    return data as StockCustodiaData;
  } catch (err: any) {
    console.error("Error al obtener stock_custodia:", err);
    return {
      concepto: "Custodia Bóveda Central (Lote Físico)",
      cantidad: 0,
      observaciones: "",
    };
  }
}

/**
 * Guarda o actualiza la cantidad en custodia física
 * PROTECCIÓN: Solo ejecutable por usuarios con rol de 'admin'
 */
export async function saveStockCustodia(formData: {
  cantidad: number;
  concepto?: string;
  observaciones?: string;
  actualizado_por?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 1. Verificación de Seguridad en Servidor
    const { isAdmin, userName } = await checkIsAdmin();
    if (!isAdmin) {
      return {
        success: false,
        error: "Acceso denegado: Esta acción está reservada exclusivamente para usuarios con rol de Administrador.",
      };
    }

    const cantidad = Math.max(0, Math.floor(Number(formData.cantidad) || 0));
    const concepto = formData.concepto?.trim() || "Custodia Bóveda Central (Lote Físico)";
    const observaciones = formData.observaciones?.trim() || "";
    const actualizado_por = userName || formData.actualizado_por?.trim() || "Administrador BNC";

    // 2. Intentamos buscar si ya existe la fila id=1
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from("stock_custodia")
      .select("id")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (selectErr) {
      return {
        success: false,
        error: `La tabla 'stock_custodia' aún no existe en Supabase. Error: ${selectErr.message}`,
      };
    }

    if (existing?.id) {
      // Actualizar registro existente
      const { data, error: updateErr } = await supabaseAdmin
        .from("stock_custodia")
        .update({
          cantidad,
          concepto,
          observaciones,
          actualizado_por,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }
      return { success: true, data };
    } else {
      // Insertar nuevo registro
      const { data, error: insertErr } = await supabaseAdmin
        .from("stock_custodia")
        .insert({
          id: 1,
          cantidad,
          concepto,
          observaciones,
          actualizado_por,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertErr) {
        return { success: false, error: insertErr.message };
      }
      return { success: true, data };
    }
  } catch (err: any) {
    console.error("Error al guardar stock custodia:", err);
    return { success: false, error: err.message || "Error inesperado al guardar" };
  }
}
