import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    asientoContable: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  CUENTAS_GASTO_POR_METODO,
  crearAsiento,
  listarAsientos,
  resolverCuentaGasto,
} from "@/lib/services/asiento.service";

const dec = (valor: string) => new Prisma.Decimal(valor);
const PERIODO_ID = "p1111111-1111-4000-8000-000000000001";

describe("resolverCuentaGasto", () => {
  it("prioriza la cuenta configurada en el tipo de activo", () => {
    const cuenta = resolverCuentaGasto({
      cuentaContableGastoDepreciacion: "6-30-01-0003",
      cuentaContableDepreciacion: "1-01-04-0021",
      metodoDepreciacion: "DGII_CAT2",
    });
    expect(cuenta).toBe("6-30-01-0003");
  });

  it("usa la cuenta por defecto del método cuando no hay cuenta configurada", () => {
    const cuenta = resolverCuentaGasto({
      cuentaContableGastoDepreciacion: null,
      cuentaContableDepreciacion: "1-01-04-0021",
      metodoDepreciacion: "DGII_CAT1",
    });
    expect(cuenta).toBe(CUENTAS_GASTO_POR_METODO.DGII_CAT1);
    expect(cuenta).toBe("6-30-01-0001");
  });

  it("lanza DEPRECIATION_EXPENSE_ACCOUNT_MISSING si no hay cuenta ni método conocido", () => {
    let capturado: unknown;
    try {
      resolverCuentaGasto({
        cuentaContableGastoDepreciacion: null,
        cuentaContableDepreciacion: "1-01-04-0021",
        metodoDepreciacion: "METODO_DESCONOCIDO",
      });
    } catch (error) {
      capturado = error;
    }

    expect((capturado as any)?.code).toBe("DEPRECIATION_EXPENSE_ACCOUNT_MISSING");
    expect((capturado as any)?.status).toBe(422);
  });
});

describe("crearAsiento", () => {
  function crearTx(asientoExistente: Record<string, any> | null = null) {
    return {
      asientoContable: {
        findUnique: vi.fn().mockResolvedValue(asientoExistente),
        deleteMany: vi.fn().mockResolvedValue({ count: asientoExistente ? 1 : 0 }),
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: "asiento-1",
          numeroAsiento: data.numeroAsiento,
          estado: data.estado,
          totalDebito: data.totalDebito,
          totalCredito: data.totalCredito,
          lineas: data.lineas.create.map((l: any, i: number) => ({ id: `l${i}`, ...l })),
        })),
      },
    } as any;
  }

  const grupos = [
    { cuentaGasto: "6-30-01-0002", cuentaDepreciacion: "1-01-04-0021", monto: dec("1500.00") },
    { cuentaGasto: "6-30-01-0001", cuentaDepreciacion: "1-01-04-0022", monto: dec("500.00") },
  ];

  it("genera dos líneas por grupo (débito gasto / crédito acumulada) y cuadra totales", async () => {
    const tx = crearTx();

    const asiento = await crearAsiento(tx, {
      periodoId: PERIODO_ID,
      anio: 2026,
      mes: 11,
      grupos,
      total: dec("2000.00"),
    });

    expect(asiento.totalDebito.toFixed(2)).toBe("2000.00");
    expect(asiento.totalCredito.toFixed(2)).toBe("2000.00");
    expect(asiento.estado).toBe("PENDIENTE_ENVIO");

    const data = tx.asientoContable.create.mock.calls[0][0].data;
    expect(data.lineas.create).toHaveLength(4);
    expect(data.lineas.create[0].tipoMovimiento).toBe("DEBITO");
    expect(data.lineas.create[1].tipoMovimiento).toBe("CREDITO");
    expect(data.lineas.create[0].descripcion).toBe("Gasto por depreciación 11/2026");
    expect(data.lineas.create[1].descripcion).toBe("Depreciación acumulada 11/2026");
    expect(data.numeroAsiento).toBe("DEP-202611-001");
  });

  it("lanza ASIENTO_UNBALANCED si la suma de grupos no coincide con el total", async () => {
    const tx = crearTx();

    await expect(
      crearAsiento(tx, {
        periodoId: PERIODO_ID,
        anio: 2026,
        mes: 11,
        grupos,
        total: dec("2100.00"),
      })
    ).rejects.toMatchObject({ code: "ASIENTO_UNBALANCED", status: 500 });

    expect(tx.asientoContable.deleteMany).not.toHaveBeenCalled();
    expect(tx.asientoContable.create).not.toHaveBeenCalled();
  });

  it("lanza ASIENTO_UNBALANCED si no hay grupos", async () => {
    const tx = crearTx();

    await expect(
      crearAsiento(tx, {
        periodoId: PERIODO_ID,
        anio: 2026,
        mes: 11,
        grupos: [],
        total: dec("0.00"),
      })
    ).rejects.toMatchObject({ code: "ASIENTO_UNBALANCED" });

    expect(tx.asientoContable.create).not.toHaveBeenCalled();
  });

  it("lanza ASIENTO_ALREADY_EXISTS si el asiento ya fue enviado a contabilidad", async () => {
    const tx = crearTx({
      id: "asiento-previo",
      numeroAsiento: "DEP-202611-001",
      estado: "ENVIADO",
    });

    await expect(
      crearAsiento(tx, {
        periodoId: PERIODO_ID,
        anio: 2026,
        mes: 11,
        grupos,
        total: dec("2000.00"),
      })
    ).rejects.toMatchObject({ code: "ASIENTO_ALREADY_EXISTS", status: 409 });

    expect(tx.asientoContable.deleteMany).not.toHaveBeenCalled();
    expect(tx.asientoContable.create).not.toHaveBeenCalled();
  });

  it("reemplaza el asiento previo cuando aún está PENDIENTE_ENVIO", async () => {
    const tx = crearTx({
      id: "asiento-previo",
      numeroAsiento: "DEP-202611-001",
      estado: "PENDIENTE_ENVIO",
    });

    await crearAsiento(tx, {
      periodoId: PERIODO_ID,
      anio: 2026,
      mes: 11,
      grupos,
      total: dec("2000.00"),
    });

    expect(tx.asientoContable.deleteMany).toHaveBeenCalledWith({
      where: { periodoId: PERIODO_ID },
    });
    expect(tx.asientoContable.create).toHaveBeenCalled();
  });

  it("usa la fecha contable del último día del período", async () => {
    const tx = crearTx();

    await crearAsiento(tx, {
      periodoId: PERIODO_ID,
      anio: 2026,
      mes: 2,
      grupos,
      total: dec("2000.00"),
    });

    const data = tx.asientoContable.create.mock.calls[0][0].data;
    expect(new Date(data.fechaContable).toISOString().split("T")[0]).toBe("2026-02-28");
  });
});

describe("listarAsientos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filtra por estado y aplica paginación en servidor", async () => {
    vi.mocked(prisma.asientoContable.count).mockResolvedValue(4);
    vi.mocked(prisma.asientoContable.findMany).mockResolvedValue([]);

    const resultado = await listarAsientos({ page: 2, pageSize: 10, estado: "ENVIADO" });

    expect(resultado.total).toBe(4);
    const llamada = vi.mocked(prisma.asientoContable.findMany).mock.calls[0][0] as any;
    expect(llamada.where).toEqual({ estado: "ENVIADO" });
    expect(llamada.skip).toBe(10);
    expect(llamada.take).toBe(10);
    expect(llamada.orderBy).toEqual({ createdAt: "desc" });
    expect(llamada.include.lineas).toBe(true);
    expect(llamada.include.periodo.select).toEqual({
      id: true,
      anio: true,
      mes: true,
      estado: true,
    });
  });

  it("no filtra por estado cuando es TODOS", async () => {
    vi.mocked(prisma.asientoContable.count).mockResolvedValue(0);
    vi.mocked(prisma.asientoContable.findMany).mockResolvedValue([]);

    await listarAsientos({ page: 1, pageSize: 25, estado: "TODOS" });

    const llamada = vi.mocked(prisma.asientoContable.findMany).mock.calls[0][0] as any;
    expect(llamada.where).toEqual({});
    expect(llamada.skip).toBe(0);
    expect(llamada.take).toBe(25);
  });
});
