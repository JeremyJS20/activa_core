import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// El guard RBAC es real: solo mockeamos la sesión de NextAuth.
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/services/period.service", () => ({
  crearPeriodo: vi.fn(),
  listarPeriodos: vi.fn(),
  obtenerPeriodo: vi.fn(),
  cerrarPeriodo: vi.fn(),
}));

vi.mock("@/lib/services/depreciation.service", () => ({
  ejecutarCorrida: vi.fn(),
}));

vi.mock("@/lib/services/asiento.service", () => ({
  listarAsientos: vi.fn(),
}));

import { auth } from "@/auth";
import {
  cerrarPeriodo,
  crearPeriodo,
  listarPeriodos,
  obtenerPeriodo,
} from "@/lib/services/period.service";
import { ejecutarCorrida } from "@/lib/services/depreciation.service";
import { listarAsientos } from "@/lib/services/asiento.service";
import { DepreciationError } from "@/lib/depreciation/errors";

import { GET as getPeriodos, POST as postPeriodo } from "@/app/api/depreciacion/periodos/route";
import { GET as getPeriodo } from "@/app/api/depreciacion/periodos/[id]/route";
import { POST as ejecutarPeriodo } from "@/app/api/depreciacion/periodos/[id]/ejecutar/route";
import { POST as cerrarPeriodoRoute } from "@/app/api/depreciacion/periodos/[id]/cerrar/route";
import { GET as getAsientos } from "@/app/api/depreciacion/asientos/route";

const dec = (valor: string) => new Prisma.Decimal(valor);

const PERIODO_ID = "p1111111-1111-4000-8000-000000000001";
const USUARIO_ID = "u1111111-1111-4000-8000-000000000001";

const adminSession = {
  user: {
    id: USUARIO_ID,
    nombre: "Administrador",
    permisos: [] as string[],
    rol: { codigo: "ADMIN" },
  },
};

const operadorSession = {
  user: {
    id: USUARIO_ID,
    nombre: "Operador",
    permisos: ["DEP_CALCULATE"],
    rol: { codigo: "CONTADOR" },
  },
};

const auditorSession = {
  user: {
    id: USUARIO_ID,
    nombre: "Auditor",
    permisos: ["ACC_LOG_READ"],
    rol: { codigo: "AUDITOR" },
  },
};

function sesion(session: typeof adminSession | null) {
  vi.mocked(auth).mockResolvedValue(session as any);
}

function crearRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    ...(init as any),
  } as any);
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function cuerpoJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

function periodoSerializable(overrides: Record<string, unknown> = {}) {
  return {
    id: PERIODO_ID,
    anio: 2026,
    mes: 11,
    estado: "CALCULADO",
    fechaCorte: new Date("2026-11-30T00:00:00.000Z"),
    totalActivos: 30,
    totalCuota: dec("56219.59"),
    activosOmitidos: 0,
    activosExcluidos: 0,
    fechaEjecucion: new Date("2026-11-02T10:00:00.000Z"),
    fechaCierre: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/depreciacion/periodos", () => {
  it("responde 401 sin sesión", async () => {
    sesion(null);

    const res = await getPeriodos(crearRequest("/api/depreciacion/periodos"));

    expect(res.status).toBe(401);
    const body = await cuerpoJson(res);
    expect(body.error).toBe("UNAUTHORIZED");
    expect(listarPeriodos).not.toHaveBeenCalled();
  });

  it("responde 403 si el usuario no tiene DEP_CALCULATE", async () => {
    sesion({
      user: { id: USUARIO_ID, permisos: ["ACC_LOG_READ"], rol: { codigo: "AUDITOR" } },
    } as any);

    const res = await getPeriodos(crearRequest("/api/depreciacion/periodos"));

    expect(res.status).toBe(403);
    const body = await cuerpoJson(res);
    expect(body.error).toBe("FORBIDDEN");
    expect(listarPeriodos).not.toHaveBeenCalled();
  });

  it("responde 200 con data serializada y meta de paginación", async () => {
    sesion(adminSession);
    vi.mocked(listarPeriodos).mockResolvedValue({
      items: [periodoSerializable() as any],
      total: 13,
    });

    const res = await getPeriodos(
      crearRequest("/api/depreciacion/periodos?page=1&pageSize=10&estado=TODOS")
    );

    expect(res.status).toBe(200);
    const body = await cuerpoJson(res);
    expect(body.meta).toEqual({ page: 1, pageSize: 10, total: 13, totalPages: 2 });
    expect(body.data).toHaveLength(1);
    // Decimal y Date deben salir como string, no como objeto interno {s,e,d}.
    expect(body.data[0].totalCuota).toBe("56219.59");
    expect(body.data[0].fechaCorte).toBe("2026-11-30T00:00:00.000Z");
    expect(vi.mocked(listarPeriodos).mock.calls[0][0]).toMatchObject({
      page: 1,
      pageSize: 10,
      estado: "TODOS",
    });
  });

  it("responde 400 con RFC 7807 cuando la paginación es inválida", async () => {
    sesion(adminSession);

    const res = await getPeriodos(
      crearRequest("/api/depreciacion/periodos?pageSize=500")
    );

    expect(res.status).toBe(400);
    const body = await cuerpoJson(res);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.status).toBe(400);
    expect(body.instance).toBe("/api/depreciacion/periodos");
    expect(listarPeriodos).not.toHaveBeenCalled();
  });
});

describe("POST /api/depreciacion/periodos", () => {
  it("responde 201 y serializa el período creado", async () => {
    sesion(operadorSession);
    vi.mocked(crearPeriodo).mockResolvedValue(
      periodoSerializable({ estado: "ABIERTO", totalCuota: dec("0.00") }) as any
    );

    const res = await postPeriodo(
      crearRequest("/api/depreciacion/periodos", {
        method: "POST",
        body: JSON.stringify({ anio: 2026, mes: 12 }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(res.status).toBe(201);
    const body = await cuerpoJson(res);
    expect(body.data.estado).toBe("ABIERTO");
    expect(body.data.totalCuota).toBe("0.00");
    expect(vi.mocked(crearPeriodo).mock.calls[0][0]).toEqual({ anio: 2026, mes: 12 });
  });

  it("responde 400 si falta el mes", async () => {
    sesion(adminSession);

    const res = await postPeriodo(
      crearRequest("/api/depreciacion/periodos", {
        method: "POST",
        body: JSON.stringify({ anio: 2026 }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(res.status).toBe(400);
    const body = await cuerpoJson(res);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(crearPeriodo).not.toHaveBeenCalled();
  });

  it("responde 409 si el período ya existe", async () => {
    sesion(adminSession);
    vi.mocked(crearPeriodo).mockRejectedValue(
      new DepreciationError("PERIOD_ALREADY_EXISTS", "Ya existe un período para 2026-11")
    );

    const res = await postPeriodo(
      crearRequest("/api/depreciacion/periodos", {
        method: "POST",
        body: JSON.stringify({ anio: 2026, mes: 11 }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(res.status).toBe(409);
    const body = await cuerpoJson(res);
    expect(body.code).toBe("PERIOD_ALREADY_EXISTS");
    expect(body.detail).toBe("Ya existe un período para 2026-11");
  });

  it("responde 403 sin DEP_CALCULATE", async () => {
    sesion(auditorSession);

    const res = await postPeriodo(
      crearRequest("/api/depreciacion/periodos", {
        method: "POST",
        body: JSON.stringify({ anio: 2026, mes: 12 }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(res.status).toBe(403);
    expect(crearPeriodo).not.toHaveBeenCalled();
  });
});

describe("GET /api/depreciacion/periodos/[id]", () => {
  it("responde 200 con detalles y asiento serializados", async () => {
    sesion(adminSession);
    vi.mocked(obtenerPeriodo).mockResolvedValue({
      ...periodoSerializable(),
      detalles: [
        {
          id: "d1",
          activoId: "a1",
          cuotaMensual: dec("1593.75"),
          depreciacionAcumuladaAnterior: dec("0.00"),
          depreciacionAcumuladaNueva: dec("1593.75"),
          valorEnLibrosAnterior: dec("85000.00"),
          valorEnLibrosNuevo: dec("83406.25"),
          tipoCuota: "NORMAL",
          esCuotaFinal: false,
          activo: { id: "a1", codigo: "ACT-2026-0001", descripcion: "Laptop" },
        },
      ],
      asiento: {
        id: "as1",
        numeroAsiento: "DEP-202611-001",
        totalDebito: dec("56219.59"),
        totalCredito: dec("56219.59"),
        lineas: [
          {
            id: "l1",
            cuentaContable: "6-30-01-0002",
            tipoMovimiento: "DEBITO",
            monto: dec("56219.59"),
            descripcion: "Gasto por depreciación 11/2026",
          },
        ],
      },
    } as any);

    const res = await getPeriodo(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}`),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(200);
    const body = await cuerpoJson(res);
    expect(body.data.detalles[0].cuotaMensual).toBe("1593.75");
    expect(body.data.asiento.lineas[0].monto).toBe("56219.59");
  });

  it("responde 404 si el período no existe", async () => {
    sesion(adminSession);
    vi.mocked(obtenerPeriodo).mockRejectedValue(
      new DepreciationError("PERIOD_NOT_FOUND")
    );

    const res = await getPeriodo(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}`),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(404);
    const body = await cuerpoJson(res);
    expect(body.code).toBe("PERIOD_NOT_FOUND");
  });

  it("responde 403 sin DEP_CALCULATE", async () => {
    sesion(auditorSession);

    const res = await getPeriodo(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}`),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(403);
    expect(obtenerPeriodo).not.toHaveBeenCalled();
  });
});

describe("POST /api/depreciacion/periodos/[id]/ejecutar", () => {
  it("responde 200 con el resumen de la corrida y propaga la auditoría", async () => {
    sesion(operadorSession);
    vi.mocked(ejecutarCorrida).mockResolvedValue({
      periodoId: PERIODO_ID,
      anio: 2026,
      mes: 11,
      estado: "CALCULADO",
      totalActivos: 30,
      totalCuota: "56219.59",
      activosOmitidos: 0,
      activosExcluidos: 0,
      asiento: {
        id: "as1",
        numeroAsiento: "DEP-202611-001",
        estado: "PENDIENTE_ENVIO",
        totalDebito: "56219.59",
        totalCredito: "56219.59",
      },
    } as any);

    const res = await ejecutarPeriodo(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}/ejecutar`, {
        method: "POST",
        headers: { "x-forwarded-for": "190.80.1.5, 10.0.0.1", "user-agent": "vitest" },
      }),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(200);
    const body = await cuerpoJson(res);
    expect(body.data.totalCuota).toBe("56219.59");
    expect(vi.mocked(ejecutarCorrida).mock.calls[0][0]).toMatchObject({
      periodoId: PERIODO_ID,
      usuarioId: USUARIO_ID,
      ipAddress: "190.80.1.5",
      userAgent: "vitest",
    });
  });

  it("responde 409 si el período está cerrado", async () => {
    sesion(adminSession);
    vi.mocked(ejecutarCorrida).mockRejectedValue(
      new DepreciationError("PERIOD_ALREADY_CLOSED")
    );

    const res = await ejecutarPeriodo(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}/ejecutar`, { method: "POST" }),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(409);
    expect((await cuerpoJson(res)).code).toBe("PERIOD_ALREADY_CLOSED");
  });

  it("responde 422 si no hay activos depreciables", async () => {
    sesion(adminSession);
    vi.mocked(ejecutarCorrida).mockRejectedValue(
      new DepreciationError("NO_DEPRECIABLE_ASSETS")
    );

    const res = await ejecutarPeriodo(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}/ejecutar`, { method: "POST" }),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(422);
    expect((await cuerpoJson(res)).code).toBe("NO_DEPRECIABLE_ASSETS");
  });

  it("responde 403 sin DEP_CALCULATE aunque tenga ACC_LOG_READ", async () => {
    sesion(auditorSession);

    const res = await ejecutarPeriodo(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}/ejecutar`, { method: "POST" }),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(403);
    expect(ejecutarCorrida).not.toHaveBeenCalled();
  });
});

describe("POST /api/depreciacion/periodos/[id]/cerrar", () => {
  it("responde 200 y cierra el período con confirmación explícita", async () => {
    sesion(adminSession);
    vi.mocked(cerrarPeriodo).mockResolvedValue(
      periodoSerializable({ estado: "CERRADO", fechaCierre: new Date("2026-11-03T09:00:00.000Z") }) as any
    );

    const res = await cerrarPeriodoRoute(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}/cerrar`, {
        method: "POST",
        body: JSON.stringify({ confirmar: true }),
        headers: { "content-type": "application/json" },
      }),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(200);
    const body = await cuerpoJson(res);
    expect(body.data.estado).toBe("CERRADO");
    expect(body.data.fechaCierre).toBe("2026-11-03T09:00:00.000Z");
    expect(vi.mocked(cerrarPeriodo).mock.calls[0][0]).toBe(PERIODO_ID);
    expect(vi.mocked(cerrarPeriodo).mock.calls[0][1]).toBe(USUARIO_ID);
  });

  it("responde 400 si confirmar no es true", async () => {
    sesion(adminSession);

    const res = await cerrarPeriodoRoute(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}/cerrar`, {
        method: "POST",
        body: JSON.stringify({ confirmar: false }),
        headers: { "content-type": "application/json" },
      }),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(400);
    const body = await cuerpoJson(res);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(cerrarPeriodo).not.toHaveBeenCalled();
  });

  it("responde 409 al intentar cerrar un período ya cerrado", async () => {
    sesion(adminSession);
    vi.mocked(cerrarPeriodo).mockRejectedValue(new DepreciationError("PERIOD_IMMUTABLE"));

    const res = await cerrarPeriodoRoute(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}/cerrar`, {
        method: "POST",
        body: JSON.stringify({ confirmar: true }),
        headers: { "content-type": "application/json" },
      }),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(409);
    expect((await cuerpoJson(res)).code).toBe("PERIOD_IMMUTABLE");
  });

  it("responde 403 sin DEP_CALCULATE", async () => {
    sesion(auditorSession);

    const res = await cerrarPeriodoRoute(
      crearRequest(`/api/depreciacion/periodos/${PERIODO_ID}/cerrar`, {
        method: "POST",
        body: JSON.stringify({ confirmar: true }),
        headers: { "content-type": "application/json" },
      }),
      params(PERIODO_ID)
    );

    expect(res.status).toBe(403);
    expect(cerrarPeriodo).not.toHaveBeenCalled();
  });
});

describe("GET /api/depreciacion/asientos", () => {
  it("permite al AUDITOR consultar con ACC_LOG_READ sin DEP_CALCULATE", async () => {
    sesion(auditorSession);
    vi.mocked(listarAsientos).mockResolvedValue({
      items: [
        {
          id: "as1",
          numeroAsiento: "DEP-202611-001",
          estado: "PENDIENTE_ENVIO",
          totalDebito: dec("56219.59"),
          totalCredito: dec("56219.59"),
          lineas: [],
        },
      ] as any,
      total: 1,
    });

    const res = await getAsientos(crearRequest("/api/depreciacion/asientos"));

    expect(res.status).toBe(200);
    const body = await cuerpoJson(res);
    expect(body.data[0].totalDebito).toBe("56219.59");
    // El filtro por defecto del schema es PENDIENTE_ENVIO.
    expect(vi.mocked(listarAsientos).mock.calls[0][0]).toMatchObject({
      page: 1,
      pageSize: 10,
      estado: "PENDIENTE_ENVIO",
    });
  });

  it("responde 403 si no posee ninguno de los tres permisos", async () => {
    sesion({
      user: { id: USUARIO_ID, permisos: ["ASSET_READ"], rol: { codigo: "CONSULTA" } },
    } as any);

    const res = await getAsientos(crearRequest("/api/depreciacion/asientos"));

    expect(res.status).toBe(403);
    expect(listarAsientos).not.toHaveBeenCalled();
  });

  it("responde 400 si el estado no es válido", async () => {
    sesion(adminSession);

    const res = await getAsientos(
      crearRequest("/api/depreciacion/asientos?estado=BORRADOR")
    );

    expect(res.status).toBe(400);
    expect((await cuerpoJson(res)).code).toBe("VALIDATION_ERROR");
  });
});

describe("respuestaError — contrato RFC 7807", () => {
  it("convierte un error inesperado en 500 con código DEPRECIATION_RUN_FAILED", async () => {
    sesion(adminSession);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listarPeriodos).mockRejectedValue(new Error("connection reset"));

    const res = await getPeriodos(crearRequest("/api/depreciacion/periodos"));

    expect(res.status).toBe(500);
    const body = await cuerpoJson(res);
    expect(body.code).toBe("DEPRECIATION_RUN_FAILED");
    expect(body.type).toContain("depreciation-run-failed");
    consoleError.mockRestore();
  });
});
