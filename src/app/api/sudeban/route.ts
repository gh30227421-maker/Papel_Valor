import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Convierte una fecha "YYYY-MM-DD" al número de serie de fecha de Excel (base 1900)
 * Por ejemplo: "2026-08-26" -> 46260
 */
function dateToExcelSerial(dateStr: string): number {
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  const utcDate = Date.UTC(year, month - 1, day);
  const excelEpoch = Date.UTC(1899, 11, 30); // 1899-12-30 compensa el bug del año bisiesto 1900 en Excel
  return Math.round((utcDate - excelEpoch) / (1000 * 60 * 60 * 24));
}

/**
 * Codifica un número entero o flotante en formato IEEE-754 RK de 32 bits (BIFF8)
 */
function encodeRK(val: number): number {
  const intVal = Math.round(val);
  // RK integer de 30 bits con signo: (intVal << 2) | 0x02
  return ((intVal << 2) | 2) >>> 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fecha, values } = body as { fecha: string; values: number[] };

    if (!Array.isArray(values) || values.length !== 25) {
      return NextResponse.json(
        { error: "Se requieren exactamente las 25 filas del formato SUDEBAN (01 al 25)." },
        { status: 400 }
      );
    }

    const publicDir = path.join(process.cwd(), "public");
    const files = fs.readdirSync(publicDir);
    const templateFile = files.find(
      (f) => f.toUpperCase().includes("SUDEBAN") && (f.endsWith(".xls") || f.endsWith(".xlsx"))
    );

    if (!templateFile) {
      return NextResponse.json(
        { error: "No se encontró la plantilla REPORTE DE SUDEBAN TDD ACTIVAS.xls en la carpeta /public." },
        { status: 404 }
      );
    }

    const templatePath = path.join(publicDir, templateFile);
    const orig = fs.readFileSync(templatePath);
    const buf = Buffer.from(orig);

    // 1. Inyectar la Fecha del Reporte en la celda B11 (RK record en offset 191566)
    if (fecha) {
      const serial = dateToExcelSerial(fecha);
      const b8 = Buffer.alloc(8);
      b8.writeDoubleLE(serial, 0);
      // En BIFF8 un float IEEE sin decimales en RK usa los 4 bytes superiores del double (con los 2 bits inferiores en 0)
      const rkFloat = b8.readUInt32LE(4) & 0xfffffffc;
      buf.writeUInt32LE(rkFloat >>> 0, 191566 + 10);
    }

    // 2. Offsets exactos de los registros MULBLANK de las filas 19 a 42 (Códigos 01 ANZOATEGUI al 24 OPERACIONES MASIVAS)
    const rows19to42Offsets = [
      191908, // 01 ANZOATEGUI (Row 19)
      191960, // 02 APURE (Row 20)
      192012, // 03 ARAGUA (Row 21)
      192064, // 04 BARINAS (Row 22)
      192116, // 05 BOLIVAR (Row 23)
      192168, // 06 CARABOBO (Row 24)
      192220, // 07 COJEDES (Row 25)
      192272, // 08 DELTA AMACURO (Row 26)
      192324, // 09 DISTRITO CAPITAL (Row 27)
      192376, // 10 FALCON (Row 28)
      192428, // 11 GUARICO (Row 29)
      192480, // 12 LA GUAIRA (Row 30)
      192532, // 13 LARA (Row 31)
      192584, // 14 MERIDA (Row 32)
      193348, // 15 MIRANDA (Row 33)
      193400, // 16 MONAGAS (Row 34)
      193452, // 17 NUEVA ESPARTA (Row 35)
      193504, // 18 PORTUGUESA (Row 36)
      193556, // 19 SUCRE (Row 37)
      193608, // 20 TACHIRA (Row 38)
      193660, // 21 TRUJILLO (Row 39)
      193712, // 22 YARACUY (Row 40)
      193764, // 23 ZULIA (Row 41)
      193816, // 24 OPERACIONES MASIVAS (Row 42)
    ];

    let totalSum = 0;

    rows19to42Offsets.forEach((off, idx) => {
      const qty = Math.max(0, Math.round(Number(values[idx]) || 0));
      totalSum += qty;
      const row = orig.readUInt16LE(off + 4);
      const xfD = orig.readUInt16LE(off + 8); // Preserva el formato, fuente y bordes originales de la celda D

      // Reemplazamos MULBLANK (14 bytes) por RK (14 bytes) en el mismo lugar exacto
      buf.writeUInt16LE(0x027e, off); // Record ID: RK
      buf.writeUInt16LE(10, off + 2); // Record Length: 10 bytes
      buf.writeUInt16LE(row, off + 4); // Row index
      buf.writeUInt16LE(3, off + 6); // Column D (index 3)
      buf.writeUInt16LE(xfD, off + 8); // Original XF style index
      buf.writeUInt32LE(encodeRK(qty), off + 10); // 32-bit RK integer value
    });

    // 3. Fila 43 (Código 25: SEDE CENTRAL) en offset 193868
    const sedeCentralQty = Math.max(0, Math.round(Number(values[24]) || 0));
    totalSum += sedeCentralQty;

    const row43Off = 193868;
    const xf43 = orig.readUInt16LE(row43Off + 8);
    buf.writeUInt16LE(0x027e, row43Off); // RK record (14 bytes)
    buf.writeUInt16LE(10, row43Off + 2);
    buf.writeUInt16LE(42, row43Off + 4); // Row 43 (0-based 42)
    buf.writeUInt16LE(3, row43Off + 6); // Col D
    buf.writeUInt16LE(xf43, row43Off + 8);
    buf.writeUInt32LE(encodeRK(sedeCentralQty), row43Off + 10);

    // Ajustamos los 2 bytes sobrantes de la fila 43 convirtiendo C44 (BLANK de 10 bytes) en MULBLANK(2..2) de 12 bytes
    // para que el offset de la fórmula D44 (193918) y el resto del archivo no se desplacen ni 1 solo byte
    orig.copy(buf, 193882, 193884, 193908);
    const xf44C = orig.readUInt16LE(193908 + 8);
    buf.writeUInt16LE(0x00be, 193906); // MULBLANK
    buf.writeUInt16LE(8, 193908); // Length 8
    buf.writeUInt16LE(43, 193910); // Row 44 (0-based 43)
    buf.writeUInt16LE(2, 193912); // First Col: C (2)
    buf.writeUInt16LE(xf44C, 193914); // XF of C44
    buf.writeUInt16LE(2, 193916); // Last Col: C (2)

    // Actualizar los 2 deltas en DBCELL (offset 194387) para las filas 43 y 44
    buf.writeUInt16LE(52, 194387 + 8 + 11 * 2); // idx 11: 54 -> 52
    buf.writeUInt16LE(85, 194387 + 8 + 12 * 2); // idx 12: 83 -> 85

    // 4. Actualizar el valor pre-calculado de la fórmula SUM(D19:D43) en D44 (offset 193918)
    buf.writeDoubleLE(totalSum, 193918 + 10);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": `attachment; filename="REPORTE_DE_SUDEBAN_TDD_ACTIVAS_${fecha || "HOY"}.xls"`,
      },
    });
  } catch (err: any) {
    console.error("Error generando Excel SUDEBAN:", err);
    return NextResponse.json(
      { error: err.message || "Error al generar la plantilla SUDEBAN" },
      { status: 500 }
    );
  }
}
