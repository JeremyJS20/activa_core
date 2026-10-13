import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mocking dependencies
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((promises) => Promise.all(promises)),
  },
}));

vi.mock("@/lib/services/email.service", () => ({
  emailService: {
    sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { authRateLimiter } from "@/lib/auth/rateLimiter";
import { POST as forgotPasswordHandler } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordHandler } from "@/app/api/auth/reset-password/route";
import { PUT as changePasswordHandler } from "@/app/api/auth/change-password/route";
import { POST as unlockUserHandler } from "@/app/api/usuarios/[id]/unlock/route";

describe("API Route Handlers - Endpoints de Seguridad y Autenticación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/forgot-password", () => {
    it("debe retornar HTTP 400 cuando el cuerpo de la petición no contiene un correo válido", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ correo: "correo_invalido" }),
      });

      const res = await forgotPasswordHandler(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("debe retornar HTTP 429 cuando el correo ha excedido el límite de peticiones (Rate Limit)", async () => {
      const testEmail = "throttled@unapec.edu.do";
      vi.spyOn(authRateLimiter, "isBlocked").mockReturnValueOnce({
        blocked: true,
        remainingSeconds: 600,
      });

      const req = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ correo: testEmail }),
      });

      const res = await forgotPasswordHandler(req);
      expect(res.status).toBe(429);

      const body = await res.json();
      expect(body.error).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("debe retornar HTTP 200 con mensaje neutro cuando el correo es válido", async () => {
      vi.spyOn(authRateLimiter, "isBlocked").mockReturnValueOnce({
        blocked: false,
        remainingSeconds: 0,
      });
      vi.mocked(prisma.usuario.findUnique).mockResolvedValueOnce({
        id: "usr_123",
        correo: "docente@unapec.edu.do",
        estado: "ACTIVO",
        nombre: "Profesor Prueba",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ correo: "docente@unapec.edu.do" }),
      });

      const res = await forgotPasswordHandler(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.message).toContain("Si el correo ingresado coincide");
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("debe retornar HTTP 422 cuando la contraseña no cumple la política de robustez", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          nuevaPassword: "corta",
          confirmarPassword: "corta",
        }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(422);

      const body = await res.json();
      expect(body.error).toBe("PASSWORD_POLICY_VIOLATION");
    });

    it("debe retornar HTTP 400 si el token no existe en base de datos o ya fue utilizado", async () => {
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          nuevaPassword: "Password2026!Nueva",
          confirmarPassword: "Password2026!Nueva",
        }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("INVALID_OR_EXPIRED_RESET_TOKEN");
    });

    it("debe retornar HTTP 403 si el usuario asociado al token se encuentra inactivo", async () => {
      vi.mocked(prisma.passwordResetToken.findUnique).mockResolvedValueOnce({
        id: "tok_123",
        usuarioId: "usr_inactivo",
        utilizado: false,
        expiraAt: new Date(Date.now() + 10000),
        usuario: { estado: "INACTIVO" },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          nuevaPassword: "Password2026!Nueva",
          confirmarPassword: "Password2026!Nueva",
        }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toBe("USER_ACCOUNT_INACTIVE");
    });
  });

  describe("PUT /api/auth/change-password", () => {
    it("debe retornar HTTP 401 si no hay usuario autenticado en la sesión", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({
          passwordActual: "Password2026!Actual",
          nuevaPassword: "Password2026!Nueva",
          confirmarPassword: "Password2026!Nueva",
        }),
      });

      const res = await changePasswordHandler(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("debe retornar HTTP 400 si la contraseña actual ingresada no coincide con el hash", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: "usr_test_auth" },
      } as any);

      vi.mocked(prisma.usuario.findUnique).mockResolvedValueOnce({
        id: "usr_test_auth",
        // Hash de una contraseña distinta
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901234567",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({
          passwordActual: "PasswordEquivocado!2026",
          nuevaPassword: "Password2026!Nueva",
          confirmarPassword: "Password2026!Nueva",
        }),
      });

      const res = await changePasswordHandler(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("CURRENT_PASSWORD_INCORRECT");
    });
  });

  describe("POST /api/usuarios/[id]/unlock", () => {
    it("debe retornar HTTP 401 si el usuario no está autenticado", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost:3000/api/usuarios/usr_1/unlock", {
        method: "POST",
      });

      const res = await unlockUserHandler(req, { params: Promise.resolve({ id: "usr_1" }) });
      expect(res.status).toBe(401);
    });

    it("debe retornar HTTP 403 si el usuario autenticado no posee permiso USER_ADMIN", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: "usr_operador",
          rol: { codigo: "OPERADOR" },
          permisos: ["ACT_READ"],
        },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/usuarios/usr_1/unlock", {
        method: "POST",
      });

      const res = await unlockUserHandler(req, { params: Promise.resolve({ id: "usr_1" }) });
      expect(res.status).toBe(403);
    });
  });
});
