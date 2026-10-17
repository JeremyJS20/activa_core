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
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GET as getActaEntrega } from "@/app/api/activos/[id]/acta-entrega/route";

describe("API Route Handler - Emisión de Acta de Entrega en PDF (/api/activos/[id]/acta-entrega)", () => {
  const operadorUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000002",
      nombre: "Operador Activos",
      correo: "operador@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000002", codigo: "OPERADOR", nombre: "Operador de Activos" },
      permisos: ["ACT_READ", "ACT_CREATE"],
    },
  };

  const targetId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
  const movimientoId = "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e";

  const mockActivo = {
    id: targetId,
    codigo: "ACT-2026-0001",
    descripcion: "Laptop Dell Latitude 5440 i7 16GB",
    costoAdquisicion: 85000.0,
    valorResidual: 8500.0,
    depreciacionAcumulada: 0.0,
    valorEnLibros: 85000.0,
    estado: "ACTIVO",
    marca: "Dell",
    modelo: "Latitude 5440",
    numeroSerie: "DL-99887766",
    ubicacionFisica: "Edificio 1 - Piso 3",
    color: "Gris",
    fechaAdquisicion: new Date("2026-01-15T00:00:00.000Z"),
    departamento: {
      id: "dept-1",
      codigo: "DEP-001",
      descripcion: "Tecnología de la Información",
    },
    tipoActivo: {
      id: "tipo-1",
      codigo: "CAT-002",
      descripcion: "Equipos de Cómputo",
    },
    empleado: {
      id: "emp-1",
      codigo: "EMP-0001",
      nombre: "Carlos",
      apellido: "Gómez",
      cedula: "00100000019",
      cargo: "Especialista TI",
    },
  };

  const mockMovimiento = {
    id: movimientoId,
    activoId: targetId,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    empleadoNuevo: mockActivo.empleado,
    departamentoNuevo: mockActivo.departamento,
    autorizadoPor: {
      id: "admin-1",
      nombre: "Lic. Jeremy Sánchez",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza solicitud no autenticada con 401 Unauthorized", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);
    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/acta-entrega`);
    const res = await getActaEntrega(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(401);
  });

  it("rechaza solicitud sin permiso con 403 Forbidden", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "usr-sin-permisos", permisos: ["CAT_WRITE"] },
    } as any);
    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/acta-entrega`);
    const res = await getActaEntrega(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(403);
  });

  it("rechaza ID de activo no válido con 400 Bad Request", async () => {
    vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
    const req = new NextRequest(`http://localhost:3000/api/activos/id-invalido/acta-entrega`);
    const res = await getActaEntrega(req, { params: Promise.resolve({ id: "id-invalido" }) });
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toBe("INVALID_ASSET_ID");
  });

  it("rechaza movimientoId no válido con 400 Bad Request", async () => {
    vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/acta-entrega?movimientoId=invalido`);
    const res = await getActaEntrega(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(400);
    const body = await res!.json();
    expect(body.error).toBe("INVALID_MOVEMENT_ID");
  });

  it("retorna 404 si el activo no existe", async () => {
    vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
    vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/acta-entrega`);
    const res = await getActaEntrega(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(404);
    const body = await res!.json();
    expect(body.error).toBe("ASSET_NOT_FOUND");
  });

  it("retorna 404 si el movimiento no pertenece al activo", async () => {
    vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
    vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce(mockActivo as any);
    vi.mocked(prisma.historialCustodia.findUnique).mockResolvedValueOnce({
      ...mockMovimiento,
      activoId: "otro-activo-id",
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/acta-entrega?movimientoId=${movimientoId}`);
    const res = await getActaEntrega(req, { params: Promise.resolve({ id: targetId }) });
    expect(res!.status).toBe(404);
    const body = await res!.json();
    expect(body.error).toBe("TRANSFER_RECORD_NOT_FOUND");
  });

  it("genera documento PDF válido con cabeceras correctas y firma binaria con 200 OK", async () => {
    vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
    vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce(mockActivo as any);
    vi.mocked(prisma.historialCustodia.findFirst).mockResolvedValueOnce(mockMovimiento as any);

    const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}/acta-entrega`);
    const res = await getActaEntrega(req, { params: Promise.resolve({ id: targetId }) });

    expect(res!.status).toBe(200);
    expect(res!.headers.get("Content-Type")).toBe("application/pdf");
    expect(res!.headers.get("Content-Disposition")).toContain("Acta-Custodia-ACT-2026-0001.pdf");

    const arrayBuffer = await res!.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    expect(buffer.length).toBeGreaterThan(500);
    // Verificación de la firma mágica del estándar PDF (%PDF-)
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});