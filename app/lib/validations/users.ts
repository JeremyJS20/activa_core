import { z } from "zod";
import { passwordPolicy } from "./auth";

export const UserCreateSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(120, "El nombre no puede exceder 120 caracteres"),
  correo: z
    .string()
    .trim()
    .email("Formato de correo institucional inválido")
    .max(150, "El correo no puede exceder 150 caracteres"),
  password: passwordPolicy,
  rolId: z
    .string()
    .uuid("El rol asignado debe ser un identificador UUID válido"),
  empleadoId: z
    .string()
    .uuid("El empleado asignado debe ser un identificador UUID válido")
    .optional()
    .nullable(),
  estado: z
    .enum(["ACTIVO", "INACTIVO"])
    .default("ACTIVO"),
});

export const UserUpdateSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(120, "El nombre no puede exceder 120 caracteres")
    .optional(),
  correo: z
    .string()
    .trim()
    .email("Formato de correo institucional inválido")
    .max(150, "El correo no puede exceder 150 caracteres")
    .optional(),
  password: passwordPolicy.optional(),
  rolId: z
    .string()
    .uuid("El rol asignado debe ser un identificador UUID válido")
    .optional(),
  empleadoId: z
    .string()
    .uuid("El empleado asignado debe ser un identificador UUID válido")
    .optional()
    .nullable(),
  estado: z
    .enum(["ACTIVO", "INACTIVO"])
    .optional(),
});

export const CreateUserSchema = UserCreateSchema;
export const UpdateUserSchema = UserUpdateSchema;

export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
export type CreateUserInput = UserCreateInput;
export type UpdateUserInput = UserUpdateInput;
