import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  listar: vi.fn(),
  obtener: vi.fn(),
  bitacora: vi.fn(),
}));

vi.mock("@/lib/auth/rbac", () => ({
  checkSessionPermission: mocks.check,
}));

vi.mock("@/lib/services/contabilidad-query.service", () => ({
  listarAsientos: mocks.listar,
  obtenerAsiento: mocks.obtener,
  listarBitacora: mocks.bitacora,
}));

import { GET as listar } from "@/app/api/contabilidad/asientos/route";
import { GET as detalle } from "@/app/api/contabilidad/asientos/[id]/route";
import { GET as bitacora } from "@/app/api/contabilidad/bitacora/route";
import { IntegrationError } from "@/lib/integracion/errors";

function autorizado() {
  mocks.check.mockResolvedValue({
    authorized: true,
    response: null,
    session: { user: { id: "u-1", permisos: ["INT_MANAGE"] } },
  });
}

function negado(status: number) {
  mocks.check.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: "x" }, { status }),
    session: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  autorizado();
});

describe("GET /api/contabilidad/asientos", () => {
  it("responde lista, KPIs y metadatos serializados", async () => {
    mocks.listar.mockResolvedValue({
      items: [
        {
          id: "a-1",
          numeroAsiento: "DEP-202610-001",
          concepto: "Depreciación 10/2026",
          fechaContable: new Date("2026-10-31T00:00:00.000Z"),
          estado: "ERROR",
          totalDebito: new Prisma.Decimal("1000.00"),
          totalCredito: new Prisma.Decimal("1000.00"),
          intentosEnvio: 1,
          transaccionWsId: null,
          periodo: { anio: 2026, mes: 10, estado: "CERRADO" },
        },
      ],
      total: 1,
      kpis: { total: 1, pendientes: 0, enviados: 0, errores: 1 },
    });

    const response = await listar(
      new NextRequest("http://localhost/api/contabilidad/asientos?estado=ERROR&periodo=2026-10")
    );

    expect(response.status).toBe(200);
    expect(mocks.check).toHaveBeenCalledWith([
      "INT_MANAGE",
      "ACC_POST_SEND",
      "ACC_LOG_READ",
    ]);
    expect(mocks.listar).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "ERROR", periodo: "2026-10", page: 1, pageSize: 10 })
    );

    const body = (await response.json()) as {
      data: Array<{ totalDebito: string; fechaContable: string }>;
      kpis: { errores: number };
      meta: { totalPages: number };
    };
    expect(body.data[0].totalDebito).toBe("1000.00");
    expect(body.data[0].fechaContable).toBe("2026-10-31T00:00:00.000Z");
    expect(body.kpis.errores).toBe(1);
    expect(body.meta.totalPages).toBe(1);
  });

  it("rechaza un pageSize inválido con 400 VALIDATION_ERROR", async () => {
    const response = await listar(
      new NextRequest("http://localhost/api/contabilidad/asientos?pageSize=13")
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(mocks.listar).not.toHaveBeenCalled();
  });

  it("responde 401 sin sesión", async () => {
    negado(401);
    const response = await listar(new NextRequest("http://localhost/api/contabilidad/asientos"));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("UNAUTHORIZED");
    expect(response.headers.get("content-type")).toContain("application/problem+json");
  });

  it("responde 403 sin permiso", async () => {
    negado(403);
    const response = await listar(new NextRequest("http://localhost/api/contabilidad/asientos"));
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/contabilidad/asientos/[id]", () => {
  it("responde el detalle del asiento", async () => {
    mocks.obtener.mockResolvedValue({
      id: "a-1",
      numeroAsiento: "DEP-202610-001",
      balance: "0.00",
      lineas: [],
    });

    const response = await detalle(
      new NextRequest("http://localhost/api/contabilidad/asientos/a-1"),
      { params: Promise.resolve({ id: "a-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.obtener).toHaveBeenCalledWith("a-1");
    const body = (await response.json()) as { data: { id: string; balance: string } };
    expect(body.data).toMatchObject({ id: "a-1", balance: "0.00" });
  });

  it("responde 404 ASIENTO_NOT_FOUND", async () => {
    mocks.obtener.mockRejectedValue(new IntegrationError("ASIENTO_NOT_FOUND"));

    const response = await detalle(
      new NextRequest("http://localhost/api/contabilidad/asientos/nope"),
      { params: Promise.resolve({ id: "nope" }) }
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("ASIENTO_NOT_FOUND");
  });
});

describe("GET /api/contabilidad/bitacora", () => {
  it("exige ACC_LOG_READ y responde eventos paginados", async () => {
    mocks.bitacora.mockResolvedValue({
      items: [
        {
          id: "b-1",
          asientoId: "8b1c0e6e-2f4a-4f7e-9d6b-3a1f2c9d8e01",
          numeroAsiento: "DEP-202610-001",
          usuario: { id: "u-1", correo: "auditor@unapec.edu.do" },
          intento: 1,
          payload: {},
          endpoint: "https://ws/asientos",
          httpStatus: 201,
          respuesta: {},
          mensaje: "ok",
          duracionMs: 100,
          resultado: "EXITOSO",
          correlationId: "corr-1",
          createdAt: new Date("2026-11-01T10:00:00.000Z"),
        },
      ],
      total: 1,
    });

    const response = await bitacora(
      new NextRequest(
        "http://localhost/api/contabilidad/bitacora?asientoId=8b1c0e6e-2f4a-4f7e-9d6b-3a1f2c9d8e01"
      )
    );

    expect(response.status).toBe(200);
    expect(mocks.check).toHaveBeenCalledWith(["ACC_LOG_READ"]);
    expect(mocks.bitacora).toHaveBeenCalledWith(
      "8b1c0e6e-2f4a-4f7e-9d6b-3a1f2c9d8e01",
      1,
      20
    );
    const body = (await response.json()) as { data: unknown[]; meta: { total: number } };
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
  });

  it("responde 400 si asientoId no es UUID", async () => {
    const response = await bitacora(
      new NextRequest("http://localhost/api/contabilidad/bitacora?asientoId=DEP-202610-001")
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(mocks.bitacora).not.toHaveBeenCalled();
  });

  it("responde 403 a un usuario sin ACC_LOG_READ", async () => {
    negado(403);
    const response = await bitacora(
      new NextRequest(
        "http://localhost/api/contabilidad/bitacora?asientoId=8b1c0e6e-2f4a-4f7e-9d6b-3a1f2c9d8e01"
      )
    );
    expect(response.status).toBe(403);
    expect(mocks.bitacora).not.toHaveBeenCalled();
  });
});
