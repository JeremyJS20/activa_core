import { Prisma } from "@prisma/client";

export type Decimal = Prisma.Decimal;

export type TipoCuota = "NORMAL" | "ULTIMA" | "NO_DEPRECIABLE";

export interface CalcInput {
  costoAdquisicion: Decimal | string | number;
  valorResidual: Decimal | string | number;
  depreciacionAcumulada: Decimal | string | number;
  vidaUtilMeses: number;
}

export interface CalcOutput {
  cuota: Decimal;
  acumuladaNueva: Decimal;
  valorEnLibrosNuevo: Decimal;
  esCuotaFinal: boolean;
  tipoCuota: TipoCuota;
}

const CERO = new Prisma.Decimal(0);
const DECIMALES = 2;

function aDecimal(valor: Decimal | string | number): Decimal {
  return valor instanceof Prisma.Decimal ? valor : new Prisma.Decimal(valor);
}

/**
 * Calcula la cuota mensual de depreciación por Línea Recta sobre costo histórico
 * con redondeo bancario (Half Even) a dos decimales.
 *
 * cuotaMensual = ROUND_HALF_EVEN((costoAdquisicion - valorResidual) / vidaUtilMeses, 2)
 *
 * La última cuota absorbe el remanente para que el valor en libros quede
 * exactamente igual al valor residual (sin residuos de centavos).
 */
export function calcularCuota(input: CalcInput): CalcOutput {
  const costo = aDecimal(input.costoAdquisicion);
  const residual = aDecimal(input.valorResidual);
  const acumulada = aDecimal(input.depreciacionAcumulada);
  const vidaUtil = input.vidaUtilMeses;

  if (residual.greaterThan(costo)) {
    throw new Error("RESIDUAL_EXCEEDS_COST");
  }

  const depreciable = costo.minus(residual);

  if (vidaUtil <= 0) {
    throw new Error("ASSET_TYPE_INVALID_LIFE");
  }

  if (depreciable.lessThanOrEqualTo(CERO)) {
    return {
      cuota: CERO,
      acumuladaNueva: acumulada,
      valorEnLibrosNuevo: costo.minus(acumulada),
      esCuotaFinal: true,
      tipoCuota: "NO_DEPRECIABLE",
    };
  }

  if (acumulada.greaterThan(depreciable)) {
    throw new Error("DEPRECIATION_OVERFLOW");
  }

  const remanente = depreciable.minus(acumulada);

  if (remanente.lessThanOrEqualTo(CERO)) {
    return {
      cuota: CERO,
      acumuladaNueva: acumulada,
      valorEnLibrosNuevo: residual,
      esCuotaFinal: true,
      tipoCuota: "ULTIMA",
    };
  }

  const cuotaTeorica = depreciable
    .dividedBy(vidaUtil)
    .toDecimalPlaces(DECIMALES, Prisma.Decimal.ROUND_HALF_EVEN);

  const esCuotaFinal = remanente.minus(cuotaTeorica).lessThan(cuotaTeorica);
  const cuota = esCuotaFinal ? remanente.toDecimalPlaces(DECIMALES) : cuotaTeorica;
  const acumuladaNueva = acumulada.plus(cuota);

  return {
    cuota,
    acumuladaNueva,
    valorEnLibrosNuevo: costo.minus(acumuladaNueva),
    esCuotaFinal,
    tipoCuota: esCuotaFinal ? "ULTIMA" : "NORMAL",
  };
}

/** Meses transcurridos entre la adquisición y el período, contando el mes de adquisición como 1. */
export function mesesTranscurridos(
  fechaAdquisicion: Date | string,
  anio: number,
  mes: number
): number {
  const adquisicion = new Date(fechaAdquisicion);
  const anioAdq = adquisicion.getUTCFullYear();
  const mesAdq = adquisicion.getUTCMonth() + 1;
  return (anio - anioAdq) * 12 + (mes - mesAdq) + 1;
}
