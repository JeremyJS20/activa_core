import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { formatearCedula } from "@/lib/validators/identity";

export type SupportedCatalog = "departamentos" | "tipos-activos" | "empleados";
export type SupportedFormat = "xlsx" | "csv";

export interface ExportResult {
  data: Buffer | string;
  filename: string;
  contentType: string;
}

interface ExportColumnDefinition {
  header: string;
  key: string;
  width?: number;
}

function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsvString(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(escapeCsvValue).join(",");
  const rowLines = rows.map((r) => r.map(escapeCsvValue).join(",")).join("\r\n");
  // Preámbulo UTF-8 BOM (\uFEFF) para visualización nativa limpia en Microsoft Excel sin mojibake
  return `\uFEFF${headerLine}\r\n${rowLines}\r\n`;
}

async function generateExcelBuffer(
  sheetName: string,
  columns: ExportColumnDefinition[],
  rows: Record<string, any>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ActivaCore — Universidad APEC";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 18,
  }));

  // Estilo institucional de encabezado (Azul Marino UNAPEC #002D62)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF002D62" },
    };
    cell.font = {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });

  // Filas de datos
  rows.forEach((row, idx) => {
    const dataRow = worksheet.addRow(row);
    dataRow.height = 22;
    dataRow.eachCell((cell) => {
      cell.font = { name: "Segoe UI", size: 10 };
      cell.alignment = { vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (idx % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" }, // Cebra suave
        };
      }
    });
  });

  // Ajuste automático de ancho de columnas
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const valStr = cell.value !== null && cell.value !== undefined ? cell.value.toString() : "";
      if (valStr.length > maxLength) maxLength = valStr.length;
    });
    column.width = Math.max(maxLength + 4, 14);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export class ExportService {
  /**
   * Exporta el catálogo de Departamentos Universitarios
   */
  static async exportDepartamentos(format: SupportedFormat): Promise<ExportResult> {
    const departamentos = await prisma.departamento.findMany({
      orderBy: { codigo: "asc" },
      include: {
        responsable: {
          select: {
            nombre: true,
            apellido: true,
            correo: true,
            cargo: true,
          },
        },
        _count: {
          select: {
            empleados: true,
          },
        },
      },
    });

    const columns: ExportColumnDefinition[] = [
      { header: "Código", key: "codigo", width: 14 },
      { header: "Descripción", key: "descripcion", width: 35 },
      { header: "Responsable Directivo", key: "responsable", width: 30 },
      { header: "Correo Responsable", key: "correoResponsable", width: 30 },
      { header: "Total Empleados", key: "totalEmpleados", width: 18 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Fecha Registro", key: "fechaRegistro", width: 18 },
    ];

    const rows = departamentos.map((d) => ({
      codigo: d.codigo,
      descripcion: d.descripcion,
      responsable: d.responsable
        ? `${d.responsable.nombre} ${d.responsable.apellido}`
        : "Sin Asignar",
      correoResponsable: d.responsable?.correo || "N/A",
      totalEmpleados: d._count.empleados,
      estado: d.estado,
      fechaRegistro: d.createdAt.toISOString().split("T")[0],
    }));

    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      const headers = columns.map((c) => c.header);
      const csvData = rows.map((r) => [
        r.codigo,
        r.descripcion,
        r.responsable,
        r.correoResponsable,
        r.totalEmpleados,
        r.estado,
        r.fechaRegistro,
      ]);
      return {
        data: generateCsvString(headers, csvData),
        filename: `departamentos_unapec_${dateStr}.csv`,
        contentType: "text/csv; charset=utf-8",
      };
    }

    const excelBuffer = await generateExcelBuffer("Departamentos", columns, rows);
    return {
      data: excelBuffer,
      filename: `departamentos_unapec_${dateStr}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  /**
   * Exporta el catálogo de Tipos de Activos (DGII y Línea Recta)
   */
  static async exportTiposActivos(format: SupportedFormat): Promise<ExportResult> {
    const tipos = await prisma.tipoActivo.findMany({
      orderBy: { codigo: "asc" },
    });

    const columns: ExportColumnDefinition[] = [
      { header: "Código", key: "codigo", width: 14 },
      { header: "Descripción", key: "descripcion", width: 38 },
      { header: "Cuenta Compra", key: "cuentaCompra", width: 20 },
      { header: "Cuenta Depreciación", key: "cuentaDepreciacion", width: 22 },
      { header: "Método Depreciación", key: "metodo", width: 22 },
      { header: "% Depreciación Anual", key: "porcentaje", width: 22 },
      { header: "Vida Útil (Meses)", key: "vidaUtil", width: 18 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Fecha Registro", key: "fechaRegistro", width: 18 },
    ];

    const rows = tipos.map((t) => ({
      codigo: t.codigo,
      descripcion: t.descripcion,
      cuentaCompra: t.cuentaContableCompra,
      cuentaDepreciacion: t.cuentaContableDepreciacion,
      metodo: t.metodoDepreciacion,
      porcentaje: `${Number(t.porcentajeDepreciacionAnual).toFixed(2)}%`,
      vidaUtil: t.vidaUtilMeses,
      estado: t.estado,
      fechaRegistro: t.createdAt.toISOString().split("T")[0],
    }));

    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      const headers = columns.map((c) => c.header);
      const csvData = rows.map((r) => [
        r.codigo,
        r.descripcion,
        r.cuentaCompra,
        r.cuentaDepreciacion,
        r.metodo,
        r.porcentaje,
        r.vidaUtil,
        r.estado,
        r.fechaRegistro,
      ]);
      return {
        data: generateCsvString(headers, csvData),
        filename: `tipos_activos_unapec_${dateStr}.csv`,
        contentType: "text/csv; charset=utf-8",
      };
    }

    const excelBuffer = await generateExcelBuffer("Tipos de Activos", columns, rows);
    return {
      data: excelBuffer,
      filename: `tipos_activos_unapec_${dateStr}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  /**
   * Exporta el catálogo de Empleados Custodios
   */
  static async exportEmpleados(format: SupportedFormat): Promise<ExportResult> {
    const empleados = await prisma.empleado.findMany({
      orderBy: { codigo: "asc" },
      include: {
        departamento: {
          select: {
            codigo: true,
            descripcion: true,
          },
        },
        departamentosResponsable: {
          select: {
            codigo: true,
          },
        },
      },
    });

    const columns: ExportColumnDefinition[] = [
      { header: "Código", key: "codigo", width: 14 },
      { header: "Nombre", key: "nombre", width: 20 },
      { header: "Apellido", key: "apellido", width: 20 },
      { header: "Tipo Persona", key: "tipoPersona", width: 16 },
      { header: "Cédula / Documento", key: "cedula", width: 20 },
      { header: "Departamento", key: "departamento", width: 35 },
      { header: "Cargo", key: "cargo", width: 30 },
      { header: "Correo Institucional", key: "correo", width: 32 },
      { header: "Teléfono", key: "telefono", width: 18 },
      { header: "Fecha Ingreso", key: "fechaIngreso", width: 16 },
      { header: "Estado", key: "estado", width: 14 },
      { header: "Responsable Dpto", key: "esResponsable", width: 20 },
    ];

    const rows = empleados.map((e) => {
      const respDepto =
        e.departamentosResponsable.length > 0
          ? `Sí (${e.departamentosResponsable.map((d) => d.codigo).join(", ")})`
          : "No";

      return {
        codigo: e.codigo,
        nombre: e.nombre,
        apellido: e.apellido,
        tipoPersona: e.tipoPersona,
        cedula: formatearCedula(e.cedula),
        departamento: e.departamento.descripcion,
        cargo: e.cargo,
        correo: e.correo || "N/A",
        telefono: e.telefono || "N/A",
        fechaIngreso: e.fechaIngreso.toISOString().split("T")[0],
        estado: e.estado,
        esResponsable: respDepto,
      };
    });

    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      const headers = columns.map((c) => c.header);
      const csvData = rows.map((r) => [
        r.codigo,
        r.nombre,
        r.apellido,
        r.tipoPersona,
        r.cedula,
        r.departamento,
        r.cargo,
        r.correo,
        r.telefono,
        r.fechaIngreso,
        r.estado,
        r.esResponsable,
      ]);
      return {
        data: generateCsvString(headers, csvData),
        filename: `empleados_custodios_unapec_${dateStr}.csv`,
        contentType: "text/csv; charset=utf-8",
      };
    }

    const excelBuffer = await generateExcelBuffer("Empleados Custodios", columns, rows);
    return {
      data: excelBuffer,
      filename: `empleados_custodios_unapec_${dateStr}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  /**
   * Enrutador central de exportación
   */
  static async exportCatalog(
    catalogo: SupportedCatalog,
    format: SupportedFormat
  ): Promise<ExportResult> {
    switch (catalogo) {
      case "departamentos":
        return this.exportDepartamentos(format);
      case "tipos-activos":
        return this.exportTiposActivos(format);
      case "empleados":
        return this.exportEmpleados(format);
      default:
        throw new Error(`Catálogo no soportado: ${catalogo}`);
    }
  }
}

// ============================================================================
// SUB-MÓDULO 04 — Exportación de REPORTES (inventario y depreciación)
// Encabezado institucional único (azul UNAPEC #002D62, mismo token que los
// exports de Sub-01), columnas financieras con formato RD$ #,##0.00,
// autoFilter en cabecera y fila final de totales (Half-Up, 2 decimales).
// ============================================================================

export interface ReportColumn {
  header: string;
  key: string;
  width?: number;
  /** true → celda numérica con numFmt '"RD$"#,##0.00' y alineación derecha. */
  money?: boolean;
  align?: "left" | "center" | "right";
}

export interface ReportExportPayload {
  sheetName: string;
  /** Título institucional que ocupa la fila 1 (merged). */
  title: string;
  /** Subtítulo/línea de filtros aplicados que ocupa la fila 2. */
  subtitle?: string;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  /** Valores de totales por key de columna (mismo cálculo que los KPIs). */
  totals?: Record<string, string | number>;
  /** Cuando la exportación fue truncada al tope de MAX_EXPORT_ROWS. */
  truncated?: boolean;
  maxRows?: number;
}

const REPORT_HEADER_FILL = "FF002D62";
const REPORT_HEADER_ALTERNATE = "FFF2F6FC";
const REPORT_BORDER = "FFCBD5E1";
const MONEY_NUM_FMT = '"RD$"#,##0.00';

function halfUp(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? halfUp(parsed) : 0;
}

/**
 * Compila un XLSX de reporte con presentación institucional, formato de
 * moneda dominicana, autoFilter y fila final de totales.
 */
export async function buildReportXlsx(payload: ReportExportPayload): Promise<Buffer> {
  const { sheetName, title, subtitle, columns, rows, totals, truncated } = payload;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ActivaCore — Universidad APEC";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 18,
  }));

  const headerRowNumber = subtitle ? 3 : 2;

  // Fila 1 — Título institucional (merged, fondo azul UNAPEC)
  worksheet.mergeCells(1, 1, 1, Math.max(columns.length, 1));
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: "Segoe UI", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_HEADER_FILL } };
  worksheet.getRow(1).height = 30;

  // Fila 2 — Subtítulo (filtros aplicados / usuario emisor)
  if (subtitle) {
    worksheet.mergeCells(2, 1, 2, Math.max(columns.length, 1));
    const subtitleCell = worksheet.getCell(2, 1);
    subtitleCell.value = subtitle;
    subtitleCell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF505F76" } };
    subtitleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_HEADER_ALTERNATE } };
    worksheet.getRow(2).height = 20;
  }

  // Fila de encabezados
  const headerRow = worksheet.getRow(headerRowNumber);
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.header;
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_HEADER_FILL } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: REPORT_BORDER } },
      left: { style: "thin", color: { argb: REPORT_BORDER } },
      bottom: { style: "medium", color: { argb: REPORT_HEADER_FILL } },
      right: { style: "thin", color: { argb: REPORT_BORDER } },
    };
  });
  headerRow.height = 26;
  headerRow.commit();

  // autoFilter sobre la fila de encabezado (rango completo de columnas)
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: columns.length },
  };

  // Filas de datos
  rows.forEach((row, idx) => {
    const excelRow = worksheet.addRow(row);
    excelRow.height = 20;
    columns.forEach((col, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      cell.font = { name: "Segoe UI", size: 9 };
      cell.alignment = {
        vertical: "middle",
        horizontal: col.money ? "right" : col.align ?? "left",
      };
      if (col.money) {
        cell.value = toNumber(cell.value as any);
        cell.numFmt = MONEY_NUM_FMT;
      }
      cell.border = {
        top: { style: "thin", color: { argb: REPORT_BORDER } },
        left: { style: "thin", color: { argb: REPORT_BORDER } },
        bottom: { style: "thin", color: { argb: REPORT_BORDER } },
        right: { style: "thin", color: { argb: REPORT_BORDER } },
      };
      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: REPORT_HEADER_ALTERNATE } };
      }
    });
    excelRow.commit();
  });

  // Fila final de totales
  if (totals && Object.keys(totals).length > 0) {
    const totalRowValues: Record<string, any> = {};
    columns.forEach((col, index) => {
      if (index === 0) {
        totalRowValues[col.key] = "TOTALES";
      } else if (totals[col.key] !== undefined) {
        totalRowValues[col.key] = toNumber(totals[col.key]);
      } else {
        totalRowValues[col.key] = null;
      }
    });

    const totalRow = worksheet.addRow(totalRowValues);
    totalRow.height = 24;
    columns.forEach((col, colIndex) => {
      const cell = totalRow.getCell(colIndex + 1);
      cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF1B2A4A" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F5" } };
      cell.alignment = { vertical: "middle", horizontal: col.money ? "right" : "left" };
      if (col.money && totals[col.key] !== undefined) {
        cell.value = toNumber(totals[col.key]);
        cell.numFmt = MONEY_NUM_FMT;
      }
      cell.border = {
        top: { style: "medium", color: { argb: REPORT_HEADER_FILL } },
        left: { style: "thin", color: { argb: REPORT_BORDER } },
        bottom: { style: "medium", color: { argb: REPORT_HEADER_FILL } },
        right: { style: "thin", color: { argb: REPORT_BORDER } },
      };
    });
    totalRow.commit();
  }

  // Pie de truncamiento (si aplica)
  if (truncated) {
    const footerRow = worksheet.addRow([
      `AVISO: exportación truncada al tope operativo de ${payload.maxRows ?? 10000} filas. Refine los filtros para exportar el resto.`,
    ]);
    worksheet.mergeCells(footerRow.number, 1, footerRow.number, Math.max(columns.length, 1));
    footerRow.getCell(1).font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF93000A" } };
  }

  // Ancho automático basado en contenido
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const valStr = cell.value !== null && cell.value !== undefined ? cell.value.toString() : "";
      if (valStr.length > maxLength) maxLength = valStr.length;
    });
    column.width = Math.max(maxLength + 4, column.width || 14);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Compila el CSV de reporte con BOM UTF-8, delimitador coma y footer de
 * truncamiento condicional. Reutiliza el escapado anti-mojibake existente.
 */
export function buildReportCsv(payload: ReportExportPayload): string {
  const headers = payload.columns.map((col) => col.header);
  const rows = payload.rows.map((row) =>
    payload.columns.map((col) => {
      const value = row[col.key];
      return col.money ? toNumber(value).toFixed(2) : value ?? "";
    })
  );

  let csv = generateCsvString(headers, rows);

  if (payload.totals && Object.keys(payload.totals).length > 0) {
    csv += payload.columns
      .map((col, index) => {
        if (index === 0) return escapeCsvValue("TOTALES");
        const value = payload.totals?.[col.key];
        if (value === undefined) return "";
        return escapeCsvValue(col.money ? toNumber(value).toFixed(2) : value);
      })
      .join(",");
    csv += "\r\n";
  }

  if (payload.truncated) {
    csv += `\r\n${escapeCsvValue(`AVISO: exportación truncada al tope operativo de ${payload.maxRows ?? 10000} filas.`)}\r\n`;
  }

  return csv;
}

// ---------------------------------------------------------------------------
// Columnas canónicas de los reportes del Sub-04
// ---------------------------------------------------------------------------

export const INVENTARIO_REPORT_COLUMNS: ReportColumn[] = [
  { header: "Código", key: "codigo", width: 16 },
  { header: "Descripción", key: "descripcion", width: 38 },
  { header: "Tipo de Activo", key: "tipoActivo", width: 24 },
  { header: "Departamento", key: "departamento", width: 24 },
  { header: "Custodio", key: "custodio", width: 26 },
  { header: "Estado", key: "estado", width: 18 },
  { header: "Fecha Adquisición", key: "fechaAdquisicion", width: 16, align: "center" },
  { header: "Costo Adquisición", key: "costoAdquisicion", width: 20, money: true },
  { header: "Depreciación Acumulada", key: "depreciacionAcumulada", width: 22, money: true },
  { header: "Valor en Libros", key: "valorEnLibros", width: 20, money: true },
];

export const DEPRECIACION_REPORT_COLUMNS: ReportColumn[] = [
  { header: "Código", key: "codigo", width: 16 },
  { header: "Descripción", key: "descripcion", width: 38 },
  { header: "Vida Útil (meses)", key: "vidaUtilMeses", width: 16, align: "center" },
  { header: "Costo Original", key: "costoOriginal", width: 20, money: true },
  { header: "Cuota del Mes", key: "cuotaMes", width: 18, money: true },
  { header: "Depreciación Acumulada", key: "depreciacionAcumulada", width: 22, money: true },
  { header: "Valor en Libros", key: "valorEnLibros", width: 20, money: true },
  { header: "Cuenta Compra", key: "cuentaCompra", width: 18, align: "center" },
  { header: "Cuenta Depreciación", key: "cuentaDepreciacion", width: 20, align: "center" },
];
