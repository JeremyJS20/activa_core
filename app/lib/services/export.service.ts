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
