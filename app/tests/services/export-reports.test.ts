import { describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

// Evita instanciar el PrismaClient real: el test solo ejercita funciones puras.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  buildReportCsv,
  buildReportXlsx,
  DEPRECIACION_REPORT_COLUMNS,
  INVENTARIO_REPORT_COLUMNS,
  type ReportExportPayload,
} from "@/lib/services/export.service";

const inventarioRows = [
  {
    codigo: "ACT-2026-0001",
    descripcion: "Laptop, Proyector 4K",
    tipoActivo: "Computadoras",
    departamento: "Tecnología",
    custodio: "María Rodríguez",
    estado: "ACTIVO",
    fechaAdquisicion: "2026-01-10",
    costoAdquisicion: "85000.00",
    depreciacionAcumulada: "12000.00",
    valorEnLibros: "73000.00",
  },
  {
    codigo: "ACT-2026-0002",
    descripcion: "Camioneta Ford",
    tipoActivo: "Vehículos",
    departamento: "Contabilidad",
    custodio: "Juan Pérez",
    estado: "EN_MANTENIMIENTO",
    fechaAdquisicion: "2026-02-15",
    costoAdquisicion: "450000.00",
    depreciacionAcumulada: "28000.00",
    valorEnLibros: "422000.00",
  },
];

const inventarioPayload: ReportExportPayload = {
  sheetName: "Inventario",
  title: "ActivaCore — Inventario de Activos Fijos",
  subtitle: "Filtros: Departamento=Todos | Estado=Todos | Emitido: 2026-10-21 14:32",
  columns: INVENTARIO_REPORT_COLUMNS,
  rows: inventarioRows,
  totals: { costoAdquisicion: "535000.00", depreciacionAcumulada: "40000.00", valorEnLibros: "495000.00" },
};

const depreciacionPayload: ReportExportPayload = {
  sheetName: "Depreciación",
  title: "ActivaCore — Depreciación Fiscal del Período 2026-10",
  subtitle: "Período fiscal: 2026-10",
  columns: DEPRECIACION_REPORT_COLUMNS,
  rows: [
    {
      codigo: "ACT-2026-0001",
      descripcion: "Laptop Dell",
      categoriaDgii: "1",
      costoOriginal: "85000.00",
      cuotaMes: "1275.00",
      depreciacionAcumulada: "12000.00",
      valorEnLibros: "73000.00",
      cuentaCompra: "1-01-04-0020",
      cuentaDepreciacion: "1-01-04-0021",
    },
  ],
  totals: { cuotaMes: "1275.00", depreciacionAcumulada: "12000.00", valorEnLibros: "73000.00" },
};

async function loadWorksheet(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("El XLSX no contiene hojas");
  return sheet;
}

describe("buildReportXlsx", () => {
  it("genera un workbook con el título institucional en la fila 1 (fondo azul UNAPEC)", async () => {
    const sheet = await loadWorksheet(await buildReportXlsx(inventarioPayload));
    const titleCell = sheet.getCell(1, 1);

    expect(titleCell.value).toBe(inventarioPayload.title);
    expect(titleCell.fill).toMatchObject({ type: "pattern", fgColor: { argb: "FF002D62" } });
    expect(titleCell.font).toMatchObject({ bold: true, color: { argb: "FFFFFFFF" } });
  });

  it("coloca subtítulo de filtros en la fila 2 y encabezados en la fila 3", async () => {
    const sheet = await loadWorksheet(await buildReportXlsx(inventarioPayload));

    expect(sheet.getCell(2, 1).value).toBe(inventarioPayload.subtitle);
    expect(sheet.getCell(3, 1).value).toBe("Código");
    expect(sheet.getCell(3, 8).value).toBe("Costo Adquisición");
  });

  it("activa autoFilter sobre la fila de encabezado", async () => {
    const sheet = await loadWorksheet(await buildReportXlsx(inventarioPayload));

    expect(sheet.autoFilter).toBe("A3:J3");
  });

  it("aplica formato de moneda dominicana RD$ y alineación derecha en columnas financieras", async () => {
    const sheet = await loadWorksheet(await buildReportXlsx(inventarioPayload));
    const costoCell = sheet.getCell(4, 8); // primera fila de datos, columna Costo

    expect(costoCell.numFmt).toBe('"RD$"#,##0.00');
    expect(costoCell.value).toBe(85000);
    expect(costoCell.alignment).toMatchObject({ horizontal: "right" });
  });

  it("escribe la fila final de totales con la suma exacta recibida", async () => {
    const sheet = await loadWorksheet(await buildReportXlsx(inventarioPayload));

    const totalRowNumber = 4 + inventarioRows.length; // título + subtítulo + header + 2 filas
    const totalRow = sheet.getRow(totalRowNumber);

    expect(totalRow.getCell(1).value).toBe("TOTALES");
    expect(totalRow.getCell(8).value).toBe(535000);
    expect(totalRow.getCell(8).numFmt).toBe('"RD$"#,##0.00');
    expect(totalRow.getCell(8).font).toMatchObject({ bold: true });
    expect(totalRow.getCell(9).value).toBe(40000);
    expect(totalRow.getCell(10).value).toBe(495000);
  });

  it("redondea Half-Up a 2 decimales valores con floating point", async () => {
    const sheet = await loadWorksheet(
      await buildReportXlsx({
        ...inventarioPayload,
        rows: [{ ...inventarioRows[0], costoAdquisicion: "1000.005" }],
        totals: { costoAdquisicion: "0.1" },
      })
    );

    expect(sheet.getCell(4, 8).value).toBe(1000.01);
    expect(sheet.getCell(5, 8).value).toBe(0.1);
  });

  it("omite la fila de totales cuando no se envían totales", async () => {
    const sheet = await loadWorksheet(
      await buildReportXlsx({ ...inventarioPayload, totals: undefined })
    );

    expect(sheet.getRow(4 + inventarioRows.length).getCell(1).value).not.toBe("TOTALES");
  });

  it("agrega aviso de truncamiento al pie cuando truncated=true", async () => {
    const sheet = await loadWorksheet(
      await buildReportXlsx({ ...inventarioPayload, truncated: true, maxRows: 10000 })
    );

    const footerRow = sheet.getRow(5 + inventarioRows.length);
    expect(String(footerRow.getCell(1).value)).toContain("truncada al tope operativo de 10000 filas");
  });

  it("genera el reporte de depreciación con 9 columnas y headers propios", async () => {
    const sheet = await loadWorksheet(await buildReportXlsx(depreciacionPayload));

    expect(sheet.getCell(3, 1).value).toBe("Código");
    expect(sheet.getCell(3, 5).value).toBe("Cuota del Mes");
    expect(sheet.getCell(3, 9).value).toBe("Cuenta Depreciación");
    expect(sheet.getCell(4, 5).numFmt).toBe('"RD$"#,##0.00');
  });
});

describe("buildReportCsv", () => {
  it("inicia con BOM UTF-8 (EF BB BF) para apertura limpia en Excel Windows", () => {
    const csv = buildReportCsv(inventarioPayload);
    const bytes = Buffer.from(csv, "utf8");

    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it("conserva acentos y el símbolo monetario sin mojibake", () => {
    const csv = buildReportCsv(inventarioPayload);

    expect(csv).toContain("María Rodríguez");
    expect(csv).toContain("Depreciación Acumulada");
  });

  it("entrecomilla campos que contienen comas", () => {
    const csv = buildReportCsv(inventarioPayload);

    expect(csv).toContain('"Laptop, Proyector 4K"');
  });

  it("emite montos con 2 decimales fijos y fila de TOTALES", () => {
    const csv = buildReportCsv(inventarioPayload);
    const lines = csv.replace("\uFEFF", "").trim().split("\r\n");

    expect(lines[1]).toContain("85000.00");
    expect(lines[lines.length - 1]).toContain("TOTALES");
    expect(lines[lines.length - 1]).toContain("535000.00");
  });

  it("agrega footer de truncamiento cuando truncated=true", () => {
    const csv = buildReportCsv({ ...inventarioPayload, truncated: true, maxRows: 10000 });

    expect(csv).toContain("AVISO: exportación truncada al tope operativo de 10000 filas.");
  });

  it("no agrega footer de truncamiento cuando truncated es false", () => {
    const csv = buildReportCsv(inventarioPayload);

    expect(csv).not.toContain("AVISO:");
  });
});
