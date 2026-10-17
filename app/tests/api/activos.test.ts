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
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    departamento: {
      findUnique: vi.fn(),
    },
    tipoActivo: {
      findUnique: vi.fn(),
    },
    empleado: {
      findUnique: vi.fn(),
    },
    historialCustodia: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock del generador correlativo de código
vi.mock("@/lib/services/asset-code.service", () => ({
  generarCodigoActivo: vi.fn().mockResolvedValue("ACT-2026-0001"),
}));

// Mock de validadores de bloqueo contable
vi.mock("@/lib/validators/asset-lock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/validators/asset-lock")>();
  return {
    ...actual,
    validarBloqueoFinanciero: vi.fn(),
    assertFinanciallyEditable: vi.fn(),
  };
});

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validarBloqueoFinanciero, assertFinanciallyEditable, FinancialLockError } from "@/lib/validators/asset-lock";
import { GET as getActivos, POST as createActivo } from "@/app/api/activos/route";
import { GET as getActivoById, PUT as updateActivo } from "@/app/api/activos/[id]/route";

describe("API Route Handlers - Activos Fijos (/api/activos)", () => {
  const adminUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000001",
      nombre: "Admin General",
      correo: "admin@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000001", codigo: "ADMIN", nombre: "Administrador General" },
      permisos: ["USER_ADMIN", "ACT_READ", "ACT_CREATE", "ACT_UPDATE", "ACT_TRANSFER", "ACT_DISPOSE"],
    },
  };

  const operadorUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000002",
      nombre: "Operador Activos",
      correo: "operador@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000002", codigo: "OPERADOR", nombre: "Operador de Activos" },
      permisos: ["ACT_READ", "ACT_CREATE", "ACT_UPDATE", "ACT_TRANSFER"],
    },
  };

  const readOnlyUserSession = {
    user: {
      id: "10000000-0000-4000-a000-000000000003",
      nombre: "Auditor Interno",
      correo: "auditor@unapec.edu.do",
      rol: { id: "20000000-0000-4000-a000-000000000003", codigo: "AUDITOR", nombre: "Auditor" },
      permisos: ["ACT_READ"],
    },
  };

  const mockActivo = {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
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
    createdAt: new Date("2026-01-15T10:00:00.000Z"),
    updatedAt: new Date("2026-01-15T10:00:00.000Z"),
    departamento: {
      id: "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
      codigo: "DEP-001",
      descripcion: "Tecnología de la Información",
    },
    tipoActivo: {
      id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
      codigo: "CAT-002",
      descripcion: "Equipos de Cómputo",
      porcentajeDepreciacionAnual: 25.0,
      cuentaContableCompra: "1-01-04-0002",
      cuentaContableDepreciacion: "1-01-04-0003",
    },
    empleado: {
      id: "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a",
      codigo: "EMP-0001",
      nombre: "Carlos",
      apellido: "Gómez",
      cedula: "001-0000001-9",
      cargo: "Especialista TI",
    },
    historialBaja: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/activos", () => {
    it("rechaza solicitud no autenticada con 401 Unauthorized", async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);
      const req = new NextRequest("http://localhost:3000/api/activos");
      const res = await getActivos(req);
      expect(res!.status).toBe(401);
      const body = await res!.json();
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("rechaza solicitud sin permiso ACT_READ con 403 Forbidden", async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: "usr-sin-permisos", permisos: ["CAT_READ"] },
      } as any);
      const req = new NextRequest("http://localhost:3000/api/activos");
      const res = await getActivos(req);
      expect(res!.status).toBe(403);
    });

    it("rechaza parámetros de consulta inválidos con 400 Bad Request", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      const req = new NextRequest("http://localhost:3000/api/activos?page=0&pageSize=999");
      const res = await getActivos(req);
      expect(res!.status).toBe(400);
      const body = await res!.json();
      expect(body.error).toBe("INVALID_QUERY_PARAMS");
    });

    it("retorna listado paginado y formateado exitosamente con 200 OK", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.activoFijo.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.activoFijo.findMany).mockResolvedValueOnce([mockActivo as any]);

      const req = new NextRequest("http://localhost:3000/api/activos?page=1&pageSize=10&search=Latitude");
      const res = await getActivos(req);
      expect(res!.status).toBe(200);
      const body = await res!.json();
      expect(body.pagination.total).toBe(1);
      expect(body.pagination.page).toBe(1);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].codigo).toBe("ACT-2026-0001");
      expect(body.data[0].costoAdquisicion).toBe(85000);
      expect(body.data[0].tipoActivo.porcentajeDepreciacionAnual).toBe(25);
    });
  });

  describe("POST /api/activos", () => {
    const validPayload = {
      descripcion: "Laptop Dell Latitude 5440 i7 16GB",
      tipoActivoId: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
      departamentoId: "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e",
      empleadoId: "d1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a",
      fechaAdquisicion: "2026-01-15",
      costoAdquisicion: 85000.0,
      valorResidual: 8500.0,
      marca: "Dell",
      modelo: "Latitude 5440",
      numeroSerie: "DL-99887766",
      ubicacionFisica: "Edificio 1 - Piso 3",
      color: "Gris",
    };

    it("rechaza usuarios sin rol OPERADOR ni ADMIN con 403 Forbidden", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      const req = new NextRequest("http://localhost:3000/api/activos", {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await createActivo(req);
      expect(res!.status).toBe(403);
    });

    it("rechaza payload con costo no positivo o residual mayor al costo con 422", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      const invalidPayload = {
        ...validPayload,
        costoAdquisicion: -100,
        valorResidual: 500,
      };
      const req = new NextRequest("http://localhost:3000/api/activos", {
        method: "POST",
        body: JSON.stringify(invalidPayload),
      });
      const res = await createActivo(req);
      expect(res!.status).toBe(422);
      const body = await res!.json();
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("rechaza si el departamento no existe o está inactivo con 400 Bad Request", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: validPayload.departamentoId,
        estado: "INACTIVO",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/activos", {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await createActivo(req);
      expect(res!.status).toBe(400);
      const body = await res!.json();
      expect(body.error).toBe("DEPARTMENT_INACTIVE");
    });

    it("rechaza si el empleado custodio está inactivo con 400 Bad Request", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: validPayload.departamentoId,
        estado: "ACTIVO",
      } as any);
      vi.mocked(prisma.tipoActivo.findUnique).mockResolvedValueOnce({
        id: validPayload.tipoActivoId,
        estado: "ACTIVO",
      } as any);
      vi.mocked(prisma.empleado.findUnique).mockResolvedValueOnce({
        id: validPayload.empleadoId,
        estado: "INACTIVO",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/activos", {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await createActivo(req);
      expect(res!.status).toBe(400);
      const body = await res!.json();
      expect(body.error).toBe("EMPLOYEE_NOT_ELIGIBLE");
    });

    it("crea activo e inserta custodia inicial en transacción atómica con 201 Created", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.departamento.findUnique).mockResolvedValueOnce({
        id: validPayload.departamentoId,
        estado: "ACTIVO",
      } as any);
      vi.mocked(prisma.tipoActivo.findUnique).mockResolvedValueOnce({
        id: validPayload.tipoActivoId,
        estado: "ACTIVO",
      } as any);
      vi.mocked(prisma.empleado.findUnique).mockResolvedValueOnce({
        id: validPayload.empleadoId,
        estado: "ACTIVO",
      } as any);

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (cb: any) => {
        const txMock = {
          activoFijo: { create: vi.fn().mockResolvedValue(mockActivo) },
          historialCustodia: { create: vi.fn().mockResolvedValue({ id: "cust-1" }) },
        };
        return cb(txMock);
      });

      const req = new NextRequest("http://localhost:3000/api/activos", {
        method: "POST",
        body: JSON.stringify(validPayload),
      });
      const res = await createActivo(req);
      expect(res!.status).toBe(201);
      const body = await res!.json();
      expect(body.codigo).toBe("ACT-2026-0001");
      expect(body.costoAdquisicion).toBe(85000);
    });
  });

  describe("GET /api/activos/[id]", () => {
    const targetId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

    it("rechaza identificador UUID inválido con 400 Bad Request", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      const req = new NextRequest(`http://localhost:3000/api/activos/id-invalido`);
      const res = await getActivoById(req, { params: Promise.resolve({ id: "id-invalido" }) });
      expect(res!.status).toBe(400);
      const body = await res!.json();
      expect(body.error).toBe("INVALID_ASSET_ID");
    });

    it("retorna 404 Not Found si el activo no existe", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}`);
      const res = await getActivoById(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(404);
      const body = await res!.json();
      expect(body.error).toBe("ASSET_NOT_FOUND");
    });

    it("retorna ficha técnica y poseeHistorialDepreciacion con 200 OK", async () => {
      vi.mocked(auth).mockResolvedValueOnce(readOnlyUserSession as any);
      vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce(mockActivo as any);
      vi.mocked(validarBloqueoFinanciero).mockResolvedValueOnce(false);

      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}`);
      const res = await getActivoById(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(200);
      const body = await res!.json();
      expect(body.codigo).toBe("ACT-2026-0001");
      expect(body.poseeHistorialDepreciacion).toBe(false);
      expect(body.tipoActivo.cuentaContableCompra).toBe("1-01-04-0002");
    });
  });

  describe("PUT /api/activos/[id]", () => {
    const targetId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    const updatePayload = {
      descripcion: "Laptop Dell Latitude 5440 i7 32GB RAM Upgrade",
      ubicacionFisica: "Torre A, Laboratorio 102",
    };

    it("rechaza edición en activo formalmente dado de baja con 400 Bad Request", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce({
        ...mockActivo,
        estado: "DADO_DE_BAJA",
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}`, {
        method: "PUT",
        body: JSON.stringify(updatePayload),
      });
      const res = await updateActivo(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(400);
      const body = await res!.json();
      expect(body.error).toBe("ASSET_DISPOSED_CANNOT_EDIT");
    });

    it("rechaza con 409 Conflict si se intentan alterar campos financieros de un activo depreciado", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce(mockActivo as any);
      vi.mocked(assertFinanciallyEditable).mockRejectedValueOnce(
        new FinancialLockError(["costoAdquisicion"])
      );

      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}`, {
        method: "PUT",
        body: JSON.stringify({ ...updatePayload, costoAdquisicion: 90000 }),
      });
      const res = await updateActivo(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(409);
      const body = await res!.json();
      expect(body.error).toBe("FINANCIAL_FIELDS_LOCKED");
      expect(body.camposBloqueados).toContain("costoAdquisicion");
    });

    it("actualiza exitosamente metadatos físicos con 200 OK", async () => {
      vi.mocked(auth).mockResolvedValueOnce(operadorUserSession as any);
      vi.mocked(prisma.activoFijo.findUnique).mockResolvedValueOnce(mockActivo as any);
      vi.mocked(assertFinanciallyEditable).mockResolvedValueOnce();
      vi.mocked(prisma.activoFijo.update).mockResolvedValueOnce({
        ...mockActivo,
        descripcion: updatePayload.descripcion,
        ubicacionFisica: updatePayload.ubicacionFisica,
        updatedAt: new Date("2026-01-16T12:00:00.000Z"),
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/activos/${targetId}`, {
        method: "PUT",
        body: JSON.stringify(updatePayload),
      });
      const res = await updateActivo(req, { params: Promise.resolve({ id: targetId }) });
      expect(res!.status).toBe(200);
      const body = await res!.json();
      expect(body.codigo).toBe("ACT-2026-0001");
      expect(body.descripcion).toBe(updatePayload.descripcion);
    });
  });
});