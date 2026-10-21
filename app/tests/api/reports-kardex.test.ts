import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUniqueActivo: vi.fn(),
  findManyHistorial: vi.fn(),
  findManyCuotas: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activoFijo: { findUnique: mocks.findUniqueActivo },
    historialCustodia: { findMany: mocks.findManyHistorial },
    depreciacionMensual: { findMany: mocks.findManyCuotas },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));

import { GET as kardexHandler } from "@/app/api/reportes/activos/[id]/kardex/route";

const ACTIVO_ID = "11111111-1111-4111-8111-111111111111";

const adminSession = {
  user: {
    id: "10000000-0000-4000-a000-000000000001",
    nombre: "Administrador",
    correo: "admin@unapec.edu.do",
    rol: { id: "20000000-0000-4000-a000-000000000001", codigo: "ADMIN", nombre: "Administrador" },
    permisos: ["REP_READ"],
  },
};

const sinPermisoSession = {
  user: {
    id: "10000000-0000-4000-a000-000000000004",
    nombre: "Sin permisos",
    correo: "sin.permiso@unapec.edu.do",
    rol: { id: "20000000-0000-4000-a000-000000000004", codigo: "OPERADOR", nombre: "Operador" },
    permisos: [],
  },
};

function buildActivo(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVO_ID,
    codigo: "ACT-2026-0001",
    descripcion: "Laptop Dell Latitude",
    estado: "ACTIVO",
    numeroSerie: "DL-5440-998811",
    fechaAdquisicion: new Date("2026-01-10T00:00:00.000Z"),
    costoAdquisicion: new Prisma.Decimal("85000.00"),
    depreciacionAcumulada: new Prisma.Decimal("12000.00"),
    valorEnLibros: new Prisma.Decimal("73000.00"),
    tipoActivo: { descripcion: "Equipos de Cómputo" },
    departamento: { descripcion: "Tecnología" },
    empleado: { nombre: "María", apellido: "Rodríguez" },
    historialBaja: null,
    ...overrides,
  };
}

function buildHistorialEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    activoId: ACTIVO_ID,
    motivo: "TRASLADO",
    justificacion: "Reasignación por rotación de puesto de trabajo",
    createdAt: new Date("2026-05-02T14:35:12.000Z"),
    empleadoAnterior: { nombre: "María", apellido: "Rodríguez" },
    empleadoNuevo: { nombre: "Juan", apellido: "Pérez" },
    departamentoAnterior: { descripcion: "Tecnología" },
    departamentoNuevo: { descripcion: "Contabilidad" },
    autorizadoPor: { correo: "operador@unapec.edu.do" },
    ...overrides,
  };
}

function buildCuota(periodo: string, cuota: string, acumulada: string, valor: string) {
  return {
    periodoFiscal: periodo,
    cuotaMes: new Prisma.Decimal(cuota),
    depreciacionAcumuladaPost: new Prisma.Decimal(acumulada),
    valorEnLibrosPost: new Prisma.Decimal(valor),
  };
}

function makeRequest(id = ACTIVO_ID): NextRequest {
  return new NextRequest(`http://localhost:3000/api/reportes/activos/${id}/kardex`);
}

function context(id = ACTIVO_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/reportes/activos/[id]/kardex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(adminSession);
    mocks.findUniqueActivo.mockResolvedValue(buildActivo());
    mocks.findManyHistorial.mockResolvedValue([
      buildHistorialEntry(),
      buildHistorialEntry({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        motivo: "ALTA_INICIAL",
        justificacion: "Asignación patrimonial inicial",
        createdAt: new Date("2026-01-10T09:00:00.000Z"),
        empleadoAnterior: null,
        empleadoNuevo: { nombre: "María", apellido: "Rodríguez" },
        departamentoAnterior: null,
        departamentoNuevo: { descripcion: "Tecnología" },
      }),
    ]);
    mocks.findManyCuotas.mockResolvedValue([
      buildCuota("2026-10", "1275.00", "12000.00", "73000.00"),
      buildCuota("2026-09", "1275.00", "10725.00", "74275.00"),
    ]);
  });

  it("responde 401 sin sesión", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await kardexHandler(makeRequest(), context());
    expect(res.status).toBe(401);
  });

  it("responde 403 sin REP_READ", async () => {
    mocks.auth.mockResolvedValue(sinPermisoSession);
    const res = await kardexHandler(makeRequest(), context());
    expect(res.status).toBe(403);
  });

  it("responde 400 cuando el id no es un UUID válido", async () => {
    mocks.auth.mockResolvedValue(adminSession);
    const res = await kardexHandler(makeRequest("no-es-uuid"), context("no-es-uuid"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.title).toBe("VALIDATION_ERROR");
  });

  it("responde 404 ASSET_NOT_FOUND cuando el activo no existe", async () => {
    mocks.findUniqueActivo.mockResolvedValue(null);
    const res = await kardexHandler(makeRequest(), context());
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.title).toBe("ASSET_NOT_FOUND");
  });

  it("devuelve la ficha del activo con sus datos reales", async () => {
    const res = await kardexHandler(makeRequest(), context());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.activo).toMatchObject({
      id: ACTIVO_ID,
      codigo: "ACT-2026-0001",
      estado: "ACTIVO",
      numeroSerie: "DL-5440-998811",
      fechaAdquisicion: "2026-01-10",
      costoAdquisicion: "85000.00",
      depreciacionAcumulada: "12000.00",
      valorEnLibros: "73000.00",
      tipoActivo: "Equipos de Cómputo",
      departamento: "Tecnología",
      custodio: "María Rodríguez",
      bajaInfo: null,
    });
  });

  it("compone la timeline cronológica descendente con custodios y departamentos origen/destino", async () => {
    const res = await kardexHandler(makeRequest(), context());
    const body = await res.json();

    expect(body.timeline).toHaveLength(2);
    expect(body.timeline[0]).toMatchObject({
      tipo: "TRASLADO",
      custodioAnterior: "María Rodríguez",
      custodioNuevo: "Juan Pérez",
      departamentoAnterior: "Tecnología",
      departamentoNuevo: "Contabilidad",
      usuario: "operador@unapec.edu.do",
    });
    expect(body.timeline[1]).toMatchObject({ tipo: "ALTA_INICIAL", custodioAnterior: null });
    expect(mocks.findManyHistorial).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });

  it("devuelve las cuotas de depreciación ordenadas por período descendente", async () => {
    const res = await kardexHandler(makeRequest(), context());
    const body = await res.json();

    expect(body.cuotas).toEqual([
      { periodo: "2026-10", cuotaMes: "1275.00", depreciacionAcumulada: "12000.00", valorEnLibros: "73000.00" },
      { periodo: "2026-09", cuotaMes: "1275.00", depreciacionAcumulada: "10725.00", valorEnLibros: "74275.00" },
    ]);
    expect(mocks.findManyCuotas).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { periodoFiscal: "desc" } })
    );
  });

  it("incluye bajaInfo cuando el activo está desincorporado", async () => {
    mocks.findUniqueActivo.mockResolvedValue(
      buildActivo({
        estado: "DADO_DE_BAJA",
        historialBaja: {
          motivoBaja: "DANO_IRREPARABLE",
          justificacion: "Falla catastrófica sin repuesto en el mercado",
          numeroActa: "ACTA-BAJA-2026-001",
          fechaBaja: new Date("2026-02-28T00:00:00.000Z"),
          valorEnLibrosAlBaja: new Prisma.Decimal("15000.00"),
        },
      })
    );

    const res = await kardexHandler(makeRequest(), context());
    const body = await res.json();

    expect(body.activo.bajaInfo).toEqual({
      motivoBaja: "DANO_IRREPARABLE",
      justificacion: "Falla catastrófica sin repuesto en el mercado",
      numeroActa: "ACTA-BAJA-2026-001",
      fechaBaja: "2026-02-28",
      valorEnLibrosAlBaja: "15000.00",
    });
  });

  it("responde 200 con timeline vacía si el activo aún no tiene movimientos", async () => {
    mocks.findManyHistorial.mockResolvedValue([]);
    mocks.findManyCuotas.mockResolvedValue([]);

    const res = await kardexHandler(makeRequest(), context());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.timeline).toEqual([]);
    expect(body.cuotas).toEqual([]);
  });

  it("responde 500 problem+json ante un fallo inesperado", async () => {
    mocks.findUniqueActivo.mockRejectedValue(new Error("boom"));
    const res = await kardexHandler(makeRequest(), context());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.title).toBe("INTERNAL_ERROR");
  });
});
