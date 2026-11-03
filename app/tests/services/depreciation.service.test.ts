import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { ejecutarCorrida } from "@/lib/services/depreciation.service";
import { DepreciationError } from "@/lib/depreciation/errors";

const dec = (valor: string) => new Prisma.Decimal(valor);

const USUARIO_ID = "u1111111-1111-4000-8000-000000000001";
const PERIODO_ID = "p1111111-1111-4000-8000-000000000001";

function crearPeriodo(overrides: Record<string, unknown> = {}) {
  return {
    id: PERIODO_ID,
    anio: 2026,
    mes: 3,
    estado: "ABIERTO",
    fechaCorte: new Date("2026-03-31T00:00:00.000Z"),
    totalActivos: 0,
    totalCuota: dec("0.00"),
    activosOmitidos: 0,
    activosExcluidos: 0,
    ...overrides,
  };
}

function crearActivo(overrides: Record<string, any> = {}) {
  return {
    id: "a1111111-1111-4000-8000-000000000001",
    codigo: "ACT-2026-0001",
    estado: "ACTIVO",
    fechaAdquisicion: new Date("2026-01-15T00:00:00.000Z"),
    costoAdquisicion: dec("85000.00"),
    valorResidual: dec("8500.00"),
    depreciacionAcumulada: dec("0.00"),
    valorEnLibros: dec("85000.00"),
    historialBaja: null,
    tipoActivo: {
      estado: "ACTIVO",
      vidaUtilMeses: 48,
      metodoDepreciacion: "DGII_CAT2",
      cuentaContableDepreciacion: "1-01-04-0021",
      cuentaContableGastoDepreciacion: "6-30-01-0002",
    },
    ...overrides,
  };
}

function crearTx() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: PERIODO_ID }]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    periodoDepreciacion: {
      findUnique: vi.fn().mockResolvedValue(crearPeriodo()),
      update: vi.fn().mockResolvedValue({}),
    },
    activoFijo: {
      findMany: vi.fn().mockResolvedValue([crearActivo()]),
      update: vi.fn().mockResolvedValue({}),
    },
    detalleDepreciacion: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    asientoContable: {
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({
        id: "asiento-1",
        numeroAsiento: "DEP-202603-001",
        estado: "PENDIENTE_ENVIO",
        totalDebito: dec("1593.75"),
        totalCredito: dec("1593.75"),
      }),
    },
    auditoria: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
}

function montarTransaccion(tx: ReturnType<typeof crearTx>) {
  vi.mocked(prisma.$transaction).mockImplementation((async (cb: any) => cb(tx)) as any);
  return tx;
}

/** Extrae texto y parámetros del `Prisma.Sql` enviado a `$executeRaw`. */
function sqlEjecutado(tx: ReturnType<typeof crearTx>, indice = 0) {
  const argumento = tx.$executeRaw.mock.calls[indice]?.[0] as unknown as {
    sql: string;
    values: unknown[];
  };
  return {
    texto: argumento.sql,
    valores: argumento.values.map((v) => String(v)),
  };
}

const input = {
  periodoId: PERIODO_ID,
  usuarioId: USUARIO_ID,
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

describe("DepreciationService.ejecutarCorrida", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lanza PERIOD_NOT_FOUND (404) cuando el período no existe", async () => {
    const tx = montarTransaccion(crearTx());
    tx.$queryRaw.mockResolvedValue([]);

    await expect(ejecutarCorrida(input)).rejects.toMatchObject({
      code: "PERIOD_NOT_FOUND",
      status: 404,
    });
  });

  it("lanza PERIOD_ALREADY_CLOSED (409) sin mutar nada si el período está cerrado", async () => {
    const tx = montarTransaccion(crearTx());
    tx.periodoDepreciacion.findUnique.mockResolvedValue(crearPeriodo({ estado: "CERRADO" }));

    await expect(ejecutarCorrida(input)).rejects.toMatchObject({
      code: "PERIOD_ALREADY_CLOSED",
      status: 409,
    });
    expect(tx.detalleDepreciacion.createMany).not.toHaveBeenCalled();
    expect(tx.periodoDepreciacion.update).not.toHaveBeenCalled();
    expect(tx.auditoria.create).not.toHaveBeenCalled();
  });

  it("lanza NO_DEPRECIABLE_ASSETS (422) cuando el universo está vacío", async () => {
    const tx = montarTransaccion(crearTx());
    tx.activoFijo.findMany.mockResolvedValue([]);

    await expect(ejecutarCorrida(input)).rejects.toMatchObject({
      code: "NO_DEPRECIABLE_ASSETS",
      status: 422,
    });
    expect(tx.detalleDepreciacion.createMany).not.toHaveBeenCalled();
  });

  it("calcula, persiste el detalle, actualiza acumulados y genera el asiento", async () => {
    const tx = montarTransaccion(crearTx());

    const resumen = await ejecutarCorrida(input);

    expect(resumen.totalActivos).toBe(1);
    expect(resumen.totalCuota).toBe("1593.75");
    expect(resumen.estado).toBe("CALCULADO");
    expect(resumen.asiento.numeroAsiento).toBe("DEP-202603-001");

    const llamadaDetalle = tx.detalleDepreciacion.createMany.mock.calls[0][0] as any;
    expect(llamadaDetalle.data).toHaveLength(1);
    expect(llamadaDetalle.data[0].cuotaMensual.toFixed(2)).toBe("1593.75");
    expect(llamadaDetalle.data[0].tipoCuota).toBe("NORMAL");

    const actualizacion = sqlEjecutado(tx);
    expect(actualizacion.texto).toContain("UPDATE activos_fijos");
    expect(actualizacion.texto).toContain("FROM (VALUES");
    expect(actualizacion.valores).toContain("a1111111-1111-4000-8000-000000000001");
    expect(actualizacion.valores).toContain("1593.75");
    expect(actualizacion.valores).toContain("83406.25");
    // Un solo statement para todo el lote: no hay update por fila.
    expect(tx.activoFijo.update).not.toHaveBeenCalled();

    const actualizacionPeriodo = tx.periodoDepreciacion.update.mock.calls[0][0] as any;
    expect(actualizacionPeriodo.data.estado).toBe("CALCULADO");
    expect(actualizacionPeriodo.data.totalActivos).toBe(1);
    expect(actualizacionPeriodo.data.ejecutadoPorId).toBe(USUARIO_ID);

    const auditoria = tx.auditoria.create.mock.calls[0][0] as any;
    expect(auditoria.data.accion).toBe("DEPRECIATION_RUN");
    expect(auditoria.data.usuarioId).toBe(USUARIO_ID);
    expect(auditoria.data.ipAddress).toBe("127.0.0.1");
  });

  it("re-ejecuta sin duplicar: usa la línea base del detalle previo, no la acumulada actual", async () => {
    const tx = montarTransaccion(crearTx());
    // El activo ya tiene la cuota del período cargada por la corrida anterior.
    tx.activoFijo.findMany.mockResolvedValue([
      crearActivo({
        depreciacionAcumulada: dec("1593.75"),
        valorEnLibros: dec("83406.25"),
      }),
    ]);
    tx.detalleDepreciacion.findMany.mockResolvedValue([
      {
        activoId: "a1111111-1111-4000-8000-000000000001",
        depreciacionAcumuladaAnterior: dec("0.00"),
        valorEnLibrosAnterior: dec("85000.00"),
      },
    ]);

    const resumen = await ejecutarCorrida(input);

    expect(resumen.totalCuota).toBe("1593.75");
    const llamadaDetalle = tx.detalleDepreciacion.createMany.mock.calls[0][0] as any;
    expect(llamadaDetalle.data[0].depreciacionAcumuladaAnterior.toFixed(2)).toBe("0.00");
    expect(llamadaDetalle.data[0].cuotaMensual.toFixed(2)).toBe("1593.75");

    const actualizacion = sqlEjecutado(tx);
    expect(actualizacion.valores).toContain("1593.75");
  });

  it("revierte el cargo previo de un activo que sale del universo", async () => {
    const tx = montarTransaccion(crearTx());
    const activoInactivo = crearActivo({
      id: "a2222222-2222-4000-8000-000000000002",
      tipoActivo: {
        estado: "INACTIVO",
        vidaUtilMeses: 48,
        metodoDepreciacion: "DGII_CAT2",
        cuentaContableDepreciacion: "1-01-04-0021",
        cuentaContableGastoDepreciacion: "6-30-01-0002",
      },
    });
    tx.activoFijo.findMany.mockResolvedValue([crearActivo(), activoInactivo]);
    tx.detalleDepreciacion.findMany.mockResolvedValue([
      {
        activoId: "a1111111-1111-4000-8000-000000000001",
        depreciacionAcumuladaAnterior: dec("0.00"),
        valorEnLibrosAnterior: dec("85000.00"),
      },
      {
        activoId: "a2222222-2222-4000-8000-000000000002",
        depreciacionAcumuladaAnterior: dec("1000.00"),
        valorEnLibrosAnterior: dec("84000.00"),
      },
    ]);

    const resumen = await ejecutarCorrida(input);

    expect(resumen.activosExcluidos).toBe(1);

    // Dos statements: uno para las actualizaciones y otro para la reversión.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    const reversa = sqlEjecutado(tx, 1);
    expect(reversa.texto).toContain("UPDATE activos_fijos");
    expect(reversa.valores).toContain("a2222222-2222-4000-8000-000000000002");
    expect(reversa.valores).toContain("1000.00");
    expect(reversa.valores).toContain("84000.00");
    expect(tx.activoFijo.update).not.toHaveBeenCalled();
  });

  it("cuenta como omitidos los activos sin remanente depreciable", async () => {
    const tx = montarTransaccion(crearTx());
    tx.activoFijo.findMany.mockResolvedValue([
      crearActivo({ valorResidual: dec("85000.00") }),
      crearActivo({ id: "a3333333-3333-4000-8000-000000000003" }),
    ]);

    const resumen = await ejecutarCorrida(input);

    expect(resumen.activosOmitidos).toBe(1);
    expect(resumen.totalActivos).toBe(1);
  });

  it("lanza DEPRECIATION_EXPENSE_ACCOUNT_MISSING (422) si no hay cuenta de gasto", async () => {
    const tx = montarTransaccion(crearTx());
    tx.activoFijo.findMany.mockResolvedValue([
      crearActivo({
        tipoActivo: {
          estado: "ACTIVO",
          vidaUtilMeses: 48,
          metodoDepreciacion: "METODO_DESCONOCIDO",
          cuentaContableDepreciacion: "1-01-04-0021",
          cuentaContableGastoDepreciacion: null,
        },
      }),
    ]);

    await expect(ejecutarCorrida(input)).rejects.toMatchObject({
      code: "DEPRECIATION_EXPENSE_ACCOUNT_MISSING",
      status: 422,
    });
    expect(tx.detalleDepreciacion.createMany).not.toHaveBeenCalled();
  });

  it("aborta la corrida con RESIDUAL_EXCEEDS_COST si un activo tiene residual mayor al costo", async () => {
    const tx = montarTransaccion(crearTx());
    tx.activoFijo.findMany.mockResolvedValue([
      crearActivo({ valorResidual: dec("90000.00") }),
      crearActivo({ id: "a4444444-4444-4000-8000-000000000004" }),
    ]);

    // design.md §Error Handling: RESIDUAL_EXCEEDS_COST (422) aborta la corrida.
    const corrida = ejecutarCorrida(input);
    await expect(corrida).rejects.toMatchObject({
      code: "RESIDUAL_EXCEEDS_COST",
      status: 422,
    });
    await expect(corrida).rejects.toBeInstanceOf(DepreciationError);
    expect(tx.detalleDepreciacion.createMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.periodoDepreciacion.update).not.toHaveBeenCalled();
  });

  it("lanza RESIDUAL_EXCEEDS_COST si el único activo tiene residual mayor al costo", async () => {
    const tx = montarTransaccion(crearTx());
    tx.activoFijo.findMany.mockResolvedValue([
      crearActivo({ valorResidual: dec("90000.00") }),
    ]);

    await expect(ejecutarCorrida(input)).rejects.toMatchObject({
      code: "RESIDUAL_EXCEEDS_COST",
      status: 422,
    });
    expect(tx.detalleDepreciacion.createMany).not.toHaveBeenCalled();
  });

  it("aborta la corrida con ASSET_TYPE_INVALID_LIFE si el tipo de activo tiene vida útil inválida", async () => {
    const tx = montarTransaccion(crearTx());
    tx.activoFijo.findMany.mockResolvedValue([
      crearActivo({
        tipoActivo: {
          estado: "ACTIVO",
          vidaUtilMeses: 0,
          metodoDepreciacion: "DGII_CAT2",
          cuentaContableDepreciacion: "1-01-04-0021",
          cuentaContableGastoDepreciacion: "6-30-01-0002",
        },
      }),
    ]);

    // design.md §Error Handling: ASSET_TYPE_INVALID_LIFE (422) aborta la corrida.
    await expect(ejecutarCorrida(input)).rejects.toMatchObject({
      code: "ASSET_TYPE_INVALID_LIFE",
      status: 422,
    });
    expect(tx.detalleDepreciacion.createMany).not.toHaveBeenCalled();
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("lanza AUDIT_LOG_FAILED (500) y no confirma el período si falla la auditoría", async () => {
    const tx = montarTransaccion(crearTx());
    tx.auditoria.create.mockRejectedValue(new Error("db down"));

    await expect(ejecutarCorrida(input)).rejects.toMatchObject({
      code: "AUDIT_LOG_FAILED",
      status: 500,
    });
  });

  it("lanza ASIENTO_ALREADY_EXISTS (409) si el asiento ya fue enviado a contabilidad", async () => {
    const tx = montarTransaccion(crearTx());
    tx.asientoContable.findUnique.mockResolvedValue({
      id: "asiento-previo",
      numeroAsiento: "DEP-202603-001",
      estado: "ENVIADO",
      totalDebito: dec("1593.75"),
      totalCredito: dec("1593.75"),
    });

    await expect(ejecutarCorrida(input)).rejects.toBeInstanceOf(DepreciationError);
    await expect(ejecutarCorrida(input)).rejects.toMatchObject({
      code: "ASIENTO_ALREADY_EXISTS",
      status: 409,
    });
  });

  it("agrupa en una sola línea contable los activos que comparten cuenta de gasto y de depreciación", async () => {
    const tx = montarTransaccion(crearTx());
    tx.activoFijo.findMany.mockResolvedValue([
      crearActivo(),
      crearActivo({
        id: "a5555555-5555-4000-8000-000000000005",
        codigo: "ACT-2026-0002",
      }),
    ]);

    const resumen = await ejecutarCorrida(input);

    expect(resumen.totalActivos).toBe(2);
    expect(resumen.totalCuota).toBe("3187.50");

    const asientoCreado = tx.asientoContable.create.mock.calls[0][0] as any;
    // Una sola cuenta de gasto + una sola de depreciación ⇒ 2 líneas (no 4).
    expect(asientoCreado.data.lineas.create).toHaveLength(2);
    expect(asientoCreado.data.lineas.create[0].monto.toFixed(2)).toBe("3187.50");
  });

  it("revierte la corrida si falla la persistencia del detalle y no escribe nada posterior", async () => {
    const tx = montarTransaccion(crearTx());
    tx.detalleDepreciacion.createMany.mockRejectedValue(new Error("insert failed"));

    await expect(ejecutarCorrida(input)).rejects.toThrow("insert failed");

    // Todo ocurre dentro de `prisma.$transaction`: el rollback descarta el detalle,
    // los acumulados, el asiento y el cambio de estado del período.
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.asientoContable.create).not.toHaveBeenCalled();
    expect(tx.periodoDepreciacion.update).not.toHaveBeenCalled();
    expect(tx.auditoria.create).not.toHaveBeenCalled();
  });

  it("mantiene valor_en_libros = costo − depreciación acumulada en cada fila del lote", async () => {
    const tx = montarTransaccion(crearTx());
    const segundoId = "a6666666-6666-4000-8000-000000000006";
    tx.activoFijo.findMany.mockResolvedValue([
      crearActivo(),
      crearActivo({
        id: segundoId,
        codigo: "ACT-2026-0003",
        costoAdquisicion: dec("120000.00"),
        valorResidual: dec("12000.00"),
        valorEnLibros: dec("120000.00"),
      }),
    ]);

    await ejecutarCorrida(input);

    const { valores } = sqlEjecutado(tx);
    expect(valores).toHaveLength(6);
    for (let i = 0; i < valores.length; i += 3) {
      const costo = dec(valores[i] === segundoId ? "120000.00" : "85000.00");
      const acumulada = dec(valores[i + 1]);
      const valorEnLibros = dec(valores[i + 2]);
      expect(costo.minus(acumulada).toFixed(2)).toBe(valorEnLibros.toFixed(2));
    }
  });

  it("propaga el error si la transacción no puede confirmarse", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("transaction timeout"));

    await expect(ejecutarCorrida(input)).rejects.toThrow("transaction timeout");
  });
});
