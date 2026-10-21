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
    activoFijo: {
      findMany: mocks.findMany,
      aggregate: mocks.aggregate,
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));

import { GET as inventarioHandler } from "@/app/api/reportes/inventario/route";

const adminSession = {
  user: {
    id: "10000000-0000-4000-a000-000000000001",
    nombre: "Administrador",
    correo: "admin@unapec.edu.pe",
    rol: { id: "20000000-0000-4000-a000-000000000001", codigo: "ADMIN", nombre: "Administrador" },
    permisos: ["REP_READ", "ACT_READ"],
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

const departamento = { id: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607", descripcion: "Tecnología" };
const tipoActivo = { id: "9a8b7c6d-5e4f-4321-8765-0f1e2d3c4b5a", descripcion: "Equipos de Cómputo", vidaUtilMeses: 60 };
const empleado = {
  id: "7d6c5b4a-3e2f-4a1b-9c8d-7e6f5a4b3c2d",
  nombre: "María",
  apellido: "Rodríguez",
  cedula: "001-1234567-8",
};

function buildRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    codigo: "ACT-2026-0001",
    descripcion: "Laptop, Proyector 4K",
    numeroSerie: "DL-99887766",
    fechaAdquisicion: new Date("2026-03-14T00:00:00.000Z"),
    costoAdquisicion: new Prisma.Decimal("65000.00"),
    valorResidual: new Prisma.Decimal("6500.00"),
    depreciacionAcumulada: new Prisma.Decimal("12000.00"),
    valorEnLibros: new Prisma.Decimal("53000.00"),
    estado: "ACTIVO",
    tipoActivo,
    departamento,
    empleado,
    ...overrides,
  };
}

function buildAggregate(count: number, costo: string, depreciacion: string) {
  return {
    _count: { _all: count },
    _sum: {
      costoAdquisicion: count === 0 ? null : new Prisma.Decimal(costo),
      depreciacionAcumulada: count === 0 ? null : new Prisma.Decimal(depreciacion),
    },
  };
}

function makeRequest(query = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/reportes/inventario${query}`);
}

describe("GET /api/reportes/inventario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(adminSession);
    mocks.findMany.mockResolvedValue([buildRow()]);
    mocks.aggregate.mockResolvedValue(buildAggregate(1, "65000.00", "12000.00"));
  });

  // ---------------------------------------------------------------- seguridad
  it("responde 401 sin sesión autenticada", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await inventarioHandler(makeRequest());
    expect(res.status).toBe(401);
  });

  it("responde 403 sin el permiso REP_READ", async () => {
    mocks.auth.mockResolvedValue(sinPermisoSession);
    const res = await inventarioHandler(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe("FORBIDDEN");
  });

  it("permite el acceso a un AUDITOR con REP_READ", async () => {
    mocks.auth.mockResolvedValue(auditorSession);
    const res = await inventarioHandler(makeRequest());
    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------- validaciones
  it("responde 400 cuando fechaFin es anterior a fechaInicio", async () => {
    const res = await inventarioHandler(makeRequest("?fechaInicio=2026-06-01&fechaFin=2026-05-01"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.title).toBe("VALIDATION_ERROR");
    expect(body.errors.fechaFin).toContain("La fecha final no puede ser anterior");
  });

  it("responde 400 cuando montoMax es menor a montoMin", async () => {
    const res = await inventarioHandler(makeRequest("?montoMin=90000&montoMax=1000"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.errors.montoMax).toContain("El monto máximo no puede ser menor");
  });

  it("responde 400 con sort fuera de la whitelist", async () => {
    const res = await inventarioHandler(makeRequest("?sort=passwordHash"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.errors.sort).toBeDefined();
  });

  it("responde 400 con pageSize no permitido", async () => {
    const res = await inventarioHandler(makeRequest("?pageSize=37"));
    expect(res.status).toBe(400);
  });

  it("responde 400 con estado desconocido", async () => {
    const res = await inventarioHandler(makeRequest("?estados=VENDIDO"));
    expect(res.status).toBe(400);
  });

  it("responde 400 con departamentoId que no es UUID", async () => {
    const res = await inventarioHandler(makeRequest("?departamentoId=DEP-001"));
    expect(res.status).toBe(400);
  });

  // ----------------------------------------------------------- consulta básica
  it("aplica defaults: page=1, pageSize=25, sort=codigo, dir=asc", async () => {
    const res = await inventarioHandler(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.meta).toMatchObject({ page: 1, pageSize: 25, sort: "codigo", dir: "asc" });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 25, orderBy: { codigo: "asc" } })
    );
  });

  it("traduce el rango de fechas a filtros gte/lte inclusivos", async () => {
    await inventarioHandler(makeRequest("?fechaInicio=2026-01-01&fechaFin=2026-12-31"));
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({
      fechaAdquisicion: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-12-31T00:00:00.000Z"),
      },
    });
  });

  it("traduce el rango de montos a Decimal gte/lte", async () => {
    await inventarioHandler(makeRequest("?montoMin=50000.25&montoMax=800000.75"));
    const where = mocks.findMany.mock.calls[0][0].where;
    const montoFilter = where.AND.find((clause: any) => clause.costoAdquisicion);
    expect(montoFilter.costoAdquisicion.gte.toString()).toBe("50000.25");
    expect(montoFilter.costoAdquisicion.lte.toString()).toBe("800000.75");
  });

  it("filtra por departamento y tipo de activo", async () => {
    await inventarioHandler(
      makeRequest(`?departamentoId=${departamento.id}&tipoActivoId=${tipoActivo.id}`)
    );
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([
        { departamentoId: departamento.id },
        { tipoActivoId: tipoActivo.id },
      ])
    );
  });

  it("acepta estados repetidos en la URL (multi-select)", async () => {
    await inventarioHandler(makeRequest("?estados=ACTIVO&estados=EN_MANTENIMIENTO"));
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([{ estado: { in: ["ACTIVO", "EN_MANTENIMIENTO"] } }])
    );
  });

  it("acepta estados separados por coma", async () => {
    await inventarioHandler(makeRequest("?estados=ACTIVO,DADO_DE_BAJA"));
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual(
      expect.arrayContaining([{ estado: { in: ["ACTIVO", "DADO_DE_BAJA"] } }])
    );
  });

  it("busca custodio por nombre, apellido o cédula (case-insensitive)", async () => {
    await inventarioHandler(makeRequest("?custodio=001-123"));
    const where = mocks.findMany.mock.calls[0][0].where;
    const custodioClause = where.AND.find((clause: any) => clause.empleado);
    expect(custodioClause.empleado.OR).toHaveLength(3);
    expect(custodioClause.empleado.OR[0].nombre).toMatchObject({ contains: "001-123", mode: "insensitive" });
  });

  it("busca por código, descripción o número de serie", async () => {
    await inventarioHandler(makeRequest("?search=ACT-2026"));
    const where = mocks.findMany.mock.calls[0][0].where;
    const searchClause = where.AND.find((clause: any) => clause.OR);
    expect(searchClause.OR.map((c: any) => Object.keys(c)[0])).toEqual([
      "codigo",
      "descripcion",
      "numeroSerie",
    ]);
  });

  it("ordena por costo descendente", async () => {
    await inventarioHandler(makeRequest("?sort=costo&dir=desc"));
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { costoAdquisicion: "desc" } })
    );
  });

  it("ordena por fecha ascendente", async () => {
    await inventarioHandler(makeRequest("?sort=fecha&dir=asc"));
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { fechaAdquisicion: "asc" } })
    );
  });

  // -------------------------------------------------------------------- KPIs
  it("calcula los KPIs sobre el total filtrado con aritmética exacta", async () => {
    mocks.findMany.mockResolvedValue([buildRow()]);
    mocks.aggregate.mockResolvedValue(buildAggregate(132, "8450000.50", "1250000.25"));

    const res = await inventarioHandler(makeRequest("?page=2&pageSize=25"));
    const body = await res.json();

    expect(body.kpis).toEqual({
      cantidadActivos: 132,
      costoTotalAdquisicion: "8450000.50",
      depreciacionAcumulada: "1250000.25",
      valorEnLibrosTotal: "7200000.25",
    });
  });

  it("calcula KPIs con el caso de aceptación del REQ-REP-002 (400,000 / 40,000 / 360,000)", async () => {
    mocks.aggregate.mockResolvedValue(buildAggregate(3, "400000.00", "40000.00"));

    const res = await inventarioHandler(makeRequest());
    const body = await res.json();

    expect(body.kpis).toEqual({
      cantidadActivos: 3,
      costoTotalAdquisicion: "400000.00",
      depreciacionAcumulada: "40000.00",
      valorEnLibrosTotal: "360000.00",
    });
  });

  it("devuelve KPIs en cero y totalPages 0 cuando no hay resultados", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.aggregate.mockResolvedValue(buildAggregate(0, "0", "0"));

    const res = await inventarioHandler(makeRequest());
    const body = await res.json();

    expect(body.kpis).toEqual({
      cantidadActivos: 0,
      costoTotalAdquisicion: "0.00",
      depreciacionAcumulada: "0.00",
      valorEnLibrosTotal: "0.00",
    });
    expect(body.meta.totalPages).toBe(0);
    expect(body.data).toEqual([]);
  });

  // -------------------------------------------------------------- paginación
  it("pagina server-side: página 2 de 47 con pageSize 25", async () => {
    mocks.aggregate.mockResolvedValue(buildAggregate(47, "1000.00", "100.00"));
    mocks.findMany.mockResolvedValue([buildRow()]);

    const res = await inventarioHandler(makeRequest("?page=2&pageSize=25"));
    const body = await res.json();

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 25 }));
    expect(body.meta).toMatchObject({ page: 2, pageSize: 25, total: 47, totalPages: 2 });
  });

  it("hace clamp a la última página válida cuando la página solicitada se desborda", async () => {
    mocks.aggregate.mockResolvedValue(buildAggregate(30, "1000.00", "100.00"));
    mocks.findMany.mockResolvedValue([buildRow()]);

    const res = await inventarioHandler(makeRequest("?page=99&pageSize=25"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.page).toBe(2);
    expect(mocks.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 25 }));
  });

  // --------------------------------------------------------------- mapeo DTO
  it("mapea la fila al contrato de respuesta (cifras string, fecha ISO, custodio completo)", async () => {
    const res = await inventarioHandler(makeRequest());
    const body = await res.json();

    expect(body.data[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      codigo: "ACT-2026-0001",
      descripcion: "Laptop, Proyector 4K",
      numeroSerie: "DL-99887766",
      fechaAdquisicion: "2026-03-14",
      costoAdquisicion: "65000.00",
      depreciacionAcumulada: "12000.00",
      valorEnLibros: "53000.00",
      estado: "ACTIVO",
      tipoActivo: { id: tipoActivo.id, descripcion: "Equipos de Cómputo", vidaUtilMeses: 60 },
      departamento: { id: departamento.id, descripcion: "Tecnología" },
      custodio: { id: empleado.id, nombre: "María Rodríguez", cedula: "001-1234567-8" },
    });
  });

  it("redondea Half-Up las cifras de 2 decimales con floating point", async () => {
    mocks.findMany.mockResolvedValue([
      buildRow({
        costoAdquisicion: new Prisma.Decimal("1000.005"),
        valorEnLibros: new Prisma.Decimal("999.994999"),
      }),
    ]);

    const res = await inventarioHandler(makeRequest());
    const body = await res.json();

    expect(body.data[0].costoAdquisicion).toBe("1000.01");
    expect(body.data[0].valorEnLibros).toBe("999.99");
  });

  it("responde 500 problem+json si la consulta falla inesperadamente", async () => {
    mocks.findMany.mockRejectedValue(new Error("boom"));
    const res = await inventarioHandler(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.title).toBe("INTERNAL_ERROR");
  });
});
