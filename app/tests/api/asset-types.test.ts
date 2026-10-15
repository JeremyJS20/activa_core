import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock de autenticación NextAuth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock de Prisma Client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tipoActivo: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET as getTiposActivos, POST as createTipoActivo } from "@/app/api/tipos-activos/route";
import {
  GET as getTipoActivoById,
  PUT as updateTipoActivo,
  DELETE as deleteTipoActivo,
} from "@/app/api/tipos-activos/[id]/route";

describe("API Route Handlers - Tipos de Activos (/api/tipos-activos)", () => {
  const adminUserSession = {
    user: {
      id: "usr-admin-uuid",
      nombre: "Admin General",
      correo: "admin@unapec.edu.do",
      rol: { id: "rol-admin-uuid", codigo: "ADMIN", nombre: "Administrador General" },
      permisos: ["USER_ADMIN", "CAT_READ", "CAT_WRITE"],
    },
  };

  const operadorUserSession = {
    user: {
      id: "usr-op-uuid",
      nombre: "Operador Activos",
      correo: "operador@unapec.edu.do",
      rol: { id: "rol-op-uuid", codigo: "OPERADOR", nombre: "Operador de Activos" },
      permisos: ["CAT_READ", "CAT_WRITE"],
    },
  };

  const readOnlyUserSession = {
    user: {
      id: "usr-auditor-uuid",
      nombre: "Auditor",
      correo: "auditor@unapec.edu.do",
      rol: { id: "rol-aud-uuid", codigo: "AUDITOR", nombre: "Auditor" },
      permisos: ["CAT_READ"],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/tipos-activos", () => {
    it("debe retornar HTTP 401 si no hay sesión autenticada", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos");
      const res = await getTiposActivos(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("debe retornar HTTP 403 si el usuario carece de permiso CAT_READ", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: "sin-perm", permisos: [] },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos");
      const res = await getTiposActivos(req);

      expect(res.status).toBe(403);
    });

    it("debe retornar HTTP 200 con la lista paginada y filtrada por método de depreciación", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);

      const mockTipos = [
        {
          id: "tpa-1",
          codigo: "TPA-002",
          descripcion: "Equipos de Cómputo",
          cuentaContableCompra: "1-01-04-0020",
          cuentaContableDepreciacion: "1-01-04-0021",
          metodoDepreciacion: "DGII_CAT2",
          porcentajeDepreciacionAnual: 25.0,
          vidaUtilMeses: 48,
          estado: "ACTIVO",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.tipoActivo.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.tipoActivo.findMany).mockResolvedValueOnce(mockTipos as any);

      const req = new NextRequest(
        "http://localhost:3000/api/tipos-activos?metodo=DGII_CAT2&page=1&limit=10"
      );
      const res = await getTiposActivos(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].codigo).toBe("TPA-002");
      expect(body.data[0].metodoDepreciacion).toBe("DGII_CAT2");
      expect(body.data[0].porcentajeDepreciacionAnual).toBe(25);
    });
  });

  describe("POST /api/tipos-activos", () => {
    it("debe retornar HTTP 422 si la cuenta de compra y depreciación son idénticas", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos", {
        method: "POST",
        body: JSON.stringify({
          descripcion: "Mobiliario",
          cuentaContableCompra: "1-01-04-0010",
          cuentaContableDepreciacion: "1-01-04-0010", // Idéntica
          metodoDepreciacion: "DGII_CAT3",
          porcentajeDepreciacionAnual: 15,
          vidaUtilMeses: 80,
        }),
      });
      const res = await createTipoActivo(req);

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toBe("VALIDATION_FAILED");
    });

    it("debe autocompletar tasa y vida útil de categoría DGII_CAT2 si no son enviadas", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.tipoActivo.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.tipoActivo.findMany).mockResolvedValueOnce([]); // Para autogenerar código

      const createdObj = {
        id: "tpa-created-uuid",
        codigo: "TPA-001",
        descripcion: "Laptops y Servidores",
        cuentaContableCompra: "1-01-04-0020",
        cuentaContableDepreciacion: "1-01-04-0021",
        metodoDepreciacion: "DGII_CAT2",
        porcentajeDepreciacionAnual: 25.0,
        vidaUtilMeses: 48,
        estado: "ACTIVO",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.tipoActivo.create).mockResolvedValueOnce(createdObj as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos", {
        method: "POST",
        body: JSON.stringify({
          descripcion: "Laptops y Servidores",
          cuentaContableCompra: "1-01-04-0020",
          cuentaContableDepreciacion: "1-01-04-0021",
          metodoDepreciacion: "DGII_CAT2",
        }),
      });
      const res = await createTipoActivo(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.porcentajeDepreciacionAnual).toBe(25);
      expect(body.vidaUtilMeses).toBe(48);
      expect(prisma.tipoActivo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            porcentajeDepreciacionAnual: 25,
            vidaUtilMeses: 48,
          }),
        })
      );
    });

    it("debe retornar HTTP 409 si la descripción ya existe (case-insensitive)", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.tipoActivo.findFirst).mockResolvedValueOnce({
        id: "tpa-existente",
        descripcion: "Equipos de Cómputo",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos", {
        method: "POST",
        body: JSON.stringify({
          descripcion: "equipos de cómputo",
          cuentaContableCompra: "1-01-04-0020",
          cuentaContableDepreciacion: "1-01-04-0021",
          metodoDepreciacion: "DGII_CAT2",
          porcentajeDepreciacionAnual: 25,
          vidaUtilMeses: 48,
        }),
      });
      const res = await createTipoActivo(req);

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("ASSET_TYPE_DUPLICATE_NAME");
    });
  });

  describe("GET /api/tipos-activos/[id]", () => {
    it("debe retornar HTTP 404 si el tipo de activo no existe", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.tipoActivo.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos/tpa-none");
      const res = await getTipoActivoById(req, {
        params: Promise.resolve({ id: "tpa-none" }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("ASSET_TYPE_NOT_FOUND");
    });

    it("debe retornar HTTP 200 con la entidad encontrada", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.tipoActivo.findUnique).mockResolvedValueOnce({
        id: "tpa-1",
        codigo: "TPA-001",
        descripcion: "Edificaciones",
        cuentaContableCompra: "1-01-04-0010",
        cuentaContableDepreciacion: "1-01-04-0011",
        metodoDepreciacion: "DGII_CAT1",
        porcentajeDepreciacionAnual: 5.0,
        vidaUtilMeses: 240,
        estado: "ACTIVO",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos/tpa-1");
      const res = await getTipoActivoById(req, {
        params: Promise.resolve({ id: "tpa-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.codigo).toBe("TPA-001");
      expect(body.porcentajeDepreciacionAnual).toBe(5);
    });
  });

  describe("PUT /api/tipos-activos/[id]", () => {
    it("debe retornar HTTP 422 si al actualizar la cuenta de depreciación se iguala a la de compra existente", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.tipoActivo.findUnique).mockResolvedValueOnce({
        id: "tpa-1",
        cuentaContableCompra: "1-01-04-0010",
        cuentaContableDepreciacion: "1-01-04-0011",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos/tpa-1", {
        method: "PUT",
        body: JSON.stringify({
          cuentaContableDepreciacion: "1-01-04-0010", // Igual a la existente
        }),
      });
      const res = await updateTipoActivo(req, {
        params: Promise.resolve({ id: "tpa-1" }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toBe("ACCOUNTS_CANNOT_BE_IDENTICAL");
    });

    it("debe actualizar correctamente y retornar HTTP 200", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.tipoActivo.findUnique).mockResolvedValueOnce({
        id: "tpa-1",
        codigo: "TPA-001",
        descripcion: "Edificaciones",
        cuentaContableCompra: "1-01-04-0010",
        cuentaContableDepreciacion: "1-01-04-0011",
      } as any);
      vi.mocked(prisma.tipoActivo.findFirst).mockResolvedValueOnce(null);

      vi.mocked(prisma.tipoActivo.update).mockResolvedValueOnce({
        id: "tpa-1",
        codigo: "TPA-001",
        descripcion: "Edificaciones Universitarias Ampliadas",
        cuentaContableCompra: "1-01-04-0010",
        cuentaContableDepreciacion: "1-01-04-0011",
        metodoDepreciacion: "DGII_CAT1",
        porcentajeDepreciacionAnual: 5.0,
        vidaUtilMeses: 240,
        estado: "ACTIVO",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos/tpa-1", {
        method: "PUT",
        body: JSON.stringify({
          descripcion: "Edificaciones Universitarias Ampliadas",
        }),
      });
      const res = await updateTipoActivo(req, {
        params: Promise.resolve({ id: "tpa-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.descripcion).toContain("Ampliadas");
    });
  });

  describe("DELETE /api/tipos-activos/[id]", () => {
    it("debe inactivar lógicamente el tipo de activo si existen registros dependientes", async () => {
      vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
      vi.mocked(prisma.tipoActivo.findUnique).mockResolvedValueOnce({
        id: "tpa-en-uso",
        codigo: "TPA-002",
      } as any);

      // Simular fallo de borrado físico por clave foránea
      vi.mocked(prisma.tipoActivo.delete).mockRejectedValueOnce(
        new Error("Foreign key constraint failed on the field: `tipo_activo_id`")
      );

      vi.mocked(prisma.tipoActivo.update).mockResolvedValueOnce({
        id: "tpa-en-uso",
        estado: "INACTIVO",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos/tpa-en-uso", {
        method: "DELETE",
      });
      const res = await deleteTipoActivo(req, {
        params: Promise.resolve({ id: "tpa-en-uso" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.estado).toBe("INACTIVO");
      expect(body.message).toContain("inactivado lógicamente");
    });

    it("debe eliminar físicamente con HTTP 200 cuando no tiene dependencias", async () => {
      vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
      vi.mocked(prisma.tipoActivo.findUnique).mockResolvedValueOnce({
        id: "tpa-libre",
        codigo: "TPA-009",
      } as any);

      vi.mocked(prisma.tipoActivo.delete).mockResolvedValueOnce({
        id: "tpa-libre",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/tipos-activos/tpa-libre", {
        method: "DELETE",
      });
      const res = await deleteTipoActivo(req, {
        params: Promise.resolve({ id: "tpa-libre" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain("eliminado exitosamente");
    });
  });
});
