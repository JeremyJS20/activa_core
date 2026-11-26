import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  groupBy: vi.fn(),
  asientoFindUnique: vi.fn(),
  bitacoraCount: vi.fn(),
  bitacoraFindMany: vi.fn(),
  tipoFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asientoContable: {
      count: mocks.count,
      findMany: mocks.findMany,
      groupBy: mocks.groupBy,
      findUnique: mocks.asientoFindUnique,
    },
    bitacoraEnvioWS: {
      count: mocks.bitacoraCount,
      findMany: mocks.bitacoraFindMany,
    },
    tipoActivo: { findMany: mocks.tipoFindMany },
  },
}));

import {
  listarAsientos,
  listarBitacora,
  obtenerAsiento,
} from "@/lib/services/contabilidad-query.service";

const dec = (valor: string) => new Prisma.Decimal(valor);
const tipoA = {
  codigo: "TPA-001",
  cuentaContableGastoDepreciacion: null,
  cuentaContableDepreciacion: "1-01-04-0011",
  metodoDepreciacion: "DGII_CAT1",
};

function asientoDetalle(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-1",
    numeroAsiento: "DEP-202610-001",
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
    periodo: { id: "p-1", anio: 2026, mes: 10, estado: "CERRADO" },
    lineas: [
      {
        id: "l-1",
        asientoId: "a-1",
        cuentaContable: "6-30-01-0001",
        tipoMovimiento: "DEBITO",
        monto: dec("1000.00"),
        descripcion: "Gasto por depreciación",
      },
      {
        id: "l-2",
        asientoId: "a-1",
        cuentaContable: "1-01-04-0011",
        tipoMovimiento: "CREDITO",
        monto: dec("1000.00"),
        descripcion: "Depreciación acumulada",
      },
    ],
    envios: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tipoFindMany.mockResolvedValue([tipoA]);
});

describe("listarAsientos", () => {
  it("aplica filtros, paginación, orden y KPIs del período", async () => {
    mocks.count.mockResolvedValue(2);
    mocks.findMany.mockResolvedValue([
      {
        id: "a-1",
        numeroAsiento: "DEP-202610-001",
        concepto: "Depreciación 10/2026",
        fechaContable: new Date("2026-10-31T00:00:00.000Z"),
        estado: "ERROR",
        totalDebito: dec("1000.00"),
        totalCredito: dec("1000.00"),
        intentosEnvio: 1,
        transaccionWsId: null,
        periodo: { anio: 2026, mes: 10, estado: "CERRADO" },
      },
    ]);
    mocks.groupBy.mockResolvedValue([
      { estado: "PENDIENTE_ENVIO", _count: { _all: 1 } },
      { estado: "ERROR", _count: { _all: 1 } },
    ]);

    const resultado = await listarAsientos({
      page: 2,
      pageSize: 10,
      estado: "ERROR",
      periodo: "2026-10",
      sort: "fecha",
      dir: "desc",
    });

    expect(mocks.count).toHaveBeenCalledWith({
      where: { estado: "ERROR", periodo: { anio: 2026, mes: 10 } },
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ fechaContable: "desc" }, { numeroAsiento: "desc" }],
      })
    );
    expect(mocks.groupBy).toHaveBeenCalledWith({
      by: ["estado"],
      where: { periodo: { anio: 2026, mes: 10 } },
      _count: { _all: true },
    });
    expect(resultado.total).toBe(2);
    expect(resultado.kpis).toEqual({ total: 2, pendientes: 1, enviados: 0, errores: 1 });
  });

  it("ordena por número cuando sort=numero", async () => {
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);
    mocks.groupBy.mockResolvedValue([]);

    await listarAsientos({
      page: 1,
      pageSize: 10,
      estado: "TODOS",
      sort: "numero",
      dir: "asc",
    });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ numeroAsiento: "asc" }] })
    );
  });

  it("rechaza un período inválido", async () => {
    await expect(
      listarAsientos({
        page: 1,
        pageSize: 10,
        estado: "TODOS",
        periodo: "13-2026",
        sort: "fecha",
        dir: "desc",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("obtenerAsiento", () => {
  it("resuelve tipoInventario, balance y acciones para un asiento cuadrado", async () => {
    mocks.asientoFindUnique.mockResolvedValue(asientoDetalle());

    const detalle = await obtenerAsiento("a-1");

    expect(detalle.balance).toBe("0.00");
    expect(detalle.puedeDespachar).toBe(true);
    expect(detalle.puedeReintentar).toBe(false);
    expect(detalle.lineas).toEqual([
      expect.objectContaining({
        tipoInventario: "TPA-001",
        tipoMovimiento: "DB",
        monto: "1000.00",
      }),
      expect.objectContaining({
        tipoInventario: "TPA-001",
        tipoMovimiento: "CR",
        monto: "1000.00",
      }),
    ]);
    expect(detalle.ultimoIntento).toBeNull();
  });

  it("muestra balance distinto de cero y bloquea acciones", async () => {
    mocks.asientoFindUnique.mockResolvedValue(
      asientoDetalle({
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
      })
    );

    const detalle = await obtenerAsiento("a-1");
    expect(detalle.balance).toBe("0.01");
    expect(detalle.puedeDespachar).toBe(false);
    expect(detalle.puedeReintentar).toBe(false);
  });

  it("incluye el último intento cuando existe bitácora", async () => {
    mocks.asientoFindUnique.mockResolvedValue(
      asientoDetalle({
        estado: "ERROR",
        envios: [
          {
            intento: 1,
            resultado: "RECHAZADO",
            httpStatus: 500,
            mensaje: "Falla",
            createdAt: new Date("2026-11-01T10:00:00.000Z"),
          },
        ],
      })
    );

    const detalle = await obtenerAsiento("a-1");
    expect(detalle.ultimoIntento).toMatchObject({
      intento: 1,
      resultado: "RECHAZADO",
      httpStatus: 500,
    });
    expect(detalle.puedeReintentar).toBe(true);
  });

  it("lanza 404 si el asiento no existe", async () => {
    mocks.asientoFindUnique.mockResolvedValue(null);
    await expect(obtenerAsiento("nope")).rejects.toMatchObject({
      code: "ASIENTO_NOT_FOUND",
      status: 404,
    });
  });

  it("marca tipoInventario null cuando la cuenta de depreciación es ambigua", async () => {
    mocks.tipoFindMany.mockResolvedValue([
      tipoA,
      { ...tipoA, codigo: "TPA-002" },
    ]);
    mocks.asientoFindUnique.mockResolvedValue(asientoDetalle());

    const detalle = await obtenerAsiento("a-1");
    expect(detalle.lineas[0].tipoInventario).toBeNull();
    expect(detalle.lineas[1].tipoInventario).toBeNull();
  });
});

describe("listarBitacora", () => {
  it("devuelve eventos cronológicos con usuario y paginación", async () => {
    mocks.bitacoraCount.mockResolvedValue(2);
    mocks.bitacoraFindMany.mockResolvedValue([
      {
        id: "b-1",
        asientoId: "a-1",
        numeroAsiento: "DEP-202610-001",
        usuario: { id: "u-1", correo: "admin@unapec.edu.do" },
        intento: 1,
        payload: { numeroAsiento: "DEP-202610-001" },
        endpoint: "https://ws/asientos",
        httpStatus: 500,
        respuesta: { codigo: "WS_SERVER_ERROR" },
        mensaje: "Falla",
        duracionMs: 120,
        resultado: "RECHAZADO",
        correlationId: "corr-1",
        createdAt: new Date("2026-11-01T10:00:00.000Z"),
      },
    ]);

    const resultado = await listarBitacora("a-1", 1, 20);

    expect(mocks.bitacoraFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { asientoId: "a-1" },
        orderBy: { createdAt: "asc" },
        skip: 0,
        take: 20,
      })
    );
    expect(resultado.total).toBe(2);
    expect(resultado.items[0]).toMatchObject({
      intento: 1,
      usuario: { id: "u-1", correo: "admin@unapec.edu.do" },
      resultado: "RECHAZADO",
    });
  });
});
