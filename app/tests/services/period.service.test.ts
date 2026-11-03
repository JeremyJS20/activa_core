import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    periodoDepreciacion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  cerrarPeriodo,
  crearPeriodo,
  listarPeriodos,
  obtenerPeriodo,
} from "@/lib/services/period.service";

const dec = (valor: string) => new Prisma.Decimal(valor);
const USUARIO_ID = "u1111111-1111-4000-8000-000000000001";
const PERIODO_ID = "p1111111-1111-4000-8000-000000000001";

function crearTx(periodo: Record<string, any> | null) {
  return {
    periodoDepreciacion: {
      findUnique: vi.fn().mockResolvedValue(periodo),
      update: vi.fn().mockResolvedValue({ id: PERIODO_ID, estado: "CERRADO" }),
    },
    auditoria: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };
}

describe("PeriodService.crearPeriodo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza un mes fuera de rango con INVALID_PERIOD_FORMAT (422)", async () => {
    await expect(crearPeriodo({ anio: 2026, mes: 13 })).rejects.toMatchObject({
      code: "INVALID_PERIOD_FORMAT",
      status: 422,
    });
    expect(prisma.periodoDepreciacion.create).not.toHaveBeenCalled();
  });

  it("rechaza un año fuera de rango con INVALID_PERIOD_FORMAT (422)", async () => {
    await expect(crearPeriodo({ anio: 1999, mes: 1 })).rejects.toMatchObject({
      code: "INVALID_PERIOD_FORMAT",
      status: 422,
    });
  });

  it("lanza PERIOD_ALREADY_EXISTS (409) si el período ya existe", async () => {
    vi.mocked(prisma.periodoDepreciacion.findUnique).mockResolvedValue({
      id: PERIODO_ID,
    } as any);

    await expect(crearPeriodo({ anio: 2026, mes: 3 })).rejects.toMatchObject({
      code: "PERIOD_ALREADY_EXISTS",
      status: 409,
    });
    expect(prisma.periodoDepreciacion.create).not.toHaveBeenCalled();
  });

  it("crea el período ABIERTO con la fecha de corte del último día del mes", async () => {
    vi.mocked(prisma.periodoDepreciacion.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.periodoDepreciacion.create).mockResolvedValue({
      id: PERIODO_ID,
      anio: 2026,
      mes: 2,
      estado: "ABIERTO",
    } as any);

    await crearPeriodo({ anio: 2026, mes: 2 });

    const llamada = vi.mocked(prisma.periodoDepreciacion.create).mock.calls[0][0] as any;
    expect(llamada.data.estado).toBe("ABIERTO");
    expect(llamada.data.fechaCorte.toISOString().split("T")[0]).toBe("2026-02-28");
  });
});

describe("PeriodService.listarPeriodos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pagina en servidor y ordena por año y mes descendente", async () => {
    vi.mocked(prisma.periodoDepreciacion.count).mockResolvedValue(13);
    vi.mocked(prisma.periodoDepreciacion.findMany).mockResolvedValue([]);

    const resultado = await listarPeriodos({
      page: 2,
      pageSize: 10,
      estado: "TODOS",
    });

    expect(resultado.total).toBe(13);
    const llamada = vi.mocked(prisma.periodoDepreciacion.findMany).mock.calls[0][0] as any;
    expect(llamada.skip).toBe(10);
    expect(llamada.take).toBe(10);
    expect(llamada.orderBy).toEqual([{ anio: "desc" }, { mes: "desc" }]);
    expect(llamada.where).toEqual({});
  });

  it("filtra por estado y año cuando se especifican", async () => {
    vi.mocked(prisma.periodoDepreciacion.count).mockResolvedValue(0);
    vi.mocked(prisma.periodoDepreciacion.findMany).mockResolvedValue([]);

    await listarPeriodos({ page: 1, pageSize: 25, estado: "CERRADO", anio: 2025 });

    const llamada = vi.mocked(prisma.periodoDepreciacion.findMany).mock.calls[0][0] as any;
    expect(llamada.where).toEqual({ estado: "CERRADO", anio: 2025 });
    expect(llamada.skip).toBe(0);
    expect(llamada.take).toBe(25);
  });
});

describe("PeriodService.obtenerPeriodo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lanza PERIOD_NOT_FOUND (404) cuando el período no existe", async () => {
    vi.mocked(prisma.periodoDepreciacion.findUnique).mockResolvedValue(null);

    await expect(obtenerPeriodo(PERIODO_ID)).rejects.toMatchObject({
      code: "PERIOD_NOT_FOUND",
      status: 404,
    });
  });

  it("devuelve el período con detalles y asiento", async () => {
    vi.mocked(prisma.periodoDepreciacion.findUnique).mockResolvedValue({
      id: PERIODO_ID,
      detalles: [{ id: "d1" }],
      asiento: { id: "as1", lineas: [] },
    } as any);

    const periodo = await obtenerPeriodo(PERIODO_ID);
    expect(periodo.detalles).toHaveLength(1);
    expect(periodo.asiento).not.toBeNull();
  });
});

describe("PeriodService.cerrarPeriodo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lanza PERIOD_NOT_FOUND (404) cuando el período no existe", async () => {
    const tx = crearTx(null);
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: any) => cb(tx)) as any);

    await expect(cerrarPeriodo(PERIODO_ID, USUARIO_ID)).rejects.toMatchObject({
      code: "PERIOD_NOT_FOUND",
      status: 404,
    });
  });

  it("lanza PERIOD_IMMUTABLE (409) al intentar cerrar un período ya cerrado", async () => {
    const tx = crearTx({
      id: PERIODO_ID,
      anio: 2026,
      mes: 3,
      estado: "CERRADO",
      totalActivos: 10,
      totalCuota: dec("1000.00"),
      _count: { detalles: 10 },
    });
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: any) => cb(tx)) as any);

    await expect(cerrarPeriodo(PERIODO_ID, USUARIO_ID)).rejects.toMatchObject({
      code: "PERIOD_IMMUTABLE",
      status: 409,
    });
    expect(tx.periodoDepreciacion.update).not.toHaveBeenCalled();
  });

  it("lanza PERIOD_NOT_CLOSABLE (409) si el período está ABIERTO", async () => {
    const tx = crearTx({
      id: PERIODO_ID,
      anio: 2026,
      mes: 3,
      estado: "ABIERTO",
      totalActivos: 0,
      totalCuota: dec("0.00"),
      _count: { detalles: 0 },
    });
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: any) => cb(tx)) as any);

    await expect(cerrarPeriodo(PERIODO_ID, USUARIO_ID)).rejects.toMatchObject({
      code: "PERIOD_NOT_CLOSABLE",
      status: 409,
    });
  });

  it("lanza PERIOD_HAS_NO_DETAIL (422) si el período calculado no tiene detalle", async () => {
    const tx = crearTx({
      id: PERIODO_ID,
      anio: 2026,
      mes: 3,
      estado: "CALCULADO",
      totalActivos: 0,
      totalCuota: dec("0.00"),
      _count: { detalles: 0 },
    });
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: any) => cb(tx)) as any);

    await expect(cerrarPeriodo(PERIODO_ID, USUARIO_ID)).rejects.toMatchObject({
      code: "PERIOD_HAS_NO_DETAIL",
      status: 422,
    });
  });

  it("cierra el período y registra la auditoría PERIOD_CLOSE", async () => {
    const tx = crearTx({
      id: PERIODO_ID,
      anio: 2026,
      mes: 3,
      estado: "CALCULADO",
      totalActivos: 30,
      totalCuota: dec("56219.59"),
      _count: { detalles: 30 },
    });
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: any) => cb(tx)) as any);

    await cerrarPeriodo(PERIODO_ID, USUARIO_ID, { ipAddress: "10.0.0.1", userAgent: "vitest" });

    const actualizacion = tx.periodoDepreciacion.update.mock.calls[0][0] as any;
    expect(actualizacion.data.estado).toBe("CERRADO");
    expect(actualizacion.data.cerradoPorId).toBe(USUARIO_ID);
    expect(actualizacion.data.fechaCierre).toBeInstanceOf(Date);

    const auditoria = tx.auditoria.create.mock.calls[0][0] as any;
    expect(auditoria.data.accion).toBe("PERIOD_CLOSE");
    expect(auditoria.data.recursoId).toBe(PERIODO_ID);
    expect(auditoria.data.detalle.totalCuota).toBe("56219.59");
  });

  it("lanza AUDIT_LOG_FAILED (500) si no se puede registrar la auditoría", async () => {
    const tx = crearTx({
      id: PERIODO_ID,
      anio: 2026,
      mes: 3,
      estado: "CALCULADO",
      totalActivos: 30,
      totalCuota: dec("56219.59"),
      _count: { detalles: 30 },
    });
    tx.auditoria.create.mockRejectedValue(new Error("audit down"));
    vi.mocked(prisma.$transaction).mockImplementation((async (cb: any) => cb(tx)) as any);

    await expect(cerrarPeriodo(PERIODO_ID, USUARIO_ID)).rejects.toMatchObject({
      code: "AUDIT_LOG_FAILED",
      status: 500,
    });
  });
});
