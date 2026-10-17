import { PrismaClient, Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export type PrismaDbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Valida si una cadena cumple con el formato oficial de código de activo: ACT-YYYY-NNNN
 * Ejemplo: ACT-2026-0001
 */
export function esCodigoActivoValido(codigo: string): boolean {
  return /^ACT-\d{4}-\d{4,}$/.test(codigo);
}

/**
 * Formatea un año y una secuencia en el código institucional ACT-YYYY-NNNN
 */
export function formatearCodigoActivo(anio: number, secuencia: number): string {
  if (secuencia <= 0) {
    throw new Error("La secuencia debe ser un entero positivo mayor a cero.");
  }
  return `ACT-${anio}-${secuencia.toString().padStart(4, "0")}`;
}

/**
 * Descompone un código institucional en año y secuencia numérica
 */
export function parsearCodigoActivo(codigo: string): { anio: number; secuencia: number } | null {
  const match = codigo.match(/^ACT-(\d{4})-(\d+)$/);
  if (!match) return null;
  return {
    anio: parseInt(match[1], 10),
    secuencia: parseInt(match[2], 10),
  };
}

/**
 * Genera el siguiente código correlativo anual único para activos fijos (ACT-YYYY-NNNN)
 * garantizando unicidad y compatibilidad con transacciones ACID de Prisma.
 *
 * @param client Instancia de PrismaClient o Prisma TransactionClient (para usar dentro de prisma.$transaction)
 * @param anioReferencia Año para la secuencia correlativa (por defecto, año actual)
 */
export async function generarCodigoActivo(
  client?: PrismaDbClient,
  anioReferencia?: number
): Promise<string> {
  const db = (client ?? defaultPrisma) as PrismaClient;
  const anio = anioReferencia ?? new Date().getFullYear();
  const prefix = `ACT-${anio}-`;

  const activosDelAnio = await db.activoFijo.findMany({
    where: {
      codigo: {
        startsWith: prefix,
      },
    },
    select: {
      codigo: true,
    },
  });

  let maxSecuencia = 0;
  for (const activo of activosDelAnio) {
    const parsed = parsearCodigoActivo(activo.codigo);
    if (parsed && parsed.anio === anio && parsed.secuencia > maxSecuencia) {
      maxSecuencia = parsed.secuencia;
    }
  }

  const siguienteSecuencia = maxSecuencia + 1;
  return formatearCodigoActivo(anio, siguienteSecuencia);
}