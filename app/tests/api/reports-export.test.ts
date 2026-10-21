import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findManyActivos: vi.fn(),
  aggregateActivos: vi.fn(),
  findManyCuotas: vi.fn(),
  aggregateCuotas: vi.fn(),
  createBitacora: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activoFijo: {
      findMany: mocks.findManyActivos,
      aggregate: mocks.aggregateActivos,
    },
    depreciacionMensual: {
      findMany: mocks.findManyCuotas,
      aggregate: mocks.aggregateCuotas,
    },
    bitacoraExportacion: {
      create: mocks.createBitacora,
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));

import { GET as exportHandler } from "@/app/api/reportes/export/route";

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

function buildActivoRow() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    codigo: "ACT-2026-0001",
    descripcion: "Laptop, Proyector 4K",
    numeroSerie: "DL-99887766",
    fechaAdquisicion: new Date("2026-03-14T00:00:00.000Z"),
    costoAdquisicion: new Prisma.Decimal("65000.00"),
    depreciacionAcumulada: new Prisma.Decimal("12000.00"),
    valorEnLibros: new Prisma.Decimal("53000.00"),
    estado: "ACTIVO",
    tipoActivo: { id: "t1", descripcion: "Equipos de Cómputo", vidaUtilMeses: 60 },
    departamento: { id: "d1", descripcion: "Tecnología" },
    empleado: { id: "e1", nombre: "María", apellido: "Rodríguez", cedula: "001-1234567-8" },
  };
}

function buildCuotaRow() {
  return {
    activoId: "11111111-1111-4111-8111-111111111111",
    periodoFiscal: "2026-10",
    cuotaMes: new Prisma.Decimal("1275.00"),
    depreciacionAcumuladaPost: new Prisma.Decimal("12000.00"),
    valorEnLibrosPost: new Prisma.Decimal("73000.00"),
    cuentaCompra: "1-01-04-0020",
    cuentaDepreciacion: "1-01-04-0021",
    activo: {
      codigo: "ACT-2026-0001",
      descripcion: "Laptop Dell",
      costoAdquisicion: new Prisma.Decimal("85000.00"),
      tipoActivo: { vidaUtilMeses: 60 },
    },
  };
}

function buildAggregateActivos(count: number, costo: string, dep: string) {
  return {
    _count: { _all: count },
    _sum: {
      costoAdquisicion: new Prisma.Decimal(costo),
      depreciacionAcumulada: new Prisma.Decimal(dep),
    },
  };
}

function buildAggregateCuotas(count: number) {
  return {
    _count: { _all: count },
    _sum: {
      cuotaMes: new Prisma.Decimal("55886.26"),
      depreciacionAcumuladaPost: new Prisma.Decimal("176000.00"),
      valorEnLibrosPost: new Prisma.Decimal("3100000.00"),
    },
  };
}

function makeRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/reportes/export${query}`);
}

describe("GET /api/reportes/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(adminSession);
    mocks.findManyActivos.mockResolvedValue([buildActivoRow()]);
    mocks.aggregateActivos.mockResolvedValue(buildAggregateActivos(1, "65000.00", "12000.00"));
    mocks.findManyCuotas.mockResolvedValue([buildCuotaRow()]);
    mocks.aggregateCuotas.mockResolvedValue(buildAggregateCuotas(29));
    mocks.createBitacora.mockResolvedValue({ id: "log-1" });
  });

  it("responde 401 sin sesión", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await exportHandler(makeRequest("?reporte=inventario&formato=xlsx"));
    expect(res.status).toBe(401);
  });

  it("responde 403 sin el permiso REP_READ", async () => {
    mocks.auth.mockResolvedValue(sinPermisoSession);
    const res = await exportHandler(makeRequest("?reporte=inventario&formato=xlsx"));
    expect(res.status).toBe(403);
  });

  it("responde 400 cuando el reporte o el formato son inválidos", async () => {
    const sinReporte = await exportHandler(makeRequest("?formato=xlsx"));
    expect(sinReporte.status).toBe(400);

    const formatoInvalido = await exportHandler(makeRequest("?reporte=inventario&formato=pdf"));
    const body = await formatoInvalido.json();
    expect(formatoInvalido.status).toBe(400);
    expect(body.errors.formato).toBeDefined();
  });

  it("responde 400 cuando la exportación de depreciación no incluye período", async () => {
    const res = await exportHandler(makeRequest("?reporte=depreciacion&formato=xlsx"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.errors.periodo).toContain("obligatorio");
  });

  it("precheck devuelve el total filtrado sin descargar archivo", async () => {
    const res = await exportHandler(makeRequest("?reporte=inventario&formato=xlsx&precheck=true"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      reporte: "inventario",
      formato: "xlsx",
      totalFiltrado: 1,
      maxRows: 10000,
      avisoTruncamiento: false,
    });
    expect(mocks.createBitacora).not.toHaveBeenCalled();
  });

  it("precheck marca avisoTruncamiento cuando el filtrado supera las 10,000 filas", async () => {
    mocks.aggregateActivos.mockResolvedValue(buildAggregateActivos(14382, "999000.00", "100000.00"));
    const res = await exportHandler(makeRequest("?reporte=inventario&formato=csv&precheck=true"));
    const body = await res.json();

    expect(body.avisoTruncamiento).toBe(true);
    expect(body.totalFiltrado).toBe(14382);
  });

  it("descarga XLSX con Content-Type y Content-Disposition correctos", async () => {
    const res = await exportHandler(makeRequest("?reporte=inventario&formato=xlsx"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="inventario-activos-\d{4}-\d{2}-\d{2}\.xlsx"$/
    );

    const buffer = Buffer.from(await res.arrayBuffer());
    // Firma ZIP de un XLSX válido
    expect(buffer.subarray(0, 2)).toEqual(Buffer.from([0x50, 0x4b]));
  });

  it("descarga CSV con BOM UTF-8 y datos filtrados", async () => {
    const res = await exportHandler(makeRequest("?reporte=inventario&formato=csv"));
    const bytes = Buffer.from(await res.arrayBuffer());
    const text = bytes.toString("utf8").replace("\uFEFF", "");

    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(text).toContain("ACT-2026-0001");
    expect(text).toContain("María Rodríguez");
    expect(text).toContain("TOTALES");
  });

  it("descarga el reporte de depreciación del período con totales", async () => {
    const res = await exportHandler(
      makeRequest("?reporte=depreciacion&formato=csv&periodo=2026-10")
    );
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("depreciacion-2026-10-");
    expect(text).toContain("1275.00");
    expect(text).toContain("Cuota del Mes");
  });

  it("registra la auditoría con usuario, IP, filtros y filas exportadas", async () => {
    await exportHandler(
      makeRequest(
        "?reporte=inventario&formato=xlsx&estados=ACTIVO&search=ACT-2026&departamentoId=3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607"
      )
    );

    expect(mocks.createBitacora).toHaveBeenCalledTimes(1);
    const data = mocks.createBitacora.mock.calls[0][0].data;
    expect(data).toMatchObject({
      usuarioId: adminSession.user.id,
      correoUsuario: "admin@unapec.edu.do",
      formato: "XLSX",
      reporte: "INVENTARIO",
      filasExportadas: 1,
      filtrosAplicados: {
        estados: ["ACTIVO"],
        search: "ACT-2026",
        departamentoId: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607",
      },
    });
  });

  it("no cancela la descarga si falla el registro de auditoría", async () => {
    mocks.createBitacora.mockRejectedValue(new Error("audit down"));

    const res = await exportHandler(makeRequest("?reporte=inventario&formato=csv"));
    expect(res.status).toBe(200);
    expect((await res.text()).length).toBeGreaterThan(0);
  });

  it("responde 500 EXPORT_FAILED problem+json si la consulta falla", async () => {
    mocks.findManyActivos.mockRejectedValue(new Error("boom"));
    const res = await exportHandler(makeRequest("?reporte=inventario&formato=xlsx"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.title).toBe("EXPORT_FAILED");
  });
});
