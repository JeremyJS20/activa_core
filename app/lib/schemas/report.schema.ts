import { z } from "zod";
import { validarCuentaContable } from "@/lib/validators/accounting";

/**
 * Schemas de consulta del Sub-módulo 04 (Reportes).
 * Todos los parámetros llegan como querystring (siempre strings) y se
 * normalizan con z.coerce. La validación es DUAL: cliente (UX) y servidor
 * (route handler), sin confiar nunca en el querystring.
 */

// ---------------------------------------------------------------------------
// Primitivas compartidas
// ---------------------------------------------------------------------------

/** Fecha ISO corta `YYYY-MM-DD` (la que usa el input type=date). */
export const IsoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "La fecha debe tener formato YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "La fecha no existe en el calendario (ej: 2026-02-31 es inválida)");

/** Monto monetario recibido como string decimal (hasta 14 enteros y 2 decimales). */
export const MoneyStringSchema = z
  .string()
  .trim()
  .regex(/^\d{1,14}(\.\d{1,2})?$/, "El monto debe ser un número positivo con hasta 2 decimales");

/** Período fiscal `YYYY-MM`. */
export const PeriodoFiscalSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El período fiscal debe tener formato YYYY-MM (ej: 2026-10)");

/** Cuenta contable auxiliar UNAPEC: X-XX-XX-XXXX. */
export const CuentaContableSchema = z
  .string()
  .trim()
  .refine((value) => validarCuentaContable(value), "La cuenta contable debe cumplir el formato X-XX-XX-XXXX");

/** Campos ordenables del inventario (whitelist cerrada — rechaza cualquier otro). */
export const SortFieldSchema = z.enum(["codigo", "descripcion", "costo", "fecha"], {
  message: "El campo de ordenamiento debe ser codigo, descripcion, costo o fecha",
});

export const SortDirSchema = z.enum(["asc", "desc"], {
  message: "La dirección de ordenamiento debe ser asc o desc",
});

export const PageSizeSchema = z.coerce
  .number()
  .int("El tamaño de página debe ser un entero")
  .refine((value) => [10, 25, 50].includes(value), "El tamaño de página debe ser 10, 25 o 50");

export const PageSchema = z.coerce
  .number()
  .int("La página debe ser un entero")
  .min(1, "La página debe ser mayor o igual a 1")
  .default(1);

/** Estados operativos de la Ficha (la BD real de Sub-02 no impone CHECK). */
export const EstadoActivoReporteSchema = z.enum(["ACTIVO", "EN_MANTENIMIENTO", "DADO_DE_BAJA"], {
  message: "El estado debe ser ACTIVO, EN_MANTENIMIENTO o DADO_DE_BAJA",
});

/** Acepta `estados=ACTIVO,EN_MANTENIMIENTO` o múltiples valores repetidos en la URL. */
export function parseEstadosParam(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  const values = Array.isArray(raw) ? raw : [raw];
  const limpios = values
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
  return limpios.length > 0 ? limpios : undefined;
}

// ---------------------------------------------------------------------------
// REQ-REP-001 / REQ-REP-003 — Consulta multicriterio de inventario
// ---------------------------------------------------------------------------

export const InventarioQuerySchema = z
  .object({
    fechaInicio: IsoDateSchema.optional(),
    fechaFin: IsoDateSchema.optional(),
    montoMin: MoneyStringSchema.optional(),
    montoMax: MoneyStringSchema.optional(),
    departamentoId: z.string().uuid("El departamento debe ser un identificador válido").optional(),
    tipoActivoId: z.string().uuid("El tipo de activo debe ser un identificador válido").optional(),
    custodio: z
      .string()
      .trim()
      .max(150, "El término de búsqueda de custodio no puede exceder 150 caracteres")
      .optional(),
    estados: z.array(EstadoActivoReporteSchema).min(1, "Debe seleccionar al menos un estado").optional(),
    search: z
      .string()
      .trim()
      .max(150, "El término de búsqueda no puede exceder 150 caracteres")
      .optional(),
    sort: SortFieldSchema.default("codigo"),
    dir: SortDirSchema.default("asc"),
    page: PageSchema,
    pageSize: PageSizeSchema.default(25),
  })
  .superRefine((query, ctx) => {
    // Rangos cerrados inclusivos, pero invertidos son inválidos.
    if (query.fechaInicio && query.fechaFin && query.fechaFin < query.fechaInicio) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaFin"],
        message: "La fecha final no puede ser anterior a la fecha inicial",
      });
    }

    if (query.montoMin && query.montoMax) {
      const min = Number(query.montoMin);
      const max = Number(query.montoMax);

      // Comparación con centavos exactos para no depender de float.
      if (Math.round(max * 100) < Math.round(min * 100)) {
        ctx.addIssue({
          code: "custom",
          path: ["montoMax"],
          message: "El monto máximo no puede ser menor al monto mínimo",
        });
      }
    }
  });

// ---------------------------------------------------------------------------
// REQ-REP-004 — Reporte de depreciación periódica y fiscal
// ---------------------------------------------------------------------------

export const DepreciacionQuerySchema = z.object({
  periodo: PeriodoFiscalSchema,
  cuentaCompra: CuentaContableSchema.optional(),
  cuentaDepreciacion: CuentaContableSchema.optional(),
  page: PageSchema,
  pageSize: PageSizeSchema.default(25),
});

// ---------------------------------------------------------------------------
// REQ-REP-005 — Kardex del activo
// ---------------------------------------------------------------------------

export const KardexParamsSchema = z.object({
  id: z.string().uuid("El identificador del activo debe ser un UUID válido"),
});

// ---------------------------------------------------------------------------
// REQ-REP-006 / REQ-REP-007 — Exportación tabular
// ---------------------------------------------------------------------------

export const ReporteExportableSchema = z.enum(["inventario", "depreciacion"], {
  message: "El reporte a exportar debe ser inventario o depreciacion",
});

export const FormatoExportSchema = z.enum(["xlsx", "csv"], {
  message: "El formato de exportación debe ser xlsx o csv",
});

/** Tope operativo de filas por archivo (REQ-REP-007 / design.md). */
export const MAX_EXPORT_ROWS = 10_000;

export const ExportQuerySchema = z.object({
  reporte: ReporteExportableSchema,
  formato: FormatoExportSchema,
  precheck: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  // Filtros del reporte origen (se validan según el reporte en el handler).
  fechaInicio: IsoDateSchema.optional(),
  fechaFin: IsoDateSchema.optional(),
  montoMin: MoneyStringSchema.optional(),
  montoMax: MoneyStringSchema.optional(),
  departamentoId: z.string().uuid("El departamento debe ser un identificador válido").optional(),
  tipoActivoId: z.string().uuid("El tipo de activo debe ser un identificador válido").optional(),
  custodio: z.string().trim().max(150).optional(),
  search: z.string().trim().max(150).optional(),
  sort: SortFieldSchema.default("codigo"),
  dir: SortDirSchema.default("asc"),
  periodo: PeriodoFiscalSchema.optional(),
  cuentaCompra: CuentaContableSchema.optional(),
  cuentaDepreciacion: CuentaContableSchema.optional(),
  estados: z.array(EstadoActivoReporteSchema).min(1).optional(),
});

// ---------------------------------------------------------------------------
// Tipos inferidos
// ---------------------------------------------------------------------------

export type InventarioQuery = z.infer<typeof InventarioQuerySchema>;
export type DepreciacionQuery = z.infer<typeof DepreciacionQuerySchema>;
export type KardexParams = z.infer<typeof KardexParamsSchema>;
export type ExportQuery = z.infer<typeof ExportQuerySchema>;
export type SortField = z.infer<typeof SortFieldSchema>;
export type SortDir = z.infer<typeof SortDirSchema>;
export type ReporteExportable = z.infer<typeof ReporteExportableSchema>;
export type FormatoExport = z.infer<typeof FormatoExportSchema>;
export type EstadoActivoReporte = z.infer<typeof EstadoActivoReporteSchema>;
