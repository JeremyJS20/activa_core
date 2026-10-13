import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkSessionPermission } from "@/lib/auth/rbac";

// Mocking auth() from "@/auth"
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";

describe("rbacEvaluator - Control de Acceso Relacional Basado en Roles (RBAC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe rechazar con HTTP 401 si no existe sesión activa o el usuario no tiene id", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const result = await checkSessionPermission("USER_ADMIN");
    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);

    const body = await result.response?.json();
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("debe autorizar a un usuario con rol de Administrador General (ADMIN) sin importar el permiso requerido", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: "usr_admin_123",
        nombre: "Admin General",
        correo: "admin@unapec.edu.do",
        rol: { codigo: "ADMIN", nombre: "Administrador General" },
        permisos: ["USER_ADMIN", "AUDIT_LOG_READ"],
      },
    } as any);

    const result = await checkSessionPermission("ACT_DISPOSE");
    expect(result.authorized).toBe(true);
    expect(result.response).toBeNull();
    expect(result.session).toBeDefined();
  });

  it("debe autorizar a un usuario con permiso maestro USER_ADMIN", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: "usr_subadmin_123",
        nombre: "Gestor Usuarios",
        correo: "gestor@unapec.edu.do",
        rol: { codigo: "GESTOR", nombre: "Gestor" },
        permisos: ["USER_ADMIN"],
      },
    } as any);

    const result = await checkSessionPermission("ANY_OTHER_PERMISSION");
    expect(result.authorized).toBe(true);
    expect(result.response).toBeNull();
  });

  it("debe autorizar a un operador si su lista de permisos incluye la capacidad solicitada", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: "usr_operador_456",
        nombre: "Carlos Méndez",
        correo: "cmendez@unapec.edu.do",
        rol: { codigo: "OPERADOR", nombre: "Operador de Activos" },
        permisos: ["ACT_READ", "ACT_CREATE", "CAT_READ"],
      },
    } as any);

    const result = await checkSessionPermission("ACT_CREATE");
    expect(result.authorized).toBe(true);
    expect(result.response).toBeNull();
  });

  it("debe rechazar con HTTP 403 (FORBIDDEN) a un operador que no posea la capacidad requerida", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: "usr_operador_456",
        nombre: "Carlos Méndez",
        correo: "cmendez@unapec.edu.do",
        rol: { codigo: "OPERADOR", nombre: "Operador de Activos" },
        permisos: ["ACT_READ", "CAT_READ"],
      },
    } as any);

    const result = await checkSessionPermission("ACT_DISPOSE");
    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(403);

    const body = await result.response?.json();
    expect(body.error).toBe("FORBIDDEN");
    expect(body.message).toContain("ACT_DISPOSE");
  });

  it("debe autorizar a cualquier usuario autenticado si no se exige un permiso específico", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: "usr_auditor_789",
        nombre: "Auditor Interno",
        correo: "auditor@unapec.edu.do",
        rol: { codigo: "AUDITOR", nombre: "Auditor" },
        permisos: ["REP_READ"],
      },
    } as any);

    const result = await checkSessionPermission();
    expect(result.authorized).toBe(true);
    expect(result.response).toBeNull();
  });
});
