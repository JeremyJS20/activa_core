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
      update: vi.fn(),
    },
    historialBaja: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { POST as procesarBaja } from "@/app/api/activos/[id]/baja/route";

describe("API Route Handler - Baja de Activo Fijo (/api/activos/[id]/baja)", () => {
  const adminUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000001",
      nombre: "Admin General",
      correo: "admin@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000001", codigo: "ADMIN", nombre: "Administrador General" },
      permisos: ["USER_ADMIN", "ACT_READ", "ACT_DISPOSE"],
    },
  };

  const operadorUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000002",
      nombre: "Operador Activos",
      correo: "operador@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000002", codigo: "OPERADOR", nombre: "Operador de Activos" },
      permisos: ["ACT_READ", "ACT_CREATE", "ACT_UPDATE"],
    },
  };

  const targetId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

  const validPayload = {
    motivoBaja: "DANO_IRREPARABLE",
    justificacion: "Falla técnica catastrófica del compresor principal sin repuestos disponibles",
    numeroActa: "ACTA-BAJA-2026-004",
    fechaBaja: "2026-02-15",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza solicitud no autenticada con 401 Unauthorized", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);
    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/baja`, {
      method: "POST",
      body: JSON.stringify(validPayload),
    });
    const res = await procesarBaja(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(401);
  });

  it("rechaza a usuarios sin rol ADMIN con 403 Forbidden", async () => {
    vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/baja`, {
      method: "POST",
      body: JSON.stringify(validPayload),
    });
    const res = await procesarBaja(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe("FORBIDDEN_ADMIN_REQUIRED");
  });

  it("rechaza identificador de activo con UUID inválido con 400 Bad Request", async () => {
    vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
    const req = new NextRequest(`http://localhost:3000/api/activos/id-invalido/baja`, {
      method: "POST",
      body: JSON.stringify(validPayload),
    });
    const res = await procesarBaja(req, { params: Promise.resolve({ id: "id-invalido" }) });
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toBe("INVALID_ASSET_ID");
  });

  it("rechaza justificación menor a 20 caracteres con 422 Unprocessable Entity", async () => {
    vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/baja`, {
      method: "POST",
      body: JSON.stringify({ ...validPayload, justificacion: "corta < 20" }),
    });
    const res = await procesarBaja(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(422);
    const body = await res!.json();
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("retorna 404 Not Found si el activo no existe", async () => {
    vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
    vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/baja`, {
      method: "POST",
      body: JSON.stringify(validPayload),
    });
    const res = await procesarBaja(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(404);
    const body = await res!.json();
    expect(body.error).toBe("ASSET_NOT_FOUND");
  });

  it("rechaza con 409 Conflict si el activo ya fue dado de baja previamente", async () => {
    vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
    vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce({
      id: targetId,
      estado: "DADO_DE_BAJA",
      valorEnLibros: 0,
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/baja`, {
      method: "POST",
      body: JSON.stringify(validPayload),
    });
    const res = await procesarBaja(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(409);
    const body = await res!.json();
    expect(body.error).toBe("ASSET_ALREADY_DISPOSED");
  });

  it("procesa baja exitosamente en transacción atómica con 200 OK", async () => {
    vi.mocked(auth).mockResolvedValueOnce(adminUserSession as any);
    vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce({
      id: targetId,
      estado: "ACTIVO",
      valorEnLibros: 12500.0,
    } as any);

    vi.mocked(prisma.$transaction).mockImplementationOnce(async (cb: any) => {
      const txMock = {
        activoFijo: { update: vi.fn().mockResolvedValue({ id: targetId, estado: "DADO_DE_BAJA" }) },
        historialBaja: {
          create: vi.fn().mockResolvedValue({
            id: "baja-uuid-1",
            activoId: targetId,
            motivoBaja: validPayload.motivoBaja,
            valorEnLibrosAlBaja: 12500.0,
            fechaBaja: new Date("2026-02-15T00:00:00.000Z"),
            numeroActa: validPayload.numeroActa,
          }),
        },
      };
      return cb(txMock);
    });

    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/baja`, {
      method: "POST",
      body: JSON.stringify(validPayload),
    });
    const res = await procesarBaja(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.activoId).toBe(targetId);
    expect(body.estado).toBe("DADO_DE_BAJA");
    expect(body.motivoBaja).toBe("DANO_IRREPARABLE");
    expect(body.valorEnLibrosAlBaja).toBe(12500);
    expect(body.numeroActa).toBe("ACTA-BAJA-2026-004");
  });
});