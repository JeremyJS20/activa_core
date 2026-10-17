import { z } from "zod";

export const DepartmentCreateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .max(10, "El código no puede exceder 10 caracteres")
    .regex(/^[A-Z0-9-]{3,10}$/, "El código debe tener formato alfanumérico (ej: DEP-001)")
    .optional(),
  descripcion: z
    .string()
    .trim()
    .min(3, "La descripción debe tener al menos 3 caracteres")
    .max(120, "La descripción no puede exceder 120 caracteres"),
  responsableId: z
    .string()
    .uuid("El responsable debe ser un identificador UUID válido")
    .optional()
    .nullable(),
  estado: z
    .enum(["ACTIVO", "INACTIVO"])
    .default("ACTIVO"),
});

export const DepartmentUpdateSchema = z.object({
  codigo: z
    .string()
    .trim()
    .max(10, "El código no puede exceder 10 caracteres")
    .regex(/^[A-Z0-9-]{3,10}$/, "El código debe tener formato alfanumérico (ej: DEP-001)")
    .optional(),
  descripcion: z
    .string()
    .trim()
    .min(3, "La descripción debe tener al menos 3 caracteres")
    .max(120, "La descripción no puede exceder 120 caracteres")
    .optional(),
  responsableId: z
    .string()
    .uuid("El responsable debe ser un identificador UUID válido")
    .optional()
    .nullable(),
  estado: z
    .enum(["ACTIVO", "INACTIVO"])
    .optional(),
});

export const DepartmentFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO", "TODOS"]).default("TODOS"),
});

export const CreateDepartmentSchema = DepartmentCreateSchema;
export const UpdateDepartmentSchema = DepartmentUpdateSchema;

export type CreateDepartmentDTO = z.infer<typeof DepartmentCreateSchema>;
export type UpdateDepartmentDTO = z.infer<typeof DepartmentUpdateSchema>;
export type DepartmentFilterDTO = z.infer<typeof DepartmentFilterSchema>;
