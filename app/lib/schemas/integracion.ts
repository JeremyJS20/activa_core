import { z } from "zod";
import { ACCOUNT_CODE_REGEX } from "@/lib/validators/accounting";

/**
 * Contratos Zod del Sub-módulo 05.
 * - Payload saliente hacia el WS (8 datos obligatorios de la Ficha).
 * - Respuestas del WS (éxito / error).
 * - Query params de la consola y del despacho en lote.
 */

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

/** Monto monetario del wire: string decimal con exactamente 2 posiciones. */
export const MontoPayloadSchema = z
  .string()
  .trim()
  .regex(/^\d{1,14}\.\d{2}$/, "El monto debe ser un string decimal con exactamente 2 posiciones (ej: 47812.50)");

/** Cuenta contable auxiliar UNAPEC: X-XX-XX-XXXX. */
export const CuentaPayloadSchema = z
  .string()
  .trim()
  .regex(ACCOUNT_CODE_REGEX, "La cuenta contable debe cumplir el formato X-XX-XX-XXXX");

/** Fecha contable `YYYY-MM-DD` con validación de calendario. */
export const FechaPayloadSchema = z
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
  }, "La fecha no existe en el calendario");

/** Período fiscal `YYYY-MM`. */
export const PeriodoIntegracionSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El período debe tener formato YYYY-MM (ej: 2026-10)");

const NUMERO_ASIENTO_REGEX = /^DEP-\d{6}-\d{3}$/;

// ---------------------------------------------------------------------------
// Payload hacia el Web Service
// ---------------------------------------------------------------------------

export const AsientoLineaPayloadSchema = z.object({
  tipoInventario: z.string().trim().min(1).max(10),
  cuentaContable: CuentaPayloadSchema,
  tipoMovimiento: z.enum(["DB", "CR"]),
  monto: MontoPayloadSchema,
  descripcion: z.string().trim().min(1).max(150),
});

function aCentavos(monto: string): string {
  const [enteros, decimales] = monto.split(".");
  return `${enteros}${decimales}`;
}

function sumarCentavos(a: string, b: string): string {
  let i = a.length - 1;
  let j = b.length - 1;
  let acarreo = 0;
  let salida = "";
  while (i >= 0 || j >= 0 || acarreo > 0) {
    const da = i >= 0 ? Number(a[i]) : 0;
    const db = j >= 0 ? Number(b[j]) : 0;
    const suma = da + db + acarreo;
    salida = `${suma % 10}${salida}`;
    acarreo = Math.floor(suma / 10);
    i -= 1;
    j -= 1;
  }
  return salida;
}

function normalizarCentavos(valor: string): string {
  const limpio = valor.replace(/^0+/, "");
  return limpio === "" ? "0" : limpio;
}

function sumarMontos(montos: string[]): string {
  return normalizarCentavos(montos.reduce((acc, monto) => sumarCentavos(acc, aCentavos(monto)), "0"));
}

export const AsientoPayloadSchema = z
  .object({
    numeroAsiento: z
      .string()
      .trim()
      .regex(NUMERO_ASIENTO_REGEX, "El número de asiento debe cumplir DEP-YYYYMM-NNN"),
    concepto: z.string().trim().min(1).max(150),
    fechaAsiento: FechaPayloadSchema,
    estado: z.literal("PENDIENTE_ENVIO"),
    lineas: z.array(AsientoLineaPayloadSchema).min(1, "El asiento debe tener al menos una línea"),
    totalDebito: MontoPayloadSchema,
    totalCredito: MontoPayloadSchema,
  })
  .superRefine((payload, ctx) => {
    const debitos = sumarMontos(
      payload.lineas.filter((linea) => linea.tipoMovimiento === "DB").map((linea) => linea.monto)
    );
    const creditos = sumarMontos(
      payload.lineas.filter((linea) => linea.tipoMovimiento === "CR").map((linea) => linea.monto)
    );

    if (debitos !== creditos) {
      ctx.addIssue({
        code: "custom",
        path: ["lineas"],
        message: "La suma de débitos no coincide con la suma de créditos",
      });
    }
    if (normalizarCentavos(aCentavos(payload.totalDebito)) !== debitos) {
      ctx.addIssue({
        code: "custom",
        path: ["totalDebito"],
        message: "totalDebito no coincide con la suma de las líneas DB",
      });
    }
    if (normalizarCentavos(aCentavos(payload.totalCredito)) !== creditos) {
      ctx.addIssue({
        code: "custom",
        path: ["totalCredito"],
        message: "totalCredito no coincide con la suma de las líneas CR",
      });
    }
    if (payload.totalDebito !== payload.totalCredito) {
      ctx.addIssue({
        code: "custom",
        path: ["totalCredito"],
        message: "totalDebito y totalCredito deben ser iguales",
      });
    }
  });

// ---------------------------------------------------------------------------
// Respuestas del Web Service
// ---------------------------------------------------------------------------

export const WsSuccessResponseSchema = z.object({
  numeroAsiento: z.string().trim().optional(),
  numeroConfirmacion: z.string().trim().min(1),
  codigoRespuesta: z.string().trim().optional(),
  mensaje: z.string().trim().optional(),
  fechaRecepcion: z.string().trim().optional(),
});

export const WsErrorResponseSchema = z.object({
  codigo: z.string().trim().min(1),
  mensaje: z.string().trim().optional(),
  errores: z
    .array(
      z.object({
        path: z.string().optional(),
        message: z.string(),
      })
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Query params de la consola
// ---------------------------------------------------------------------------

export const AsientoEstadoSchema = z.enum(["TODOS", "PENDIENTE_ENVIO", "ENVIADO", "ERROR"]);
export const AsientoSortSchema = z.enum(["fecha", "numero"]);
export const IntegrationSortDirSchema = z.enum(["asc", "desc"]);
export const IntegrationPageSizeSchema = z.coerce
  .number()
  .int()
  .refine((value) => [10, 25, 50].includes(value), "pageSize debe ser 10, 25 o 50")
  .default(10);

export const ListAsientosQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: IntegrationPageSizeSchema,
  estado: AsientoEstadoSchema.default("TODOS"),
  periodo: PeriodoIntegracionSchema.optional(),
  sort: AsientoSortSchema.default("fecha"),
  dir: IntegrationSortDirSchema.default("desc"),
});

export const BitacoraQuerySchema = z.object({
  asientoId: z.string().uuid("asientoId debe ser un UUID válido"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => [10, 20, 50].includes(value), "pageSize debe ser 10, 20 o 50")
    .default(20),
});

export const BatchDispatchSchema = z.object({
  periodo: PeriodoIntegracionSchema.optional(),
});

// ---------------------------------------------------------------------------
// Tipos inferidos
// ---------------------------------------------------------------------------

export type AsientoPayload = z.infer<typeof AsientoPayloadSchema>;
export type AsientoLineaPayload = z.infer<typeof AsientoLineaPayloadSchema>;
export type WsSuccessResponse = z.infer<typeof WsSuccessResponseSchema>;
export type WsErrorResponse = z.infer<typeof WsErrorResponseSchema>;
export type ListAsientosQuery = z.infer<typeof ListAsientosQuerySchema>;
export type BitacoraQuery = z.infer<typeof BitacoraQuerySchema>;
export type BatchDispatchInput = z.infer<typeof BatchDispatchSchema>;
