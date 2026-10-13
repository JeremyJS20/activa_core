import { z } from "zod";

export const passwordPolicy = z
  .string()
  .min(8, "La contraseña debe contener al menos 8 caracteres")
  .max(100, "La contraseña no puede exceder 100 caracteres")
  .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula")
  .regex(/[a-z]/, "Debe contener al menos una letra minúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")
  .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial");

export const LoginSchema = z.object({
  correo: z
    .string()
    .trim()
    .min(5, "El correo debe tener al menos 5 caracteres")
    .email("Formato de correo institucional inválido"),
  password: z
    .string()
    .min(1, "La contraseña es requerida"),
});

export const ForgotPasswordSchema = z.object({
  correo: z
    .string()
    .trim()
    .email("Formato de correo institucional inválido"),
});

export const ResetPasswordSchema = z
  .object({
    token: z
      .string()
      .length(64, "El token de recuperación debe contener exactamente 64 caracteres")
      .regex(/^[a-f0-9]+$/i, "Formato hexadecimal de token inválido"),
    nuevaPassword: passwordPolicy,
    confirmarPassword: z
      .string()
      .min(1, "La confirmación de la contraseña es obligatoria"),
  })
  .refine((data) => data.nuevaPassword === data.confirmarPassword, {
    message: "Las contraseñas ingresadas no coinciden",
    path: ["confirmarPassword"],
  });

export const ChangePasswordSchema = z
  .object({
    passwordActual: z
      .string()
      .min(1, "La contraseña actual es requerida"),
    nuevaPassword: passwordPolicy,
    confirmarPassword: z
      .string()
      .min(1, "La confirmación de la nueva contraseña es requerida"),
  })
  .refine((data) => data.nuevaPassword === data.confirmarPassword, {
    message: "La confirmación no coincide con la nueva contraseña",
    path: ["confirmarPassword"],
  })
  .refine((data) => data.passwordActual !== data.nuevaPassword, {
    message: "La nueva contraseña debe ser diferente a la actual",
    path: ["nuevaPassword"],
  });

export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
