import { z } from "zod";

export const ESTADOS_PERIODO = ["ABIERTO", "CALCULADO", "CERRADO"] as const;
export type EstadoPeriodo = (typeof ESTADOS_PERIODO)[number];

export const ANIO_MINIMO = 2000;
export const ANIO_MAXIMO = 2100;
export const MES_MINIMO = 1;
export const MES_MAXIMO = 12;
export const PAGE_SIZE_MAXIMO = 50;

/** Alta de un período de depreciación mensual. */
export const CreatePeriodSchema = z.object({
  anio: z.coerce
    .number()
    .int("El año debe ser un número entero")
    .min(ANIO_MINIMO, `El año debe ser mayor o igual a ${ANIO_MINIMO}`)
    .max(ANIO_MAXIMO, `El año no puede exceder ${ANIO_MAXIMO}`),
  mes: z.coerce
    .number()
    .int("El mes debe ser un número entero")
    .min(MES_MINIMO, "El mes debe estar entre 1 y 12")
    .max(MES_MAXIMO, "El mes debe estar entre 1 y 12"),
});

/** Cierre inmutable del período: exige confirmación explícita. */
export const ClosePeriodSchema = z.object({
  confirmar: z
    .boolean()
    .refine((valor) => valor === true, {
      message: "Debe confirmar que el cierre del período es irreversible",
    }),
});

/** Filtros y paginación del listado de períodos. */
export const PeriodFilterSchema = z.object({
  page: z.coerce.number().int("La página debe ser un entero").positive("La página debe ser mayor a 0").default(1),
  pageSize: z.coerce
    .number()
    .int("El tamaño de página debe ser un entero")
    .positive("El tamaño de página debe ser mayor a 0")
    .max(PAGE_SIZE_MAXIMO, `El tamaño de página no puede exceder ${PAGE_SIZE_MAXIMO}`)
    .default(10),
  estado: z.enum([...ESTADOS_PERIODO, "TODOS"]).default("TODOS"),
  anio: z.coerce
    .number()
    .int("El año debe ser un número entero")
    .min(ANIO_MINIMO, `El año debe ser mayor o igual a ${ANIO_MINIMO}`)
    .max(ANIO_MAXIMO, `El año no puede exceder ${ANIO_MAXIMO}`)
    .optional(),
});

/** Filtros del listado de asientos contables. */
export const AsientoFilterSchema = z.object({
  page: z.coerce.number().int("La página debe ser un entero").positive("La página debe ser mayor a 0").default(1),
  pageSize: z.coerce
    .number()
    .int("El tamaño de página debe ser un entero")
    .positive("El tamaño de página debe ser mayor a 0")
    .max(PAGE_SIZE_MAXIMO, `El tamaño de página no puede exceder ${PAGE_SIZE_MAXIMO}`)
    .default(10),
  estado: z.enum(["PENDIENTE_ENVIO", "ENVIADO", "ERROR", "TODOS"]).default("PENDIENTE_ENVIO"),
});

export type CreatePeriodDTO = z.infer<typeof CreatePeriodSchema>;
export type ClosePeriodDTO = z.infer<typeof ClosePeriodSchema>;
export type PeriodFilterDTO = z.infer<typeof PeriodFilterSchema>;
export type AsientoFilterDTO = z.infer<typeof AsientoFilterSchema>;
