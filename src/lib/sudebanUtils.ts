import { getLocalTodayDate } from "./dateUtils";

export interface SudebanRow {
  codigo: string;
  nombre: string;
  cantidad: number;
}

export const SUDEBAN_STATES_ORDER: { codigo: string; nombre: string }[] = [
  { codigo: "01", nombre: "ANZOATEGUI" },
  { codigo: "02", nombre: "APURE" },
  { codigo: "03", nombre: "ARAGUA" },
  { codigo: "04", nombre: "BARINAS" },
  { codigo: "05", nombre: "BOLIVAR" },
  { codigo: "06", nombre: "CARABOBO" },
  { codigo: "07", nombre: "COJEDES" },
  { codigo: "08", nombre: "DELTA AMACURO" },
  { codigo: "09", nombre: "DISTRITO CAPITAL" },
  { codigo: "10", nombre: "FALCON" },
  { codigo: "11", nombre: "GUARICO" },
  { codigo: "12", nombre: "LA GUAIRA" },
  { codigo: "13", nombre: "LARA" },
  { codigo: "14", nombre: "MERIDA" },
  { codigo: "15", nombre: "MIRANDA" },
  { codigo: "16", nombre: "MONAGAS" },
  { codigo: "17", nombre: "NUEVA ESPARTA" },
  { codigo: "18", nombre: "PORTUGUESA" },
  { codigo: "19", nombre: "SUCRE" },
  { codigo: "20", nombre: "TACHIRA" },
  { codigo: "21", nombre: "TRUJILLO" },
  { codigo: "22", nombre: "YARACUY" },
  { codigo: "23", nombre: "ZULIA" },
  { codigo: "24", nombre: "OPERACIONES MASIVAS" },
  { codigo: "25", nombre: "SEDE CENTRAL" },
];

export function normalizeStateName(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Construye las 25 filas exactas del reporte SUDEBAN a partir de la respuesta de getStockStats("")
 */
export function buildSudebanRows(stats: any): { rows: SudebanRow[]; total: number } {
  const estadosList: { id: string; value: number }[] = stats?.estados || [];
  const stockNomina = Number(stats?.stock_nomina) || 0;
  const stockBoveda = Number(stats?.stock_boveda) || 0;

  let total = 0;

  const rows: SudebanRow[] = SUDEBAN_STATES_ORDER.map((item) => {
    let cantidad = 0;

    if (item.codigo === "24") {
      // 24 OPERACIONES MASIVAS -> Nómina Externa (CC 743)
      cantidad = stockNomina;
    } else if (item.codigo === "25") {
      // 25 SEDE CENTRAL -> Bóveda Central (CC 95 + Custodia Física)
      cantidad = stockBoveda;
    } else {
      const target = normalizeStateName(item.nombre);
      const found = estadosList.find((e) => {
        const dbEst = normalizeStateName(e.id);
        if (target === "LA GUAIRA" && (dbEst.includes("GUAIRA") || dbEst.includes("VARGAS"))) {
          return true;
        }
        return dbEst === target || dbEst.includes(target) || target.includes(dbEst);
      });
      cantidad = found ? Number(found.value) || 0 : 0;
    }

    total += cantidad;
    return {
      codigo: item.codigo,
      nombre: item.nombre,
      cantidad,
    };
  });

  return { rows, total };
}

/**
 * Determina si una fecha corresponde a día de envío obligatorio del Reporte SUDEBAN:
 * - Todos los Miércoles (getDay() === 3)
 * - Día 15 de cada mes (o viernes 13/14 si el 15 cae sábado/domingo)
 * - Último día del mes (o viernes previo si el último día cae sábado/domingo)
 */
export function checkSudebanSchedule(now: Date = new Date()): {
  isDueToday: boolean;
  reason: string;
  nextDueText: string;
  dateKey: string;
} {
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();
  const dayOfWeek = now.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb

  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const dateKey = getLocalTodayDate();

  const reasons: string[] = [];

  // 1. ¿Es Miércoles?
  if (dayOfWeek === 3) {
    reasons.push("Corte Semanal de los Miércoles");
  }

  // 2. ¿Es Quincena (Día 15 o viernes hábil previo si 15 cae fin de semana)?
  const day15OfWeek = new Date(year, month, 15).getDay();
  const effectiveQuincenaDay = day15OfWeek === 6 ? 14 : day15OfWeek === 0 ? 13 : 15;
  if (date === 15 || date === effectiveQuincenaDay) {
    reasons.push("Corte Quincenal (Día 15)");
  }

  // 3. ¿Es Último de Mes (o último viernes hábil si fin de mes cae fin de semana)?
  const lastDayOfWeek = new Date(year, month, lastDayOfMonth).getDay();
  const effectiveLastDay =
    lastDayOfWeek === 6 ? lastDayOfMonth - 1 : lastDayOfWeek === 0 ? lastDayOfMonth - 2 : lastDayOfMonth;
  if (date === lastDayOfMonth || date === effectiveLastDay) {
    reasons.push(`Corte de Fin de Mes (Día ${lastDayOfMonth})`);
  }

  return {
    isDueToday: reasons.length > 0,
    reason: reasons.join(" + ") || "Generación bajo demanda",
    nextDueText: "Recuerda enviar todos los Miércoles, días 15 y último de cada mes",
    dateKey,
  };
}
