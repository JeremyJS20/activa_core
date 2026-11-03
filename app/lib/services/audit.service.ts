import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DepreciationError } from "@/lib/depreciation/errors";

export type ClientePrisma = Prisma.TransactionClient | typeof prisma;

export interface RegistroAuditoria {
  usuarioId: string | null;
  accion: "DEPRECIATION_RUN" | "PERIOD_CLOSE" | "PERIOD_CREATE";
  recurso: string;
  recursoId?: string | null;
  detalle?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Registra una acción en la bitácora inmutable de auditoría.
 * Si la escritura falla, la transacción contenedora debe revertirse.
 */
export async function registrarAuditoria(
  cliente: ClientePrisma,
  datos: RegistroAuditoria
): Promise<void> {
  try {
    await cliente.auditoria.create({
      data: {
        usuarioId: datos.usuarioId,
        accion: datos.accion,
        recurso: datos.recurso,
        recursoId: datos.recursoId ?? null,
        detalle: datos.detalle,
        ipAddress: datos.ipAddress ?? null,
        userAgent: datos.userAgent ?? null,
      },
    });
  } catch {
    throw new DepreciationError(
      "AUDIT_LOG_FAILED",
      "No fue posible registrar la auditoría de la operación. La transacción fue revertida."
    );
  }
}
