import { z } from "zod";
import { validarIdentidadDominicana, normalizarDocumento } from "../validators/identity";

export const EmployeeCreateSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .max(10, "El código no puede exceder 10 caracteres")
      .regex(/^[A-Z0-9-]{3,10}$/, "El código debe tener formato alfanumérico (ej: EMP-0001)")
      .optional(),
    nombre: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(100, "El nombre no puede exceder 100 caracteres"),
    apellido: z
      .string()
      .trim()
      .min(2, "El apellido debe tener al menos 2 caracteres")
      .max(100, "El apellido no puede exceder 100 caracteres"),
    tipoPersona: z
      .enum(["FISICA", "JURIDICA"])
      .default("FISICA"),
    cedula: z
      .string()
      .trim()
      .min(9, "El documento de identidad debe tener al menos 9 dígitos")
      .max(15, "El documento de identidad no puede exceder 15 caracteres"),
    departamentoId: z
      .string()
      .uuid("Debe seleccionar un departamento válido"),
    cargo: z
      .string()
      .trim()
      .min(2, "El cargo institucional debe tener al menos 2 caracteres")
      .max(100, "El cargo institucional no puede exceder 100 caracteres"),
    correo: z
      .string()
      .trim()
      .email("Formato de correo electrónico institucional inválido")
      .max(150, "El correo no puede exceder 150 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    telefono: z
      .string()
      .trim()
      .max(20, "El teléfono no puede exceder 20 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    fechaIngreso: z.coerce
      .date({
        message: "La fecha de contratación es obligatoria"
      })
      .refine(
        (date) => date <= new Date(),
        "La fecha de ingreso no puede ser posterior a la fecha actual"
      ),
    estado: z
      .enum(["ACTIVO", "INACTIVO"])
      .default("ACTIVO"),
  })
  .refine(
    (data) => validarIdentidadDominicana(data.cedula, data.tipoPersona),
    {
      message:
        "El documento de identidad (cédula o RNC) no supera la validación matemática oficial",
      path: ["cedula"],
    }
  );

export const EmployeeUpdateSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .max(10, "El código no puede exceder 10 caracteres")
      .regex(/^[A-Z0-9-]{3,10}$/, "El código debe tener formato alfanumérico (ej: EMP-0001)")
      .optional(),
    nombre: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(100, "El nombre no puede exceder 100 caracteres")
      .optional(),
    apellido: z
      .string()
      .trim()
      .min(2, "El apellido debe tener al menos 2 caracteres")
      .max(100, "El apellido no puede exceder 100 caracteres")
      .optional(),
    tipoPersona: z
      .enum(["FISICA", "JURIDICA"])
      .optional(),
    cedula: z
      .string()
      .trim()
      .min(9, "El documento de identidad debe tener al menos 9 dígitos")
      .max(15, "El documento de identidad no puede exceder 15 caracteres")
      .optional(),
    departamentoId: z
      .string()
      .uuid("Debe seleccionar un departamento válido")
      .optional(),
    cargo: z
      .string()
      .trim()
      .min(2, "El cargo institucional debe tener al menos 2 caracteres")
      .max(100, "El cargo institucional no puede exceder 100 caracteres")
      .optional(),
    correo: z
      .string()
      .trim()
      .email("Formato de correo electrónico institucional inválido")
      .max(150, "El correo no puede exceder 150 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    telefono: z
      .string()
      .trim()
      .max(20, "El teléfono no puede exceder 20 caracteres")
      .optional()
      .nullable()
      .or(z.literal("")),
    fechaIngreso: z.coerce
      .date()
      .refine(
        (date) => date <= new Date(),
        "La fecha de ingreso no puede ser posterior a la fecha actual"
      )
      .optional(),
    estado: z
      .enum(["ACTIVO", "INACTIVO"])
      .optional(),
  })
  .refine(
    (data) => {
      if (data.cedula) {
        const tipo = data.tipoPersona || "FISICA";
        return validarIdentidadDominicana(data.cedula, tipo);
      }
      return true;
    },
    {
      message:
        "El documento de identidad (cédula o RNC) no supera la validación matemática oficial",
      path: ["cedula"],
    }
  );

export const EmployeeFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  departamentoId: z.string().uuid().optional(),
  estado: z.enum(["ACTIVO", "INACTIVO", "TODOS"]).default("TODOS"),
});

export const CreateEmployeeSchema = EmployeeCreateSchema;
export const UpdateEmployeeSchema = EmployeeUpdateSchema;

export type CreateEmployeeDTO = z.infer<typeof EmployeeCreateSchema>;
export type UpdateEmployeeDTO = z.infer<typeof EmployeeUpdateSchema>;
export type EmployeeFilterDTO = z.infer<typeof EmployeeFilterSchema>;
