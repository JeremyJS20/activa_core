import { z } from "zod";
import { ACCOUNT_CODE_REGEX } from "../validators/accounting";

export const METODOS_DEPRECIACION = [
  "DGII_CAT1",
  "DGII_CAT2",
  "DGII_CAT3",
  "LINEA_RECTA",
] as const;

export const DGII_PARAMETROS_POR_DEFECTO: Record<
  string,
  { porcentaje: number; vidaUtilMeses: number; etiqueta: string }
> = {
  DGII_CAT1: {
    porcentaje: 5.0,
    vidaUtilMeses: 240,
    etiqueta: "Categoría 1 DGII — Edificaciones e Infraestructura (5% anual / 240 meses)",
  },
  DGII_CAT2: {
    porcentaje: 25.0,
    vidaUtilMeses: 48,
    etiqueta: "Categoría 2 DGII — Vehículos, Mobiliario y Cómputo (25% anual / 48 meses)",
  },
  DGII_CAT3: {
    porcentaje: 15.0,
    vidaUtilMeses: 80,
    etiqueta: "Categoría 3 DGII — Maquinaria Pesada y Otros Bienes (15% anual / 80 meses)",
  },
  LINEA_RECTA: {
    porcentaje: 10.0,
    vidaUtilMeses: 120,
    etiqueta: "Línea Recta Estándar (Personalizado)",
  },
};

export const AssetTypeCreateSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .max(10, "El código no puede exceder 10 caracteres")
      .regex(/^[A-Z0-9-]{3,10}$/, "El código debe tener formato alfanumérico (ej: TPA-001)")
      .optional(),
    descripcion: z
      .string()
      .trim()
      .min(3, "La descripción debe tener al menos 3 caracteres")
      .max(150, "La descripción no puede exceder 150 caracteres"),
    cuentaContableCompra: z
      .string()
      .trim()
      .regex(ACCOUNT_CODE_REGEX, "Formato de cuenta contable de compra inválido (esperado: X-XX-XX-XXXX)"),
    cuentaContableDepreciacion: z
      .string()
      .trim()
      .regex(ACCOUNT_CODE_REGEX, "Formato de cuenta contable de depreciación inválido (esperado: X-XX-XX-XXXX)"),
    metodoDepreciacion: z
      .enum(METODOS_DEPRECIACION)
      .default("LINEA_RECTA"),
    porcentajeDepreciacionAnual: z.coerce
      .number()
      .min(0.01, "El porcentaje de depreciación anual debe ser mayor a 0.00%")
      .max(100.0, "El porcentaje de depreciación anual no puede superar el 100.00%"),
    vidaUtilMeses: z.coerce
      .number()
      .int("La vida útil en meses debe ser un número entero")
      .min(1, "La vida útil debe ser al menos de 1 mes")
      .max(1200, "La vida útil no puede exceder 1200 meses (100 años)"),
    estado: z
      .enum(["ACTIVO", "INACTIVO"])
      .default("ACTIVO"),
  })
  .refine(
    (data) => data.cuentaContableCompra !== data.cuentaContableDepreciacion,
    {
      message: "La cuenta de compra y la cuenta de depreciación acumulada no pueden ser idénticas",
      path: ["cuentaContableDepreciacion"],
    }
  );

export const AssetTypeUpdateSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .max(10, "El código no puede exceder 10 caracteres")
      .regex(/^[A-Z0-9-]{3,10}$/, "El código debe tener formato alfanumérico (ej: TPA-001)")
      .optional(),
    descripcion: z
      .string()
      .trim()
      .min(3, "La descripción debe tener al menos 3 caracteres")
      .max(150, "La descripción no puede exceder 150 caracteres")
      .optional(),
    cuentaContableCompra: z
      .string()
      .trim()
      .regex(ACCOUNT_CODE_REGEX, "Formato de cuenta contable de compra inválido (esperado: X-XX-XX-XXXX)")
      .optional(),
    cuentaContableDepreciacion: z
      .string()
      .trim()
      .regex(ACCOUNT_CODE_REGEX, "Formato de cuenta contable de depreciación inválido (esperado: X-XX-XX-XXXX)")
      .optional(),
    metodoDepreciacion: z
      .enum(METODOS_DEPRECIACION)
      .optional(),
    porcentajeDepreciacionAnual: z.coerce
      .number()
      .min(0.01, "El porcentaje de depreciación anual debe ser mayor a 0.00%")
      .max(100.0, "El porcentaje de depreciación anual no puede superar el 100.00%")
      .optional(),
    vidaUtilMeses: z.coerce
      .number()
      .int("La vida útil en meses debe ser un número entero")
      .min(1, "La vida útil debe ser al menos de 1 mes")
      .max(1200, "La vida útil no puede exceder 1200 meses (100 años)")
      .optional(),
    estado: z
      .enum(["ACTIVO", "INACTIVO"])
      .optional(),
  })
  .refine(
    (data) => {
      if (data.cuentaContableCompra && data.cuentaContableDepreciacion) {
        return data.cuentaContableCompra !== data.cuentaContableDepreciacion;
      }
      return true;
    },
    {
      message: "La cuenta de compra y la cuenta de depreciación acumulada no pueden ser idénticas",
      path: ["cuentaContableDepreciacion"],
    }
  );

export const AssetTypeFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO", "TODOS"]).default("TODOS"),
  metodoDepreciacion: z.enum([...METODOS_DEPRECIACION, "TODOS"]).default("TODOS"),
});

export const CreateAssetTypeSchema = AssetTypeCreateSchema;
export const UpdateAssetTypeSchema = AssetTypeUpdateSchema;

export type CreateAssetTypeDTO = z.infer<typeof AssetTypeCreateSchema>;
export type UpdateAssetTypeDTO = z.infer<typeof AssetTypeUpdateSchema>;
export type AssetTypeFilterDTO = z.infer<typeof AssetTypeFilterSchema>;
