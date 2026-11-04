import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DepreciationError } from "@/lib/depreciation/errors";
import { fechaContable, generarNumeroAsiento } from "@/lib/depreciation/period-utils";

/** Cuenta de gasto por defecto según el método fiscal DGII. */
export const CUENTAS_GASTO_POR_METODO: Record<string, string> = {
  DGII_CAT1: "6-30-01-0001",
  DGII_CAT2: "6-30-01-0002",
  DGII_CAT3: "6-30-01-0003",
  LINEA_RECTA: "6-30-01-0002",
};

export interface TipoActivoContable {
  cuentaContableGastoDepreciacion: string | null;
  cuentaContableDepreciacion: string;
  metodoDepreciacion: string;
}

export interface GrupoAsiento {
  cuentaGasto: string;
  cuentaDepreciacion: string;
  monto: Prisma.Decimal;
}

/** Resuelve la cuenta de gasto: valor configurado o valor por defecto del método. */
export function resolverCuentaGasto(tipo: TipoActivoContable): string {
  const cuenta =
    tipo.cuentaContableGastoDepreciacion ?? CUENTAS_GASTO_POR_METODO[tipo.metodoDepreciacion];
  if (!cuenta) {
    throw new DepreciationError(
      "DEPRECIATION_EXPENSE_ACCOUNT_MISSING",
      `El tipo de activo con método ${tipo.metodoDepreciacion} no posee cuenta de gasto por depreciación configurada.`
    );
  }
  return cuenta;
}

export interface CrearAsientoInput {
  periodoId: string;
  anio: number;
  mes: number;
  grupos: GrupoAsiento[];
  total: Prisma.Decimal;
}

/**
 * Crea el asiento consolidado del período (débito gasto / crédito depreciación acumulada).
 * Es idempotente: reemplaza el asiento previo del período dentro de la misma transacción.
 */
export async function crearAsiento(
  tx: Prisma.TransactionClient,
  input: CrearAsientoInput
) {
  const totalDebito = input.grupos.reduce(
    (acc, g) => acc.plus(g.monto),
    new Prisma.Decimal(0)
  );
  const totalCredito = totalDebito;

  if (!totalDebito.equals(input.total)) {
    throw new DepreciationError(
      "ASIENTO_UNBALANCED",
      "La suma de las líneas del asiento no coincide con el total de la corrida."
    );
  }

  if (!totalDebito.equals(totalCredito)) {
    throw new DepreciationError("ASIENTO_UNBALANCED");
  }

  if (input.grupos.length === 0) {
    throw new DepreciationError(
      "ASIENTO_UNBALANCED",
      "No existen líneas para generar el asiento contable del período."
    );
  }

  // Un asiento ya enviado a contabilidad es inmutable: la corrida no puede regenerarlo.
  const existente = await tx.asientoContable.findUnique({
    where: { periodoId: input.periodoId },
  });
  if (existente && existente.estado !== "PENDIENTE_ENVIO") {
    throw new DepreciationError(
      "ASIENTO_ALREADY_EXISTS",
      `El asiento ${existente.numeroAsiento} ya fue enviado a contabilidad y no puede regenerarse.`
    );
  }

  await tx.asientoContable.deleteMany({ where: { periodoId: input.periodoId } });

  const lineas: Prisma.LineaAsientoCreateWithoutAsientoInput[] = [];
  for (const grupo of input.grupos) {
    lineas.push({
      cuentaContable: grupo.cuentaGasto,
      tipoMovimiento: "DEBITO",
      monto: grupo.monto,
      descripcion: `Gasto por depreciación ${String(input.mes).padStart(2, "0")}/${input.anio}`,
    });
    lineas.push({
      cuentaContable: grupo.cuentaDepreciacion,
      tipoMovimiento: "CREDITO",
      monto: grupo.monto,
      descripcion: `Depreciación acumulada ${String(input.mes).padStart(2, "0")}/${input.anio}`,
    });
  }

  return tx.asientoContable.create({
    data: {
      numeroAsiento: generarNumeroAsiento(input.anio, input.mes, 1),
      periodoId: input.periodoId,
      concepto: `Depreciación ${String(input.mes).padStart(2, "0")}/${input.anio}`,
      fechaContable: fechaContable(input.anio, input.mes),
      estado: "PENDIENTE_ENVIO",
      totalDebito,
      totalCredito,
      lineas: { create: lineas },
    },
    include: { lineas: true },
  });
}

export interface ListarAsientosInput {
  page: number;
  pageSize: number;
  estado: "PENDIENTE_ENVIO" | "ENVIADO" | "ERROR" | "TODOS";
}

export async function listarAsientos(input: ListarAsientosInput) {
  const where: Prisma.AsientoContableWhereInput = {};
  if (input.estado !== "TODOS") {
    where.estado = input.estado;
  }

  const [total, items] = await Promise.all([
    prisma.asientoContable.count({ where }),
    prisma.asientoContable.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        lineas: true,
        periodo: { select: { id: true, anio: true, mes: true, estado: true } },
      },
    }),
  ]);

  return { items, total };
}
