import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    asientoContable: {
      count: mocks.count,
      findMany: mocks.findMany,
    },
  },
}));

vi.mock("@/lib/services/ws-contabilidad.client", () => ({
  dispatchAsiento: mocks.dispatch,
}));

import {
  despacharAsiento,
  despacharPendientes,
  reintentarAsiento,
} from "@/lib/services/integracion-contable.service";
import { IntegrationError } from "@/lib/integracion/errors";

const dec = (valor: string) => new Prisma.Decimal(valor);
const usuario = { id: "u-1", correo: "admin@unapec.edu.do" };
const tipoA = {
  codigo: "TPA-001",
  cuentaContableGastoDepreciacion: null,
  cuentaContableDepreciacion: "1-01-04-0011",
  metodoDepreciacion: "DGII_CAT1",
};

function asiento(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-1",
    numeroAsiento: "DEP-202610-001",
    periodoId: "p-1",
    concepto: "Depreciación 10/2026",
    fechaContable: new Date("2026-10-31T00:00:00.000Z"),
    estado: "PENDIENTE_ENVIO",
    totalDebito: dec("1000.00"),
    totalCredito: dec("1000.00"),
    transaccionWsId: null,
    codigoRespuestaWs: null,
    mensajeRespuestaWs: null,
    fechaEnvioWs: null,
    intentosEnvio: 0,
    createdAt: new Date("2026-10-31T00:00:00.000Z"),
    updatedAt: new Date("2026-10-31T00:00:00.000Z"),
    periodo: { id: "p-1", anio: 2026, mes: 10, estado: "CERRADO" },
    lineas: [
      {
        id: "l-1",
        asientoId: "a-1",
        cuentaContable: "6-30-01-0001",
        tipoMovimiento: "DEBITO",
        monto: dec("1000.00"),
        descripcion: "Gasto por depreciación 10/2026",
      },
      {
        id: "l-2",
        asientoId: "a-1",
        cuentaContable: "1-01-04-0011",
        tipoMovimiento: "CREDITO",
        monto: dec("1000.00"),
        descripcion: "Depreciación acumulada 10/2026",
      },
    ],
    ...overrides,
  };
}

function resultadoOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    httpStatus: 201,
    codigo: "201",
    mensaje: "Asiento registrado",
    transaccionWsId: "WS-20261031-00042",
    respuesta: { numeroConfirmacion: "WS-20261031-00042" },
    resultado: "EXITOSO",
    duracionMs: 184,
    endpoint: "https://contabilidad.unapec.edu.do/asientos",
    correlationId: "corr-1",
    ...overrides,
  };
}

function resultadoError(overrides: Record<string, unknown> = {}) {
  return {
    ok: false,
    httpStatus: 500,
    codigo: "WS_SERVER_ERROR",
    mensaje: "Falla interna del WS",
    respuesta: { codigo: "WS_SERVER_ERROR" },
    resultado: "RECHAZADO",
    duracionMs: 210,
    endpoint: "https://contabilidad.unapec.edu.do/asientos",
    correlationId: "corr-2",
    ...overrides,
  };
}

let actual: ReturnType<typeof asiento>;
let tx: {
  $executeRaw: ReturnType<typeof vi.fn>;
  asientoContable: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  bitacoraEnvioWS: { create: ReturnType<typeof vi.fn> };
  tipoActivo: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  actual = asiento();
  tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    asientoContable: {
      findUnique: vi.fn().mockResolvedValue(actual),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({ ...actual, ...args.data })),
    },
    bitacoraEnvioWS: { create: vi.fn().mockResolvedValue({}) },
    tipoActivo: { findMany: vi.fn().mockResolvedValue([tipoA]) },
  };
  mocks.transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));
});

function datosUpdate() {
  const llamada = tx.asientoContable.update.mock.calls[0]?.[0] as
    | { data: Record<string, unknown> }
    | undefined;
  return llamada?.data;
}

function datosLog() {
  const llamada = tx.bitacoraEnvioWS.create.mock.calls[0]?.[0] as
    | { data: Record<string, unknown> }
    | undefined;
  return llamada?.data;
}

describe("despacharAsiento", () => {
  it("despacha un asiento PENDIENTE_ENVIO y persiste ENVIADO + bitácora en la transacción", async () => {
    mocks.dispatch.mockResolvedValue(resultadoOk());

    const resultado = await despacharAsiento("a-1", usuario);

    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    const [payload, opciones] = mocks.dispatch.mock.calls[0] as [
      { numeroAsiento: string; lineas: unknown[] },
      { correlationId: string },
    ];
    expect(payload.numeroAsiento).toBe("DEP-202610-001");
    expect(payload.lineas).toHaveLength(2);
    expect(typeof opciones.correlationId).toBe("string");

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(datosUpdate()).toMatchObject({
      estado: "ENVIADO",
      intentosEnvio: 1,
      transaccionWsId: "WS-20261031-00042",
      codigoRespuestaWs: "201",
    });
    expect(datosLog()).toMatchObject({
      asientoId: "a-1",
      numeroAsiento: "DEP-202610-001",
      usuarioId: "u-1",
      correoUsuario: "admin@unapec.edu.do",
      intento: 1,
      resultado: "EXITOSO",
      httpStatus: 201,
      endpoint: "https://contabilidad.unapec.edu.do/asientos",
      correlationId: "corr-1",
    });
    expect(resultado).toMatchObject({
      asientoId: "a-1",
      numeroAsiento: "DEP-202610-001",
      estado: "ENVIADO",
      transaccionWsId: "WS-20261031-00042",
      intento: 1,
    });
  });

  it("persiste ERROR + bitácora y lanza WS_SERVER_ERROR cuando el WS falla", async () => {
    mocks.dispatch.mockResolvedValue(resultadoError());

    await expect(despacharAsiento("a-1", usuario)).rejects.toMatchObject({
      code: "WS_SERVER_ERROR",
    });

    expect(datosUpdate()).toMatchObject({ estado: "ERROR", intentosEnvio: 1 });
    expect(datosLog()).toMatchObject({ resultado: "RECHAZADO", httpStatus: 500 });
  });

  it("persiste ERROR/TIMEOUT cuando el WS no responde", async () => {
    mocks.dispatch.mockResolvedValue(
      resultadoError({
        httpStatus: null,
        codigo: "WS_TIMEOUT",
        resultado: "TIMEOUT",
        mensaje: "El Web Service no respondió dentro de 10000 ms.",
        respuesta: undefined,
      })
    );

    await expect(despacharAsiento("a-1", usuario)).rejects.toMatchObject({
      code: "WS_TIMEOUT",
      status: 504,
    });

    expect(datosUpdate()).toMatchObject({ estado: "ERROR", intentosEnvio: 1 });
    expect(datosLog()).toMatchObject({ resultado: "TIMEOUT", httpStatus: null });
  });

  it("rechaza un asiento ENVIADO con 409 sin invocar al WS", async () => {
    actual = asiento({ estado: "ENVIADO", transaccionWsId: "WS-20261031-00042" });
    tx.asientoContable.findUnique.mockResolvedValue(actual);

    await expect(despacharAsiento("a-1", usuario)).rejects.toMatchObject({
      code: "ASIENTO_ALREADY_SENT",
      status: 409,
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("rechaza despachar un asiento en ERROR (debe reintentarse)", async () => {
    actual = asiento({ estado: "ERROR", intentosEnvio: 1 });
    tx.asientoContable.findUnique.mockResolvedValue(actual);

    await expect(despacharAsiento("a-1", usuario)).rejects.toMatchObject({
      code: "ASIENTO_NOT_RETRYABLE",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("rechaza un asiento inexistente", async () => {
    tx.asientoContable.findUnique.mockResolvedValue(null);

    await expect(despacharAsiento("nope", usuario)).rejects.toMatchObject({
      code: "ASIENTO_NOT_FOUND",
      status: 404,
    });
  });

  it("no invoca al WS ni actualiza si el asiento está descuadrado", async () => {
    actual = asiento({
      lineas: [
        {
          id: "l-1",
          asientoId: "a-1",
          cuentaContable: "6-30-01-0001",
          tipoMovimiento: "DEBITO",
          monto: dec("1000.00"),
          descripcion: "Gasto",
        },
        {
          id: "l-2",
          asientoId: "a-1",
          cuentaContable: "1-01-04-0011",
          tipoMovimiento: "CREDITO",
          monto: dec("999.99"),
          descripcion: "Depreciación",
        },
      ],
    });
    tx.asientoContable.findUnique.mockResolvedValue(actual);

    await expect(despacharAsiento("a-1", usuario)).rejects.toMatchObject({
      code: "ASIENTO_UNBALANCED",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(tx.asientoContable.update).not.toHaveBeenCalled();
  });

  it("revierte la transición si falla la inserción de la bitácora", async () => {
    mocks.dispatch.mockResolvedValue(resultadoOk());
    tx.bitacoraEnvioWS.create.mockRejectedValue(new Error("db down"));

    await expect(despacharAsiento("a-1", usuario)).rejects.toMatchObject({
      code: "AUDIT_LOG_FAILED",
      status: 500,
    });
  });
});

describe("reintentarAsiento", () => {
  it("reintenta un asiento ERROR e incrementa el intento", async () => {
    actual = asiento({ estado: "ERROR", intentosEnvio: 1 });
    tx.asientoContable.findUnique.mockResolvedValue(actual);
    mocks.dispatch.mockResolvedValue(resultadoOk({ resultado: "EXITOSO" }));

    const resultado = await reintentarAsiento("a-1", usuario);

    expect(datosUpdate()).toMatchObject({ estado: "ENVIADO", intentosEnvio: 2 });
    expect(datosLog()).toMatchObject({ intento: 2, resultado: "EXITOSO" });
    expect(resultado.intento).toBe(2);
  });

  it("rechaza reintentar un asiento PENDIENTE_ENVIO", async () => {
    await expect(reintentarAsiento("a-1", usuario)).rejects.toMatchObject({
      code: "ASIENTO_NOT_RETRYABLE",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("rechaza reintentar un asiento ENVIADO", async () => {
    actual = asiento({ estado: "ENVIADO" });
    tx.asientoContable.findUnique.mockResolvedValue(actual);

    await expect(reintentarAsiento("a-1", usuario)).rejects.toMatchObject({
      code: "ASIENTO_ALREADY_SENT",
    });
  });
});

describe("despacharPendientes", () => {
  it("procesa un lote con resultado parcial y no aborta por un fallo individual", async () => {
    mocks.count.mockResolvedValue(3);
    mocks.findMany.mockResolvedValue([
      { id: "a-1", numeroAsiento: "DEP-202610-001" },
      { id: "a-2", numeroAsiento: "DEP-202610-002" },
      { id: "a-3", numeroAsiento: "DEP-202610-003" },
    ]);
    mocks.dispatch
      .mockResolvedValueOnce(resultadoOk())
      .mockResolvedValueOnce(resultadoOk())
      .mockResolvedValueOnce(resultadoError());

    const resultado = await despacharPendientes("2026-10", usuario);

    expect(resultado).toMatchObject({ total: 3, enviados: 2, errores: 1, restantes: 0 });
    expect(resultado.resultados).toHaveLength(3);
    expect(resultado.resultados[0]).toMatchObject({ estado: "ENVIADO" });
    expect(resultado.resultados[2]).toMatchObject({
      estado: "ERROR",
      codigo: "WS_SERVER_ERROR",
    });
  });

  it("procesa máximo 25 pendientes y reporta los restantes", async () => {
    const pendientes = Array.from({ length: 25 }, (_, index) => ({
      id: `a-${index + 1}`,
      numeroAsiento: `DEP-202610-${String(index + 1).padStart(3, "0")}`,
    }));
    mocks.count.mockResolvedValue(30);
    mocks.findMany.mockResolvedValue(pendientes);
    mocks.dispatch.mockResolvedValue(resultadoOk());

    const resultado = await despacharPendientes("2026-10", usuario);

    expect(resultado.total).toBe(25);
    expect(resultado.enviados).toBe(25);
    expect(resultado.errores).toBe(0);
    expect(resultado.restantes).toBe(5);
  });

  it("no invoca al WS cuando no hay pendientes", async () => {
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);

    const resultado = await despacharPendientes("2026-10", usuario);

    expect(resultado).toEqual({ total: 0, enviados: 0, errores: 0, restantes: 0, resultados: [] });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("rechaza un período con formato inválido", async () => {
    await expect(despacharPendientes("13-2026", usuario)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("mapea BATCH_START_FAILED si falla la consulta inicial", async () => {
    mocks.count.mockRejectedValue(new Error("db down"));

    await expect(despacharPendientes("2026-10", usuario)).rejects.toMatchObject({
      code: "BATCH_START_FAILED",
    });
  });
});

describe("errores de dominio", () => {
  it("IntegrationError conserva status y código", () => {
    const error = new IntegrationError("ASIENTO_ALREADY_SENT");
    expect(error.status).toBe(409);
    expect(error.code).toBe("ASIENTO_ALREADY_SENT");
  });
});
