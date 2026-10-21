import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  aggregate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    depreciacionMensual: {
      findMany: mocks.findMany,
      aggregate: mocks.aggregate,
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));

import { GET as depreciacionHandler } from "@/app/api/reportes/depreciacion/route";

const adminSession = {
  user: {
    id: "10000000-0000-4000-a000-000000000001",
    nombre: "Administrador",
    correo: "admin@unapec.edu.do",
    rol: { id: "20000000-0000-4000-a000-000000000001", codigo: "ADMIN", nombre: "Administrador" },
    permisos: ["REP_READ"],
  },
};

const auditorSession = {
  user: {
    id: "10000000-0000-4000-a000-000000000003",
    nombre: "Auditor",
    correo: "auditor@unapec.edu.do",
    rol: { id: "20000000-0000-4000-a000-000000000003", codigo: "AUDITOR", nombre: "Auditor" },
    permisos: ["REP_READ"],
  },
};

const sinPermisoSession = {
  user: {
    id: "10000000-0000-4000-a000-000000000004",
    nombre: "Sin permisos",
    correo: "sin.permiso@unapec.edu.do",
    rol: { id: "20000000-0000-4000-a000-000000000004", codigo: "OPERADOR", nombre: "Operador" },
    permisos: ["CAT_READ"],
  },
};

function buildCuota(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    activoId: "11111111-1111-4111-8111-111111111111",
    periodoFiscal: "2026-10",
    cuotaMes: new Prisma.Decimal("1275.00"),
    depreciacionAcumuladaPost: new Prisma.Decimal("12000.00"),
    valorEnLibrosPost: new Prisma.Decimal("73000.00"),
    cuentaCompra: "1-01-04-0020",
    cuentaDepreciacion: "1-01-04-0021",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    activo: {
      codigo: "ACT-2026-0001",
      descripcion: "Laptop Dell Latitude",
      costoAdquisicion: new Prisma.Decimal("85000.00"),
      tipoActivo: { vidaUtilMeses: 60 },
    },
    ...overrides,
  };
}

function buildAggregate(count: number, cuota: string, dep: string, valor: string) {
  return {
    _count: { _all: count },
    _sum: {
      cuotaMes: count === 0 ? null : new Prisma.Decimal(cuota),
      depreciacionAcumuladaPost: count === 0 ? null : new Prisma.Decimal(dep),
      valorEnLibrosPost: count === 0 ? null : new Prisma.Decimal(valor),
    },
  };
}

function makeRequest(query = "?periodo=2026-10"): NextRequest {
  return new NextRequest(`http://localhost:3000/api/reportes/depreciacion${query}`);
}

describe("GET /api/reportes/depreciacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(adminSession);
    mocks.findMany.mockResolvedValue([buildCuota()]);
    mocks.aggregate.mockResolvedValue(
      buildAggregate(29, "55886.26", "176000.00", "3100000.00")
    );
  });

  it("responde 401 sin sesión", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await depreciacionHandler(makeRequest());
    expect(res.status).toBe(401);
  });

  it("responde 403 sin el permiso REP_READ", async () => {
    mocks.auth.mockResolvedValue(sinPermisoSession);
    const res = await depreciacionHandler(makeRequest());
    expect(res.status).toBe(403);
  });

  it("permite consulta a un AUDITOR con REP_READ", async () => {
    mocks.auth.mockResolvedValue(auditorSession);
    const res = await depreciacionHandler(makeRequest());
    expect(res.status).toBe(200);
  });

  it("responde 400 cuando falta el período", async () => {
    const res = await depreciacionHandler(makeRequest(""));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.errors.periodo).toBeDefined();
  });

  it("responde 400 con período fuera de rango (2026-13)", async () => {
    const res = await depreciacionHandler(makeRequest("?periodo=2026-13"));
    expect(res.status).toBe(400);
  });

  it("responde 400 con cuenta contable mal formada", async () => {
    const res = await depreciacionHandler(makeRequest("?periodo=2026-10&cuentaCompra=101040020"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.errors.cuentaCompra).toBeDefined();
  });

  it("filtra por período y devuelve los totales del corte", async () => {
    const res = await depreciacionHandler(makeRequest("?periodo=2026-10"));
    const body = await res.json();

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodoFiscal: "2026-10" },
        orderBy: [{ activo: { codigo: "asc" } }, { activoId: "asc" }],
      })
    );
    expect(body.totales).toEqual({
      cuotaTotalMes: "55886.26",
      depreciacionAcumuladaTotal: "176000.00",
      valorEnLibrosTotal: "3100000.00",
    });
    expect(body.meta).toMatchObject({ periodo: "2026-10", total: 29, sinProceso: false });
  });

  it("aplica filtros de cuenta de compra y de depreciación cuando se envían", async () => {
    await depreciacionHandler(
      makeRequest(
        "?periodo=2026-10&cuentaCompra=1-01-04-0020&cuentaDepreciacion=1-01-04-0021"
      )
    );
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      periodoFiscal: "2026-10",
      cuentaCompra: "1-01-04-0020",
      cuentaDepreciacion: "1-01-04-0021",
    });
  });

  it("marca sinProceso=true y retorna datos vacíos cuando el período no tiene cuotas", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.aggregate.mockResolvedValue(buildAggregate(0, "0", "0", "0"));

    const res = await depreciacionHandler(makeRequest("?periodo=2025-03"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta).toMatchObject({ periodo: "2025-03", total: 0, sinProceso: true });
    expect(body.totales).toEqual({
      cuotaTotalMes: "0.00",
      depreciacionAcumuladaTotal: "0.00",
      valorEnLibrosTotal: "0.00",
    });
    expect(body.data).toEqual([]);
  });

  it("mapea el detalle por activo con cifras string y datos del activo real", async () => {
    const res = await depreciacionHandler(makeRequest());
    const body = await res.json();

    expect(body.data[0]).toMatchObject({
      activoId: "11111111-1111-4111-8111-111111111111",
      codigo: "ACT-2026-0001",
      descripcion: "Laptop Dell Latitude",
      vidaUtilMeses: 60,
      costoOriginal: "85000.00",
      cuotaMes: "1275.00",
      depreciacionAcumuladaHistorica: "12000.00",
      valorEnLibros: "73000.00",
      cuentaCompra: "1-01-04-0020",
      cuentaDepreciacion: "1-01-04-0021",
    });
  });

  it("pagina server-side el detalle del período", async () => {
    mocks.aggregate.mockResolvedValue(buildAggregate(88, "55886.26", "176000.00", "3100000.00"));
    const res = await depreciacionHandler(makeRequest("?periodo=2026-10&page=2&pageSize=25"));
    const body = await res.json();

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 25 }));
    expect(body.meta).toMatchObject({ page: 2, totalPages: 4 });
  });

  it("responde 500 problem+json ante un fallo inesperado de la base", async () => {
    mocks.findMany.mockRejectedValue(new Error("boom"));
    const res = await depreciacionHandler(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.title).toBe("INTERNAL_ERROR");
  });
});
