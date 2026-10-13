import { describe, it, expect } from "vitest";
import {
  passwordPolicy,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from "@/lib/validations/auth";
import { UserCreateSchema } from "@/lib/validations/users";

describe("Validaciones Zod - Esquemas de Seguridad y Autenticación", () => {
  describe("passwordPolicy", () => {
    it("debe validar exitosamente contraseñas robustas institucionales", () => {
      expect(passwordPolicy.safeParse("Password2026!").success).toBe(true);
      expect(passwordPolicy.safeParse("Unapec$Seguro#2026").success).toBe(true);
    });

    it("debe rechazar contraseñas con menos de 8 caracteres", () => {
      const res = passwordPolicy.safeParse("P26!a");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("al menos 8 caracteres");
      }
    });

    it("debe rechazar contraseñas sin mayúsculas", () => {
      const res = passwordPolicy.safeParse("password2026!");
      expect(res.success).toBe(false);
    });

    it("debe rechazar contraseñas sin minúsculas", () => {
      const res = passwordPolicy.safeParse("PASSWORD2026!");
      expect(res.success).toBe(false);
    });

    it("debe rechazar contraseñas sin dígitos", () => {
      const res = passwordPolicy.safeParse("Password!Seguro");
      expect(res.success).toBe(false);
    });

    it("debe rechazar contraseñas sin caracteres especiales", () => {
      const res = passwordPolicy.safeParse("Password2026");
      expect(res.success).toBe(false);
    });
  });

  describe("LoginSchema", () => {
    it("debe validar credenciales de login bien formadas", () => {
      const res = LoginSchema.safeParse({
        correo: "admin@unapec.edu.do",
        password: "Admin2026!Final",
      });
      expect(res.success).toBe(true);
    });

    it("debe rechazar correos con formato inválido", () => {
      const res = LoginSchema.safeParse({
        correo: "correo-no-valido",
        password: "Admin2026!Final",
      });
      expect(res.success).toBe(false);
    });

    it("debe rechazar contraseñas vacías", () => {
      const res = LoginSchema.safeParse({
        correo: "admin@unapec.edu.do",
        password: "",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("ResetPasswordSchema", () => {
    const validToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    it("debe validar el restablecimiento con token válido y contraseñas coincidentes", () => {
      const res = ResetPasswordSchema.safeParse({
        token: validToken,
        nuevaPassword: "Password2026!Nueva",
        confirmarPassword: "Password2026!Nueva",
      });
      expect(res.success).toBe(true);
    });

    it("debe rechazar tokens con longitud distinta a 64 caracteres", () => {
      const res = ResetPasswordSchema.safeParse({
        token: "token_corto_invalido",
        nuevaPassword: "Password2026!Nueva",
        confirmarPassword: "Password2026!Nueva",
      });
      expect(res.success).toBe(false);
    });

    it("debe rechazar cuando las contraseñas nueva y de confirmación no coinciden", () => {
      const res = ResetPasswordSchema.safeParse({
        token: validToken,
        nuevaPassword: "Password2026!Nueva",
        confirmarPassword: "Password2026!Distinta",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("no coinciden");
      }
    });
  });

  describe("ChangePasswordSchema", () => {
    it("debe validar el cambio de clave cuando la nueva contraseña es distinta a la actual", () => {
      const res = ChangePasswordSchema.safeParse({
        passwordActual: "Password2026!Actual",
        nuevaPassword: "Password2026!Nueva",
        confirmarPassword: "Password2026!Nueva",
      });
      expect(res.success).toBe(true);
    });

    it("debe rechazar cuando la nueva contraseña es idéntica a la actual", () => {
      const res = ChangePasswordSchema.safeParse({
        passwordActual: "Password2026!Misma",
        nuevaPassword: "Password2026!Misma",
        confirmarPassword: "Password2026!Misma",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("debe ser diferente");
      }
    });
  });

  describe("UserCreateSchema", () => {
    it("debe validar la creación de un colaborador con UUID de rol válido", () => {
      const res = UserCreateSchema.safeParse({
        nombre: "Lic. Carlos Méndez",
        correo: "cmendez@unapec.edu.do",
        password: "Password2026!Docente",
        rolId: "123e4567-e89b-12d3-a456-426614174000",
        estado: "ACTIVO",
      });
      expect(res.success).toBe(true);
    });

    it("debe rechazar identificadores de rolId que no sean UUID válidos", () => {
      const res = UserCreateSchema.safeParse({
        nombre: "Lic. Carlos Méndez",
        correo: "cmendez@unapec.edu.do",
        password: "Password2026!Docente",
        rolId: "123_no_uuid",
        estado: "ACTIVO",
      });
      expect(res.success).toBe(false);
    });
  });
});
