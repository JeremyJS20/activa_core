import { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { MotivoCustodia } from "@/lib/schemas/asset.schema";

export type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

export class CustodyTransferError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "CustodyTransferError";
    this.code = code;
    this.status = status;
  }
}

export interface TransferirCustodiaParams {
  activoId: string;
  empleadoNuevoId: string;
  departamentoNuevoId: string;
  motivo: MotivoCustodia;
  justificacion: string;
  autorizadoPorId: string;
}

export interface TransferirCustodiaResultado {
  movimientoId: string;
  activoId: string;
  empleadoAnteriorId: string | null;
  empleadoNuevoId: string;
  departamentoAnteriorId: string | null;
  departamentoNuevoId: string;
  createdAt: string;
}

/**
 * Ejecuta la transferencia atómica de custodia y radicación departamental de un activo fijo institucional.
 * Actualiza los campos en ActivoFijo y genera un registro inmutable en HistorialCustodia bajo una sola transacción ACID.
 */
export async function transferirCustodia(
  params: TransferirCustodiaParams,
  client?: PrismaDbClient
): Promise<TransferirCustodiaResultado> {
  const db = (client ?? defaultPrisma) as PrismaClient;

  return await db.$transaction(async (tx) => {
    // 1. Obtener activo actual
    const activo = await tx.activoFijo.findUnique({
      where: { id: params.activoId },
      select: {
        id: true,
        codigo: true,
        estado: true,
        empleadoId: true,
        departamentoId: true,
      },
    });

    if (!activo) {
      throw new CustodyTransferError(
        "ASSET_NOT_FOUND",
        404,
        "No se encontró el activo fijo institucional especificado."
      );
    }

    // 2. Verificar que no esté dado de baja ni vendido
    if (activo.estado === "DADO_DE_BAJA" || activo.estado === "VENDIDO") {
      throw new CustodyTransferError(
        "ASSET_DISPOSED_CANNOT_TRANSFER",
        400,
        "No se puede transferir la custodia de un activo que ha sido formalmente dado de baja o vendido."
      );
    }

    // 3. Verificar si hay cambio real de custodia o radicación
    if (
      activo.empleadoId === params.empleadoNuevoId &&
      activo.departamentoId === params.departamentoNuevoId
    ) {
      throw new CustodyTransferError(
        "NO_CUSTODY_CHANGE_DETECTED",
        422,
        "El nuevo custodio y departamento asignados son idénticos a los actuales del activo."
      );
    }

    // 4. Verificar nuevo departamento activo
    const depto = await tx.departamento.findUnique({
      where: { id: params.departamentoNuevoId },
      select: { id: true, estado: true },
    });
    if (!depto) {
      throw new CustodyTransferError(
        "DEPARTMENT_NOT_FOUND",
        400,
        "El departamento de destino especificado no existe."
      );
    }
    if (depto.estado !== "ACTIVO") {
      throw new CustodyTransferError(
        "DEPARTMENT_INACTIVE",
        400,
        "No se puede trasladar un activo a un departamento que no esté activo."
      );
    }

    // 5. Verificar nuevo empleado activo
    const emp = await tx.empleado.findUnique({
      where: { id: params.empleadoNuevoId },
      select: { id: true, estado: true },
    });
    if (!emp) {
      throw new CustodyTransferError(
        "EMPLOYEE_NOT_FOUND",
        400,
        "El nuevo empleado custodio especificado no existe."
      );
    }
    if (emp.estado !== "ACTIVO") {
      throw new CustodyTransferError(
        "EMPLOYEE_NOT_ELIGIBLE",
        400,
        "El nuevo empleado seleccionado como custodio no está activo en la institución."
      );
    }

    // 6. Registrar movimiento inmutable en HistorialCustodia
    const movimiento = await tx.historialCustodia.create({
      data: {
        activoId: activo.id,
        empleadoAnteriorId: activo.empleadoId,
        empleadoNuevoId: params.empleadoNuevoId,
        departamentoAnteriorId: activo.departamentoId,
        departamentoNuevoId: params.departamentoNuevoId,
        motivo: params.motivo,
        justificacion: params.justificacion,
        autorizadoPorId: params.autorizadoPorId,
      },
    });

    // 7. Actualizar custodio y departamento actual en ActivoFijo
    await tx.activoFijo.update({
      where: { id: activo.id },
      data: {
        empleadoId: params.empleadoNuevoId,
        departamentoId: params.departamentoNuevoId,
      },
    });

    return {
      movimientoId: movimiento.id,
      activoId: activo.id,
      empleadoAnteriorId: activo.empleadoId,
      empleadoNuevoId: params.empleadoNuevoId,
      departamentoAnteriorId: activo.departamentoId,
      departamentoNuevoId: params.departamentoNuevoId,
      createdAt: movimiento.createdAt.toISOString(),
    };
  });
}