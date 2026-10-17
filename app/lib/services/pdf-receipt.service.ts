import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { formatearCedula } from "@/lib/validators/identity";

export type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

export class PdfReceiptError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "PdfReceiptError";
    this.code = code;
    this.status = status;
  }
}

export interface GenerateActaPdfParams {
  activoId: string;
  movimientoId?: string;
}

export interface GenerateActaPdfResult {
  buffer: Buffer;
  filename: string;
}

/**
 * Genera el documento PDF oficial del Acta de Asignación y Responsabilidad de Custodia.
 * Diseñado en tamaño Carta con membrete institucional UNAPEC y bloques formales de firma.
 */
export async function generarActaEntregaPdf(
  params: GenerateActaPdfParams,
  client?: PrismaDbClient
): Promise<GenerateActaPdfResult> {
  const db = (client ?? defaultPrisma) as PrismaClient;

  // 1. Obtener activo con relaciones
  const activo = await db.activoFijo.findUnique({
    where: { id: params.activoId },
    include: {
      departamento: {
        select: { id: true, codigo: true, descripcion: true },
      },
      tipoActivo: {
        select: { id: true, codigo: true, descripcion: true },
      },
      empleado: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          apellido: true,
          cedula: true,
          cargo: true,
        },
      },
    },
  });

  if (!activo) {
    throw new PdfReceiptError(
      "ASSET_NOT_FOUND",
      404,
      "No se encontró el activo fijo institucional especificado."
    );
  }

  // 2. Obtener movimiento de custodia (si se especificó o el último registrado)
  let movimiento = null;
  if (params.movimientoId) {
    movimiento = await db.historialCustodia.findUnique({
      where: { id: params.movimientoId },
      include: {
        empleadoNuevo: true,
        departamentoNuevo: true,
        autorizadoPor: true,
      },
    });

    if (!movimiento || movimiento.activoId !== activo.id) {
      throw new PdfReceiptError(
        "TRANSFER_RECORD_NOT_FOUND",
        404,
        "El registro de movimiento de custodia especificado no existe para este activo."
      );
    }
  } else {
    movimiento = await db.historialCustodia.findFirst({
      where: { activoId: activo.id },
      orderBy: { createdAt: "desc" },
      include: {
        empleadoNuevo: true,
        departamentoNuevo: true,
        autorizadoPor: true,
      },
    });
  }

  // Datos de custodio y departamento asignados
  const custodio = movimiento?.empleadoNuevo ?? activo.empleado;
  const departamento = movimiento?.departamentoNuevo ?? activo.departamento;
  const autorizadorNombre = movimiento?.autorizadoPor?.nombre ?? "Dirección de Activos Fijos";
  const fechaMovimiento = movimiento?.createdAt ?? new Date();

  // 3. Crear documento PDF con pdf-lib (Letter: 612 x 792 pt)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Paleta de colores institucionales UNAPEC
  const colorNavy = rgb(0 / 255, 45 / 255, 98 / 255); // #002D62
  const colorGold = rgb(234 / 255, 170 / 255, 0 / 255); // #EAAA00
  const colorDark = rgb(30 / 255, 41 / 255, 59 / 255); // #1E293B
  const colorMuted = rgb(100 / 255, 116 / 255, 139 / 255); // #64748B
  const colorBgBox = rgb(248 / 255, 250 / 255, 252 / 255); // #F8FAFC
  const colorBorder = rgb(226 / 255, 232 / 255, 240 / 255); // #E2E8F0

  const marginX = 40;
  const contentWidth = 612 - marginX * 2;

  // Barra decorativa superior (Navy + Gold)
  page.drawRectangle({
    x: marginX,
    y: 755,
    width: contentWidth,
    height: 4,
    color: colorNavy,
  });
  page.drawRectangle({
    x: marginX,
    y: 751,
    width: 120,
    height: 4,
    color: colorGold,
  });

  // Encabezado institucional
  page.drawText("UNIVERSIDAD APEC — UNAPEC", {
    x: marginX,
    y: 730,
    size: 14,
    font: fontBold,
    color: colorNavy,
  });
  page.drawText("DIRECCIÓN DE GESTIÓN Y CONTROL DE ACTIVOS FIJOS", {
    x: marginX,
    y: 715,
    size: 10,
    font: fontRegular,
    color: colorMuted,
  });
  page.drawText("ACTA DE ASIGNACIÓN Y RESPONSABILIDAD DE CUSTODIA", {
    x: marginX,
    y: 695,
    size: 12,
    font: fontBold,
    color: colorNavy,
  });

  // Metadatos del acta (No. y Fecha)
  const numActa = `ACTA-${activo.codigo}-${fechaMovimiento.getFullYear()}`;
  const fechaStr = fechaMovimiento.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  page.drawText(`Expediente No.: ${numActa}`, {
    x: marginX,
    y: 675,
    size: 9,
    font: fontBold,
    color: colorDark,
  });
  page.drawText(`Fecha de Asignación: ${fechaStr}`, {
    x: 380,
    y: 675,
    size: 9,
    font: fontRegular,
    color: colorDark,
  });

  // Línea divisoria suave
  page.drawLine({
    start: { x: marginX, y: 665 },
    end: { x: marginX + contentWidth, y: 665 },
    thickness: 1,
    color: colorBorder,
  });

  // --- SECCIÓN 1: DATOS DEL ACTIVO INSTITUCIONAL ---
  page.drawText("1. ESPECIFICACIONES TÉCNICAS DEL ACTIVO", {
    x: marginX,
    y: 645,
    size: 10,
    font: fontBold,
    color: colorNavy,
  });

  page.drawRectangle({
    x: marginX,
    y: 520,
    width: contentWidth,
    height: 115,
    color: colorBgBox,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  const rowActivoY = [618, 600, 582, 564, 546, 528];
  const col1X = marginX + 12;
  const col2X = marginX + 280;

  page.drawText(`Código Institucional:`, { x: col1X, y: rowActivoY[0], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${activo.codigo}`, { x: col1X + 105, y: rowActivoY[0], size: 9, font: fontRegular, color: colorNavy });

  page.drawText(`Categoría DGII:`, { x: col2X, y: rowActivoY[0], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${activo.tipoActivo.codigo} - ${activo.tipoActivo.descripcion}`, { x: col2X + 85, y: rowActivoY[0], size: 9, font: fontRegular, color: colorDark });

  page.drawText(`Descripción:`, { x: col1X, y: rowActivoY[1], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${activo.descripcion.substring(0, 75)}`, { x: col1X + 68, y: rowActivoY[1], size: 9, font: fontRegular, color: colorDark });

  page.drawText(`Marca:`, { x: col1X, y: rowActivoY[2], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${activo.marca || "N/A"}`, { x: col1X + 42, y: rowActivoY[2], size: 9, font: fontRegular, color: colorDark });

  page.drawText(`Modelo:`, { x: col1X + 140, y: rowActivoY[2], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${activo.modelo || "N/A"}`, { x: col1X + 185, y: rowActivoY[2], size: 9, font: fontRegular, color: colorDark });

  page.drawText(`No. de Serie:`, { x: col2X, y: rowActivoY[2], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${activo.numeroSerie || "N/A"}`, { x: col2X + 70, y: rowActivoY[2], size: 9, font: fontRegular, color: colorDark });

  page.drawText(`Ubicación Física:`, { x: col1X, y: rowActivoY[3], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${activo.ubicacionFisica || "Campus Principal UNAPEC"}`, { x: col1X + 85, y: rowActivoY[3], size: 9, font: fontRegular, color: colorDark });

  page.drawText(`Estado Físico:`, { x: col2X, y: rowActivoY[3], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${activo.estado}`, { x: col2X + 70, y: rowActivoY[3], size: 9, font: fontRegular, color: colorDark });

  const costoFmt = Number(activo.costoAdquisicion).toLocaleString("es-DO", { style: "currency", currency: "DOP" });
  page.drawText(`Valor de Adquisición:`, { x: col1X, y: rowActivoY[4], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${costoFmt}`, { x: col1X + 105, y: rowActivoY[4], size: 9, font: fontRegular, color: colorDark });

  // --- SECCIÓN 2: DATOS DEL CUSTODIO RESPONSABLE ---
  page.drawText("2. CUSTODIO ASIGNADO Y RADICACIÓN ORGANIZACIONAL", {
    x: marginX,
    y: 500,
    size: 10,
    font: fontBold,
    color: colorNavy,
  });

  page.drawRectangle({
    x: marginX,
    y: 405,
    width: contentWidth,
    height: 85,
    color: colorBgBox,
    borderColor: colorBorder,
    borderWidth: 1,
  });

  const rowCustodioY = [475, 455, 435, 415];
  const nombreCompleto = `${custodio.nombre} ${custodio.apellido}`;
  const cedulaFormateada = formatearCedula(custodio.cedula);

  page.drawText(`Nombre del Custodio:`, { x: col1X, y: rowCustodioY[0], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${nombreCompleto}`, { x: col1X + 115, y: rowCustodioY[0], size: 9, font: fontRegular, color: colorDark });

  page.drawText(`Cédula de Identidad:`, { x: col2X, y: rowCustodioY[0], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${cedulaFormateada}`, { x: col2X + 110, y: rowCustodioY[0], size: 9, font: fontRegular, color: colorNavy });

  page.drawText(`Código Empleado:`, { x: col1X, y: rowCustodioY[1], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${custodio.codigo}`, { x: col1X + 95, y: rowCustodioY[1], size: 9, font: fontRegular, color: colorDark });

  page.drawText(`Cargo:`, { x: col2X, y: rowCustodioY[1], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${custodio.cargo || "Colaborador"}`, { x: col2X + 40, y: rowCustodioY[1], size: 9, font: fontRegular, color: colorDark });

  page.drawText(`Departamento:`, { x: col1X, y: rowCustodioY[2], size: 9, font: fontBold, color: colorDark });
  page.drawText(`${departamento.codigo} — ${departamento.descripcion}`, { x: col1X + 78, y: rowCustodioY[2], size: 9, font: fontRegular, color: colorDark });

  // --- SECCIÓN 3: CLÁUSULA DE RESPONSABILIDAD ---
  page.drawText("3. DECLARACIÓN FORMAL DE CUSTODIA Y RESPONSABILIDAD", {
    x: marginX,
    y: 385,
    size: 10,
    font: fontBold,
    color: colorNavy,
  });

  const clausulaLines = [
    "Por medio de la presente acta, el custodio declara haber recibido a entera satisfacción el bien institucional",
    "precedentemente descrito en condiciones óptimas para el ejercicio de sus funciones. El custodio asume formalmente",
    "la obligación de velar por su integridad, guarda, uso debido y permanencia en la institución, conforme a los",
    "reglamentos internos de la Universidad APEC y la normativa fiscal vigente de la República Dominicana.",
    "Queda expresamente prohibido el traslado, cesión a terceros o alteración del bien sin autorización de Activos Fijos."
  ];

  let clausulaY = 368;
  for (const line of clausulaLines) {
    page.drawText(line, {
      x: marginX,
      y: clausulaY,
      size: 8.5,
      font: fontOblique,
      color: colorDark,
    });
    clausulaY -= 14;
  }

  // --- SECCIÓN 4: BLOQUES DE FIRMAS ---
  const firmaY = 160;
  const lineaFirmaAncho = 200;

  // Firma Custodio Receptor
  page.drawLine({
    start: { x: marginX + 20, y: firmaY },
    end: { x: marginX + 20 + lineaFirmaAncho, y: firmaY },
    thickness: 1,
    color: colorDark,
  });
  page.drawText("ENTREGADO A (CUSTODIO RECEPTOR)", {
    x: marginX + 25,
    y: firmaY - 14,
    size: 8,
    font: fontBold,
    color: colorNavy,
  });
  page.drawText(`${nombreCompleto}`, {
    x: marginX + 25,
    y: firmaY - 26,
    size: 8,
    font: fontRegular,
    color: colorDark,
  });
  page.drawText(`Cédula: ${cedulaFormateada}`, {
    x: marginX + 25,
    y: firmaY - 38,
    size: 8,
    font: fontRegular,
    color: colorMuted,
  });

  // Firma Entrega / Auditor
  const firmaCol2X = marginX + contentWidth - lineaFirmaAncho - 20;
  page.drawLine({
    start: { x: firmaCol2X, y: firmaY },
    end: { x: firmaCol2X + lineaFirmaAncho, y: firmaY },
    thickness: 1,
    color: colorDark,
  });
  page.drawText("AUTORIZADO POR (DIRECCIÓN DE ACTIVOS)", {
    x: firmaCol2X + 10,
    y: firmaY - 14,
    size: 8,
    font: fontBold,
    color: colorNavy,
  });
  page.drawText(`${autorizadorNombre}`, {
    x: firmaCol2X + 10,
    y: firmaY - 26,
    size: 8,
    font: fontRegular,
    color: colorDark,
  });
  page.drawText("Auditoría y Control de Inventarios", {
    x: firmaCol2X + 10,
    y: firmaY - 38,
    size: 8,
    font: fontRegular,
    color: colorMuted,
  });

  // Pie de página institucional
  page.drawLine({
    start: { x: marginX, y: 65 },
    end: { x: marginX + contentWidth, y: 65 },
    thickness: 0.5,
    color: colorBorder,
  });
  page.drawText("Documento oficial generado digitalmente por el Sistema de Gestión de Activos Fijos — ActivaCore UNAPEC.", {
    x: marginX,
    y: 50,
    size: 7.5,
    font: fontRegular,
    color: colorMuted,
  });
  page.drawText(`Impreso: ${new Date().toLocaleString("es-DO")} | Página 1 de 1`, {
    x: marginX,
    y: 40,
    size: 7.5,
    font: fontRegular,
    color: colorMuted,
  });

  // Guardar documento como Buffer
  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const filename = `Acta-Custodia-${activo.codigo}.pdf`;

  return { buffer, filename };
}
