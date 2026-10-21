import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findManyActivos: vi.fn(),
  aggregateActivos: vi.fn(),
  findUniqueActivo: vi.fn(),
  findManyHistorial: vi.fn(),
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
      findUnique: mocks.findUniqueActivo,
    },
    depreciacionMensual: {
      findMany: mocks.findManyCuotas,
      aggregate: mocks.aggregateCuotas,
    },
    historialCustodia: { findMany: mocks.findManyHistorial },
    bitacoraExportacion: { create: mocks.createBitacora },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  },
}));

import { GET as inventarioHandler } from "@/app/api/reportes/inventario/route";
import { GET as depreciacionHandler } from "@/app/api/reportes/depreciacion/route";
import { GET as kardexHandler } from "@/app/api/reportes/activos/[id]/kardex/route";
import { GET as exportHandler } from "@/app/api/reportes/export/route";

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
    permisos: ["CAT_READ", "ACT_READ"],
  },
};

interface EndpointCase {
  name: string;
  url: string;
  invoke: (req: NextRequest) => Promise<Response>;
}

const endpoints: EndpointCase[] = [
  {
    name: "GET /api/reportes/inventario",
    url: "http://localhost:3000/api/reportes/inventario",
    invoke: (req) => inventarioHandler(req),
  },
  {
    name: "GET /api/reportes/depreciacion",
    url: "http://localhost:3000/api/reportes/depreciacion?periodo=2026-10",
    invoke: (req) => depreciacionHandler(req),
  },
  {
    name: "GET /api/reportes/activos/[id]/kardex",
    url: `http://localhost:3000/api/reportes/activos/${ACTIVO_ID}/kardex`,
    invoke: (req) =>
      kardexHandler(req, { params: Promise.resolve({ id: ACTIVO_ID }) }),
  },
  {
    name: "GET /api/reportes/export",
    url: "http://localhost:3000/api/reportes/export?reporte=inventario&formato=csv",
    invoke: (req) => exportHandler(req),
  },
];

function activatePrismaFixtures() {
  mocks.findManyActivos.mockResolvedValue([]);
  mocks.aggregateActivos.mockResolvedValue({
    _count: { _all: 0 },
    _sum: { costoAdquisicion: null, depreciacionAcumulada: null },
  });
  mocks.findUniqueActivo.mockResolvedValue({
    id: ACTIVO_ID,
    codigo: "ACT-2026-0001",
    descripcion: "Laptop",
    estado: "ACTIVO",
    numeroSerie: null,
    fechaAdquisicion: new Date("2026-01-10T00:00:00.000Z"),
    costoAdquisicion: new Prisma.Decimal("100.00"),
    depreciacionAcumulada: new Prisma.Decimal("0.00"),
    valorEnLibros: new Prisma.Decimal("100.00"),
    tipoActivo: { descripcion: "Equipos" },
    departamento: { descripcion: "TI" },
    empleado: { nombre: "María", apellido: "Rodríguez" },
    historialBaja: null,
  });
  mocks.findManyHistorial.mockResolvedValue([]);
  mocks.findManyCuotas.mockResolvedValue([]);
  mocks.aggregateCuotas.mockResolvedValue({
    _count: { _all: 0 },
    _sum: { cuotaMes: null, depreciacionAcumuladaPost: null, valorEnLibrosPost: null },
  });
  mocks.createBitacora.mockResolvedValue({ id: "log-1" });
}

describe("Seguridad del Sub-módulo 04 (RBAC dual-check + GET-only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(adminSession);
    activatePrismaFixtures();
  });

  it.each(endpoints)("$name responde 401 sin sesión", async (endpoint) => {
    mocks.auth.mockResolvedValue(null);
    const res = await endpoint.invoke(new NextRequest(endpoint.url));
    expect(res.status).toBe(401);
  });

  it.each(endpoints)("$name responde 403 sin el permiso REP_READ", async (endpoint) => {
    mocks.auth.mockResolvedValue(sinPermisoSession);
    const res = await endpoint.invoke(new NextRequest(endpoint.url));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe("FORBIDDEN");
  });

  it.each(endpoints)("$name responde 405 para métodos de mutación", async (endpoint) => {
    for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
      const res = await endpoint.invoke(new NextRequest(endpoint.url, { method }));
      const body = await res.json();
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("GET");
      expect(body.title).toBe("METHOD_NOT_ALLOWED");
    }
  });

  it.each(endpoints)("$name permite GET a un ADMIN", async (endpoint) => {
    const res = await endpoint.invoke(new NextRequest(endpoint.url));
    expect(res.status).toBe(200);
  });

  it("el guard rechaza mutaciones incluso con sesión ADMIN (lectura pura)", async () => {
    const res = await inventarioHandler(
      new NextRequest("http://localhost:3000/api/reportes/inventario", { method: "POST" })
    );
    expect(res.status).toBe(405);
  });
});
