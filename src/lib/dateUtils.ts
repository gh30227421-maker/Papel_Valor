/**
 * Utilidades de fecha para evitar desfases de zona horaria (UTC vs Local Venezuela UTC-4).
 */

/**
 * Formatea una fecha string (YYYY-MM-DD o ISO timestamp) a formato visual DD/MM/YYYY
 * sin sufrir desfases por conversión a UTC en JavaScript.
 *
 * Ejemplo: "2026-10-13" -> "13/10/2026"
 */
export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const clean = String(dateStr).split("T")[0].trim();
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }
  return clean;
}

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD según la zona horaria LOCAL del usuario,
 * evitando que new Date().toISOString() devuelva el día siguiente después de las 8:00 PM.
 */
export function getLocalTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
