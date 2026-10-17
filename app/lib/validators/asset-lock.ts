import { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Campos financieros críticos cuya mutación queda estrictamente prohibida
 * una vez que el activo ha iniciado su ciclo de depreciación contable.
 */
export const CAMPOS_FINANCIEROS_BLOQUEADOS = [
  "costoAdquisicion",
  "valorResidual",
  "fechaAdquisicion",
  "tipoActivoId",
] as const;

export type CampoFinancieroBloqueado = (typeof CAMPOS_FINANCIEROS_BLOQUEADOS)[number];

export class FinancialLockError extends Error {
  readonly code = "FINANCIAL_FIELDS_LOCKED";
  readonly status = 409;
  readonly camposBloqueados: string[];

  constructor(camposBloqueados: string[], message?: string) {
    super(
      message ??
        `No se pueden modificar los campos financieros [${camposBloqueados.join(", ")}] porque el activo posee historial de depreciación registrado.`
    );
    this.name = "FinancialLockError";
    this.camposBloqueados = camposBloqueados;
  }
}

/**
 * Determina si un activo fijo tiene bloqueo financiero activo.
 * Un activo se considera bloqueado financieramente si:
 * 1. Su depreciación acumulada histórica es mayor a 0 (ha sido depreciado).
 * 2. Su estado es 'DADO_DE_BAJA' o 'VENDIDO'.
 *
 * @param activoId Identificador único del activo
 * @param client Cliente Prisma opcional (permite uso dentro de transacciones)
 */
export async function validarBloqueoFinanciero(
  activoId: string,
  client?: PrismaDbClient
): Promise<boolean> {
  const db = (client ?? defaultPrisma) as PrismaClient;

  const activo = await db.activoFijo.findUnique({
    where: { id: activoId },
    select: {
      depreciacionAcumulada: true,
      estado: true,
    },
  });

  if (!activo) {
    return false;
  }

  const depreciacion = Number(activo.depreciacionAcumulada ?? 0);
  const esEstadoInmutable = activo.estado === "DADO_DE_BAJA" || activo.estado === "VENDIDO";

  return depreciacion > 0 || esEstadoInmutable;
}

/**
 * Detecta si un payload de actualización intenta modificar algún campo financiero crítico.
 *
 * @param payload Objeto con los campos a actualizar
 * @returns Lista de nombres de campos financieros detectados en el payload
 */
export function detectarCamposFinancierosModificados(
  payload: Record<string, any>
): CampoFinancieroBloqueado[] {
  const camposDetectados: CampoFinancieroBloqueado[] = [];

  for (const campo of CAMPOS_FINANCIEROS_BLOQUEADOS) {
    if (payload[campo] !== undefined) {
      camposDetectados.push(campo);
    }
  }

  return camposDetectados;
}

/**
 * Valida que un activo no sufra alteraciones en sus campos financieros si está bloqueado.
 * Lanza un FinancialLockError (HTTP 409) si se detectan violaciones.
 */
export async function assertFinanciallyEditable(
  activoId: string,
  payload: Record<string, any>,
  client?: PrismaDbClient
): Promise<void> {
  const camposAlterados = detectarCamposFinancierosModificados(payload);
  if (camposAlterados.length === 0) {
    return;
  }

  const estaBloqueado = await validarBloqueoFinanciero(activoId, client);
  if (estaBloqueado) {
    throw new FinancialLockError(camposAlterados);
  }
}