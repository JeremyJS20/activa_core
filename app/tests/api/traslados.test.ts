import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock de autenticación NextAuth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock de Prisma Client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    activoFijo: {
      findUnique: vi.fn(),
    },
    historialCustodia: {
      findMany: vi.fn(),
    },
  },
}));

// Mock del servicio de transferencia de custodia
vi.mock("@/lib/services/custody-transfer.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/custody-transfer.service")>();
  return {
    ...actual,
    transferirCustodia: vi.fn(),
  };
});

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { transferirCustodia, CustodyTransferError } from "@/lib/services/custody-transfer.service";
import { POST as transferirActivo, GET as getHistorialCustodia } from "@/app/api/activos/[id]/traslados/route";

describe("API Route Handlers - Traslados de Custodia (/api/activos/[id]/traslados)", () => {
  const adminUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000001",
      nombre: "Admin General",
      correo: "admin@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000001", codigo: "ADMIN", nombre: "Administrador General" },
      permisos: ["USER_ADMIN", "ACT_READ", "ACT_TRANSFER"],
    },
  };

  const operadorUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000002",
      nombre: "Operador Activos",
      correo: "operador@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000002", codigo: "OPERADOR", nombre: "Operador de Activos" },
      permisos: ["ACT_READ", "ACT_TRANSFER"],
    },
  };

  const readOnlyUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000003",
      nombre: "Auditor",
      correo: "auditor@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000003", codigo: "AUDITOR", nombre: "Auditor" },
      permisos: ["ACT_READ"],
    },
  };

  const targetId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
  const empNuevoId = "e2222222-2222-4000-8000-000000000002";
  const deptNuevoId = "d2222222-2222-4000-8000-000000000002";

  const validPayload = {
    empleadoNuevoId: empNuevoId,
    departamentoNuevoId: deptNuevoId,
    motivo: "ROTACION_INTERNA",
    justificacion: "Reasignación formal por cambio de funciones en área",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/activos/[id]/traslados", () => {
    it("rechaza solicitud no autenticada con 401 Unauthorized", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);
      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/traslados`, {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await transferirActivo(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(401);
    });

    it("rechaza usuarios sin permiso ACT_TRANSFER con 403 Forbidden", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/traslados`, {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await transferirActivo(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(403);
    });

    it("rechaza formato de UUID inválido con 400 Bad Request", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      const req = new NextRequest(`http://localhost:3000/api/activos/id-invalido/traslados`, {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await transferirActivo(req, { params: Promise.resolve({ id: "id-invalido" }) });
      expect(res!.status).toBe(400);
      const body = await res!.json();
      expect(body.error).toBe("INVALID_ASSET_ID");
    });

    it("rechaza justificación menor a 10 caracteres con 422 Unprocessable Entity", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/traslados`, {
        method: "POST",
        body: JSON.stringify({ ...validPayload, justificacion: "corta" }),
      });
      const res = await transferirActivo(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(422);
      const body = await res!.json();
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("mapea errores de negocio CustodyTransferError con el status correspondiente", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(transferirCustodia).mockRejectedValueOnce(
        new CustodyTransferError(
          "ASSET_DISPOSED_CANNOT_TRANSFER",
          400,
          "No se puede transferir un activo dado de baja."
        )
      );

      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/traslados`, {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await transferirActivo(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(400);
      const body = await res!.json();
      expect(body.error).toBe("ASSET_DISPOSED_CANNOT_TRANSFER");
    });

    it("ejecuta traslado exitosamente con 201 Created", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      const mockResultado = {
        movimientoId: "mov-uuid-1",
        activoId: targetId,
        empleadoAnteriorId: "emp-ant-uuid",
        empleadoNuevoId: empNuevoId,
        departamentoAnteriorId: "dep-ant-uuid",
        departamentoNuevoId: deptNuevoId,
        createdAt: "2026-02-01T10:00:00.000Z",
      };
      vi.mocked(transferirCustodia).mockResolvedValueOnce(mockResultado);

      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/traslados`, {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await transferirActivo(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(201);
      const body = await res!.json();
      expect(body.movimientoId).toBe("mov-uuid-1");
      expect(body.empleadoNuevoId).toBe(empNuevoId);
    });
  });

  describe("GET /api/activos/[id]/traslados", () => {
    it("retorna 404 si el activo no existe", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/traslados`);
      const res = await getHistorialCustodia(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(404);
      const body = await res!.json();
      expect(body.error).toBe("ASSET_NOT_FOUND");
    });

    it("retorna lista cronológica de movimientos de custodia con 200 OK", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce({
        id: targetId,
        codigo: "ACT-2026-0001",
        descripcion: "Laptop Dell",
      } as any);

      const mockMovimiento = {
        id: "mov-uuid-1",
        motivo: "ROTACION_INTERNA",
        justificacion: "Cambio de departamento por reestructuracion",
        createdAt: new Date("2026-02-01T10:00:00.000Z"),
        empleadoAnterior: { id: "emp-1", codigo: "EMP-001", nombre: "Juan", apellido: "Perez", cargo: "Analista" },
        empleadoNuevo: { id: "emp-2", codigo: "EMP-002", nombre: "Maria", apellido: "Gomez", cargo: "Especialista" },
        departamentoAnterior: { id: "dep-1", codigo: "DEP-001", descripcion: "TI" },
        departamentoNuevo: { id: "dep-2", codigo: "DEP-002", descripcion: "Finanzas" },
        autorizadoPor: { id: "usr-1", nombre: "Admin", correo: "admin@unapec.edu.do" },
      };
      vi.mocked(prisma.historialCustodia.findMany).mockResolvedValueOnce([mockMovimiento as any]);

      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/traslados`);
      const res = await getHistorialCustodia(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(200);
      const body = await res!.json();
      expect(body.activoId).toBe(targetId);
      expect(body.historial).toHaveLength(1);
      expect(body.historial[0].motivo).toBe("ROTACION_INTERNA");
      expect(body.historial[0].empleadoNuevo.nombre).toBe("Maria");
    });
  });
});