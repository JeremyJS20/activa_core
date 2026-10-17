import { z } from "zod";

export const ESTADOS_ACTIVO = [
  "ACTIVO",
  "EN_MANTENIMIENTO",
  "DADO_DE_BAJA",
  "VENDIDO",
] as const;

export type EstadoActivo = (typeof ESTADOS_ACTIVO)[number];

export const MOTIVOS_CUSTODIA = [
  "ALTA_INICIAL",
  "ROTACION_INTERNA",
  "CAMBIO_DEPARTAMENTO",
  "MANTENIMIENTO",
  "OTRO",
] as const;

export type MotivoCustodia = (typeof MOTIVOS_CUSTODIA)[number];

export const MOTIVOS_BAJA = [
  "OBSOLESCENCIA_TECNOLOGICA",
  "DANO_IRREPARABLE",
  "PERDIDA_ROBO",
  "VENTA_DESECHO",
  "DONACION",
] as const;

export type MotivoBaja = (typeof MOTIVOS_BAJA)[number];

export const CreateAssetSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .max(20, "El código no puede exceder 20 caracteres")
      .regex(/^ACT-\d{4}-\d{4,}$/, "El código debe tener formato ACT-YYYY-NNNN (ej: ACT-2026-0001)")
      .optional(),
    descripcion: z
      .string()
      .trim()
      .min(3, "La descripción del activo debe tener al menos 3 caracteres")
      .max(255, "La descripción del activo no puede exceder 255 caracteres"),
    tipoActivoId: z
      .string()
      .uuid("Debe seleccionar un tipo de activo válido"),
    departamentoId: z
      .string()
      .uuid("Debe seleccionar un departamento válido"),
    empleadoId: z
      .string()
      .uuid("Debe seleccionar un empleado custodio válido"),
    fechaAdquisicion: z.coerce
      .date({
        message: "La fecha de adquisición es obligatoria",
      })
      .refine(
        (date) => {
          const now = new Date();
          return date <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        },
        "La fecha de adquisición no puede ser posterior a la fecha actual"
      ),
    costoAdquisicion: z.coerce
      .number({
        message: "El costo de adquisición debe ser un número válido",
      })
      .positive("El costo de adquisición debe ser estrictamente mayor a RD$ 0.00"),
    valorResidual: z.coerce
      .number({
        message: "El valor residual debe ser un número válido",
      })
      .min(0, "El valor residual no puede ser negativo")
      .default(0.0),
    estado: z
      .enum(["ACTIVO", "EN_MANTENIMIENTO"])
      .default("ACTIVO"),
    marca: z
      .string()
      .trim()
      .max(100, "La marca no puede exceder 100 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    modelo: z
      .string()
      .trim()
      .max(100, "El modelo no puede exceder 100 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    numeroSerie: z
      .string()
      .trim()
      .max(100, "El número de serie no puede exceder 100 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    ubicacionFisica: z
      .string()
      .trim()
      .max(255, "La ubicación física no puede exceder 255 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    color: z
      .string()
      .trim()
      .max(50, "El color no puede exceder 50 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
  })
  .refine(
    (data) => data.valorResidual <= data.costoAdquisicion,
    {
      message: "El valor residual no puede ser superior al costo de compra del activo",
      path: ["valorResidual"],
    }
  );

export const UpdateAssetSchema = z
  .object({
    descripcion: z
      .string()
      .trim()
      .min(3, "La descripción del activo debe tener al menos 3 caracteres")
      .max(255, "La descripción del activo no puede exceder 255 caracteres")
      .optional(),
    marca: z
      .string()
      .trim()
      .max(100, "La marca no puede exceder 100 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    modelo: z
      .string()
      .trim()
      .max(100, "El modelo no puede exceder 100 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    numeroSerie: z
      .string()
      .trim()
      .max(100, "El número de serie no puede exceder 100 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    ubicacionFisica: z
      .string()
      .trim()
      .max(255, "La ubicación física no puede exceder 255 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    color: z
      .string()
      .trim()
      .max(50, "El color no puede exceder 50 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    estado: z
      .enum(["ACTIVO", "EN_MANTENIMIENTO"])
      .optional(),
    costoAdquisicion: z.coerce
      .number()
      .positive("El costo de adquisición debe ser estrictamente mayor a RD$ 0.00")
      .optional(),
    valorResidual: z.coerce
      .number()
      .min(0, "El valor residual no puede ser negativo")
      .optional(),
    fechaAdquisicion: z.coerce
      .date()
      .refine(
        (date) => {
          const now = new Date();
          return date <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        },
        "La fecha de adquisición no puede ser posterior a la fecha actual"
      )
      .optional(),
    tipoActivoId: z
      .string()
      .uuid("Debe seleccionar un tipo de activo válido")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.costoAdquisicion !== undefined && data.valorResidual !== undefined) {
        return data.valorResidual <= data.costoAdquisicion;
      }
      return true;
    },
    {
      message: "El valor residual no puede ser superior al costo de compra del activo",
      path: ["valorResidual"],
    }
  );

export const TransferCustodySchema = z.object({
  empleadoNuevoId: z
    .string()
    .uuid("Debe seleccionar un nuevo empleado custodio válido"),
  departamentoNuevoId: z
    .string()
    .uuid("Debe seleccionar un nuevo departamento válido"),
  motivo: z
    .enum(MOTIVOS_CUSTODIA)
    .default("ROTACION_INTERNA"),
  justificacion: z
    .string()
    .trim()
    .min(10, "La justificación debe contener al menos 10 caracteres explicativos")
    .max(1000, "La justificación no puede exceder 1000 caracteres"),
});

export const DisposeAssetSchema = z.object({
  motivoBaja: z.enum(MOTIVOS_BAJA, {
    message: "Debe seleccionar un motivo formal de baja válido",
  }),
  numeroActa: z
    .string()
    .trim()
    .min(3, "El número de acta o expediente administrativo es obligatorio (mínimo 3 caracteres)")
    .max(50, "El número de acta no puede exceder 50 caracteres"),
  justificacion: z
    .string()
    .trim()
    .min(20, "El dictamen técnico / justificación de baja debe contener al menos 20 caracteres")
    .max(2000, "La justificación no puede exceder 2000 caracteres"),
  fechaBaja: z.coerce
    .date()
    .refine(
      (date) => {
        const now = new Date();
        return date <= new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      },
      "La fecha de baja no puede ser posterior a la fecha actual"
    )
    .optional(),
});

export const AssetFilterSchema = z.object({
  search: z.string().trim().optional(),
  departamentoId: z.string().uuid().optional(),
  tipoActivoId: z.string().uuid().optional(),
  empleadoId: z.string().uuid().optional(),
  estado: z
    .enum(["ACTIVO", "EN_MANTENIMIENTO", "DADO_DE_BAJA", "VENDIDO", "TODOS"])
    .optional()
    .default("TODOS"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z
    .enum(["codigo", "descripcion", "costoAdquisicion", "fechaAdquisicion", "createdAt"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// Tipos inferidos
export type CreateAssetDTO = z.infer<typeof CreateAssetSchema>;
export type UpdateAssetDTO = z.infer<typeof UpdateAssetSchema>;
export type TransferCustodyDTO = z.infer<typeof TransferCustodySchema>;
export type DisposeAssetDTO = z.infer<typeof DisposeAssetSchema>;
export type AssetFilterDTO = z.infer<typeof AssetFilterSchema>;

// Alias descriptivos
export const AssetCreateSchema = CreateAssetSchema;
export const AssetUpdateSchema = UpdateAssetSchema;
export const AssetTransferCustodySchema = TransferCustodySchema;
export const AssetDisposeSchema = DisposeAssetSchema;