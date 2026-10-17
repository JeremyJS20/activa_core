import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  transferirCustodia,
  CustodyTransferError,
} from "@/lib/services/custody-transfer.service";

describe("Servicio de Transferencia de Custodia (custody-transfer.service)", () => {
  const activoId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
  const empAnteriorId = "e1111111-1111-4000-8000-000000000001";
  const empNuevoId = "e2222222-2222-4000-8000-000000000002";
  const deptAnteriorId = "d1111111-1111-4000-8000-000000000001";
  const deptNuevoId = "d2222222-2222-4000-8000-000000000002";
  const userId = "u1111111-1111-4000-8000-000000000001";

  const validParams = {
    activoId,
    empleadoNuevoId: empNuevoId,
    departamentoNuevoId: deptNuevoId,
    motivo: "ROTACION_INTERNA" as const,
    justificacion: "Reasignación formal por cambio de funciones operativas",
    autorizadoPorId: userId,
  };

  const createMockTx = (overrides: Record<string, any> = {}) => {
    return {
      activoFijo: {
        findUnique: vi.fn().mockResolvedValue({
          id: activoId,
          codigo: "ACT-2026-0001",
          estado: "ACTIVO",
          empleadoId: empAnteriorId,
          departamentoId: deptAnteriorId,
          ...overrides.activoFijo,
        }),
        update: vi.fn().mockResolvedValue({ id: activoId }),
      },
      departamento: {
        findUnique: vi.fn().mockResolvedValue({
          id: deptNuevoId,
          estado: "ACTIVO",
          ...overrides.departamento,
        }),
      },
      empleado: {
        findUnique: vi.fn().mockResolvedValue({
          id: empNuevoId,
          estado: "ACTIVO",
          ...overrides.empleado,
        }),
      },
      historialCustodia: {
        create: vi.fn().mockResolvedValue({
          id: "mov-uuid-1",
          createdAt: new Date("2026-02-01T10:00:00.000Z"),
        }),
      },
    };
  };

  const createMockDb = (tx: any) => ({
    $transaction: vi.fn().mockImplementation((cb) => cb(tx)),
  });

  it("lanza ASSET_NOT_FOUND (404) si el activo no existe", async () => {
    const tx = createMockTx();
    tx.activoFijo.findUnique.mockResolvedValue(null);
    const db = createMockDb(tx);

    await expect(transferirCustodia(validParams, db as any)).rejects.toThrow(CustodyTransferError);
    await expect(transferirCustodia(validParams, db as any)).rejects.toMatchObject({
      code: "ASSET_NOT_FOUND",
      status: 404,
    });
  });

  it("lanza ASSET_DISPOSED_CANNOT_TRANSFER (400) si el activo está dado de baja", async () => {
    const tx = createMockTx({ activoFijo: { estado: "DADO_DE_BAJA" } });
    const db = createMockDb(tx);

    await expect(transferirCustodia(validParams, db as any)).rejects.toMatchObject({
      code: "ASSET_DISPOSED_CANNOT_TRANSFER",
      status: 400,
    });
  });

  it("lanza NO_CUSTODY_CHANGE_DETECTED (422) si custodio y departamento son idénticos a los actuales", async () => {
    const tx = createMockTx({
      activoFijo: { empleadoId: empNuevoId, departamentoId: deptNuevoId },
    });
    const db = createMockDb(tx);

    await expect(transferirCustodia(validParams, db as any)).rejects.toMatchObject({
      code: "NO_CUSTODY_CHANGE_DETECTED",
      status: 422,
    });
  });

  it("lanza DEPARTMENT_INACTIVE (400) si el departamento destino está inactivo", async () => {
    const tx = createMockTx({ departamento: { estado: "INACTIVO" } });
    const db = createMockDb(tx);

    await expect(transferirCustodia(validParams, db as any)).rejects.toMatchObject({
      code: "DEPARTMENT_INACTIVE",
      status: 400,
    });
  });

  it("lanza EMPLOYEE_NOT_ELIGIBLE (400) si el nuevo empleado custodio está inactivo", async () => {
    const tx = createMockTx({ empleado: { estado: "INACTIVO" } });
    const db = createMockDb(tx);

    await expect(transferirCustodia(validParams, db as any)).rejects.toMatchObject({
      code: "EMPLOYEE_NOT_ELIGIBLE",
      status: 400,
    });
  });

  it("transfiere exitosamente actualizando ActivoFijo e insertando HistorialCustodia", async () => {
    const tx = createMockTx();
    const db = createMockDb(tx);

    const res = await transferirCustodia(validParams, db as any);

    expect(res.movimientoId).toBe("mov-uuid-1");
    expect(res.empleadoAnteriorId).toBe(empAnteriorId);
    expect(res.empleadoNuevoId).toBe(empNuevoId);
    expect(res.departamentoAnteriorId).toBe(deptAnteriorId);
    expect(res.departamentoNuevoId).toBe(deptNuevoId);

    expect(tx.historialCustodia.create).toHaveBeenCalledWith({
      data: {
        activoId,
        empleadoAnteriorId: empAnteriorId,
        empleadoNuevoId: empNuevoId,
        departamentoAnteriorId: deptAnteriorId,
        departamentoNuevoId: deptNuevoId,
        motivo: "ROTACION_INTERNA",
        justificacion: validParams.justificacion,
        autorizadoPorId: userId,
      },
    });

    expect(tx.activoFijo.update).toHaveBeenCalledWith({
      where: { id: activoId },
      data: {
        empleadoId: empNuevoId,
        departamentoId: deptNuevoId,
      },
    });
  });
});