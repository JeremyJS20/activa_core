import { Prisma } from "@prisma/client";
import { mesesTranscurridos } from "./depreciation-calculator";

export const MOTIVOS_EXCLUSION = [
  "ESTADO_NO_DEPRECIABLE",
  "ADQUIRIDO_DESPUES_DEL_CORTE",
  "BAJA_ANTERIOR_AL_PERIODO",
  "TIPO_ACTIVO_INACTIVO",
  "VIDA_UTIL_AGOTADA",
  "SIN_REMANENTE",
  // Anomalías de datos: no se excluyen en silencio, abortan la corrida (design.md §Error Handling).
  "VIDA_UTIL_INVALIDA",
  "RESIDUAL_EXCEEDS_COST",
] as const;

export type MotivoExclusion = (typeof MOTIVOS_EXCLUSION)[number];

export const ESTADOS_DEPRECIABLES = ["ACTIVO", "EN_MANTENIMIENTO"] as const;
export const ESTADOS_NO_DEPRECIABLES = ["DADO_DE_BAJA", "VENDIDO"] as const;

export interface EvaluacionUniversoInput {
  estadoActivo: string;
  fechaAdquisicion: Date | string;
  fechaBaja?: Date | string | null;
  estadoTipoActivo: string;
  costoAdquisicion: Prisma.Decimal | string | number;
  valorResidual: Prisma.Decimal | string | number;
  depreciacionAcumulada: Prisma.Decimal | string | number;
  vidaUtilMeses: number;
  anio: number;
  mes: number;
}

export interface EvaluacionUniverso {
  depreciable: boolean;
  motivo: MotivoExclusion | null;
  indiceMes: number;
}

function aDecimal(valor: Prisma.Decimal | string | number): Prisma.Decimal {
  return valor instanceof Prisma.Decimal ? valor : new Prisma.Decimal(valor);
}

function inicioDelPeriodo(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes - 1, 1));
}

function finDelPeriodo(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes, 0, 23, 59, 59, 999));
}

/**
 * Determina si un activo pertenece al universo depreciable de un período.
 * Función pura: no accede a base de datos ni produce efectos secundarios.
 */
export function evaluarDepreciabilidad(input: EvaluacionUniversoInput): EvaluacionUniverso {
  const indiceMes = mesesTranscurridos(input.fechaAdquisicion, input.anio, input.mes);

  if (input.estadoActivo === "DADO_DE_BAJA" || input.estadoActivo === "VENDIDO") {
    return { depreciable: false, motivo: "ESTADO_NO_DEPRECIABLE", indiceMes };
  }

  if (!(ESTADOS_DEPRECIABLES as readonly string[]).includes(input.estadoActivo)) {
    return { depreciable: false, motivo: "ESTADO_NO_DEPRECIABLE", indiceMes };
  }

  if (input.estadoTipoActivo !== "ACTIVO") {
    return { depreciable: false, motivo: "TIPO_ACTIVO_INACTIVO", indiceMes };
  }

  const adquisicion = new Date(input.fechaAdquisicion);
  if (adquisicion.getTime() > finDelPeriodo(input.anio, input.mes).getTime()) {
    return { depreciable: false, motivo: "ADQUIRIDO_DESPUES_DEL_CORTE", indiceMes };
  }

  if (indiceMes < 1) {
    return { depreciable: false, motivo: "ADQUIRIDO_DESPUES_DEL_CORTE", indiceMes };
  }

  if (input.fechaBaja) {
    const baja = new Date(input.fechaBaja);
    if (baja.getTime() < inicioDelPeriodo(input.anio, input.mes).getTime()) {
      return { depreciable: false, motivo: "BAJA_ANTERIOR_AL_PERIODO", indiceMes };
    }
  }

  if (input.vidaUtilMeses <= 0) {
    // Dato inválido del catálogo fiscal: el servicio aborta con ASSET_TYPE_INVALID_LIFE.
    return { depreciable: false, motivo: "VIDA_UTIL_INVALIDA", indiceMes };
  }

  const costo = aDecimal(input.costoAdquisicion);
  const residual = aDecimal(input.valorResidual);
  const acumulada = aDecimal(input.depreciacionAcumulada);

  // Anomalía de datos del activo: se evalúa antes de la vida agotada para que el
  // servicio aborte en lugar de omitir silenciosamente un activo inconsistente.
  if (residual.greaterThan(costo)) {
    return { depreciable: false, motivo: "RESIDUAL_EXCEEDS_COST", indiceMes };
  }

  if (indiceMes > input.vidaUtilMeses) {
    return { depreciable: false, motivo: "VIDA_UTIL_AGOTADA", indiceMes };
  }

  const depreciable = costo.minus(residual);

  if (depreciable.lessThanOrEqualTo(0) || acumulada.greaterThanOrEqualTo(depreciable)) {
    return { depreciable: false, motivo: "SIN_REMANENTE", indiceMes };
  }

  return { depreciable: true, motivo: null, indiceMes };
}
