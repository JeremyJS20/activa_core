import { Prisma } from "@prisma/client";
import { IntegrationError } from "./errors";

/**
 * Construcción determinista del payload del Web Service de Contabilidad.
 *
 * Reglas (design.md §7):
 *  - `DEBITO` interno → `DB` en el wire; `CREDITO` → `CR`.
 *  - Importes como string decimal de 2 posiciones (sin flotantes).
 *  - El asiento debe estar cuadrado (Σ DB = Σ CR = totalDebito = totalCredito).
 *  - `tipoInventario` se resuelve por cuentas del TipoActivo:
 *      CR → cuentaContableDepreciacion (única por tipo).
 *      DB → par (cuentaGasto, cuentaDepreciacion) + monto, con una única candidata.
 *  - Orden determinista: tipoInventario, DB antes de CR, cuentaContable.
 */

export type DecimalLike = Prisma.Decimal | string | number;

export interface TipoActivoContableInfo {
  codigo: string;
  cuentaContableGastoDepreciacion?: string | null;
  cuentaContableDepreciacion: string;
  metodoDepreciacion: string;
}

export interface LineaAsientoParaPayload {
  cuentaContable: string;
  tipoMovimiento: string;
  monto: DecimalLike;
  descripcion?: string | null;
}

export interface AsientoParaPayload {
  numeroAsiento: string;
  concepto: string;
  fechaContable: Date | string;
  estado: string;
  totalDebito: DecimalLike;
  totalCredito: DecimalLike;
  lineas: LineaAsientoParaPayload[];
}

export interface LineaPayload {
  tipoInventario: string;
  cuentaContable: string;
  tipoMovimiento: "DB" | "CR";
  monto: string;
  descripcion: string;
}

export interface AsientoPayload {
  numeroAsiento: string;
  concepto: string;
  fechaAsiento: string;
  estado: string;
  lineas: LineaPayload[];
  totalDebito: string;
  totalCredito: string;
}

/** Espejo de las cuentas por defecto de Sub-03 cuando el TipoActivo no configura una. */
export const CUENTAS_GASTO_POR_METODO: Record<string, string> = {
  DGII_CAT1: "6-30-01-0001",
  DGII_CAT2: "6-30-01-0002",
  DGII_CAT3: "6-30-01-0003",
  LINEA_RECTA: "6-30-01-0002",
};

export function serializarMonto(valor: DecimalLike): string {
  return toDecimal(valor).toFixed(2);
}

export function mapearTipoMovimiento(valor: string): "DB" | "CR" {
  const normalizado = valor.trim().toUpperCase();
  if (normalizado === "DEBITO") return "DB";
  if (normalizado === "CREDITO") return "CR";
  throw new IntegrationError(
    "VALIDATION_ERROR",
    `Tipo de movimiento contable no soportado: "${valor}". Se esperaba DEBITO o CREDITO.`
  );
}

export function resolverCuentaGasto(tipo: TipoActivoContableInfo): string {
  const cuenta =
    tipo.cuentaContableGastoDepreciacion ??
    CUENTAS_GASTO_POR_METODO[tipo.metodoDepreciacion];
  if (!cuenta) {
    throw new IntegrationError(
      "TIPO_INVENTARIO_UNRESOLVED",
      `El tipo ${tipo.codigo} no posee cuenta de gasto por depreciación ni método conocido.`
    );
  }
  return cuenta;
}

interface CrResuelta {
  linea: LineaAsientoParaPayload;
  tipo: TipoActivoContableInfo;
  monto: string;
  usada: boolean;
}

function toDecimal(valor: DecimalLike): Prisma.Decimal {
  if (Prisma.Decimal.isDecimal(valor)) return valor as Prisma.Decimal;
  return new Prisma.Decimal(valor);
}

function fechaIso(valor: Date | string): string {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return valor.slice(0, 10);
}

export function construirPayloadAsiento(
  asiento: AsientoParaPayload,
  tiposActivos: TipoActivoContableInfo[]
): AsientoPayload {
  if (!asiento.lineas || asiento.lineas.length === 0) {
    throw new IntegrationError("ASIENTO_SIN_LINEAS");
  }

  const porCuentaDepreciacion = new Map<string, TipoActivoContableInfo>();
  const gastoPorCodigo = new Map<string, string>();

  for (const tipo of tiposActivos) {
    if (porCuentaDepreciacion.has(tipo.cuentaContableDepreciacion)) {
      throw new IntegrationError(
        "TIPO_INVENTARIO_UNRESOLVED",
        `La cuenta de depreciación ${tipo.cuentaContableDepreciacion} está asignada a más de un TipoActivo.`
      );
    }
    porCuentaDepreciacion.set(tipo.cuentaContableDepreciacion, tipo);
    gastoPorCodigo.set(tipo.codigo, resolverCuentaGasto(tipo));
  }

  const debitos = asiento.lineas.filter(
    (linea) => linea.tipoMovimiento.trim().toUpperCase() === "DEBITO"
  );
  const creditos = asiento.lineas.filter(
    (linea) => linea.tipoMovimiento.trim().toUpperCase() === "CREDITO"
  );

  // Valida movimientos no soportados (lanza VALIDATION_ERROR).
  asiento.lineas.forEach((linea) => mapearTipoMovimiento(linea.tipoMovimiento));

  const sumaDebito = debitos.reduce(
    (acc, linea) => acc.plus(toDecimal(linea.monto)),
    new Prisma.Decimal(0)
  );
  const sumaCredito = creditos.reduce(
    (acc, linea) => acc.plus(toDecimal(linea.monto)),
    new Prisma.Decimal(0)
  );
  const totalDebito = toDecimal(asiento.totalDebito);
  const totalCredito = toDecimal(asiento.totalCredito);

  if (
    !sumaDebito.equals(sumaCredito) ||
    !totalDebito.equals(sumaDebito) ||
    !totalCredito.equals(sumaCredito) ||
    !totalDebito.equals(totalCredito)
  ) {
    throw new IntegrationError(
      "ASIENTO_UNBALANCED",
      `Asiento descuadrado: líneas DB ${sumaDebito.toFixed(2)} / CR ${sumaCredito.toFixed(2)}; totales declarados DB ${totalDebito.toFixed(2)} / CR ${totalCredito.toFixed(2)}.`
    );
  }

  const crResueltas: CrResuelta[] = creditos.map((linea) => {
    const tipo = porCuentaDepreciacion.get(linea.cuentaContable);
    if (!tipo) {
      throw new IntegrationError(
        "TIPO_INVENTARIO_UNRESOLVED",
        `La cuenta de crédito ${linea.cuentaContable} no pertenece a ningún TipoActivo.`
      );
    }
    return { linea, tipo, monto: serializarMonto(linea.monto), usada: false };
  });

  const lineas: LineaPayload[] = [];

  for (const lineaDb of debitos) {
    const montoDb = serializarMonto(lineaDb.monto);
    const candidatas = crResueltas.filter(
      (cr) =>
        !cr.usada &&
        cr.monto === montoDb &&
        gastoPorCodigo.get(cr.tipo.codigo) === lineaDb.cuentaContable
    );

    if (candidatas.length !== 1) {
      throw new IntegrationError(
        "TIPO_INVENTARIO_UNRESOLVED",
        `No se pudo resolver de forma única el tipo de inventario para la cuenta de débito ${lineaDb.cuentaContable} (monto ${montoDb}): ${candidatas.length} candidatas.`
      );
    }

    const [candidata] = candidatas;
    candidata.usada = true;
    lineas.push({
      tipoInventario: candidata.tipo.codigo,
      cuentaContable: lineaDb.cuentaContable,
      tipoMovimiento: "DB",
      monto: montoDb,
      descripcion: lineaDb.descripcion?.trim() || asiento.concepto,
    });
    lineas.push({
      tipoInventario: candidata.tipo.codigo,
      cuentaContable: candidata.linea.cuentaContable,
      tipoMovimiento: "CR",
      monto: candidata.monto,
      descripcion: candidata.linea.descripcion?.trim() || asiento.concepto,
    });
  }

  if (crResueltas.some((cr) => !cr.usada)) {
    throw new IntegrationError(
      "ASIENTO_UNBALANCED",
      "Existen líneas de crédito sin un débito correspondiente en el asiento."
    );
  }

  lineas.sort((a, b) => {
    const porTipo = a.tipoInventario.localeCompare(b.tipoInventario);
    if (porTipo !== 0) return porTipo;
    const ordenMovimiento = a.tipoMovimiento === b.tipoMovimiento ? 0 : a.tipoMovimiento === "DB" ? -1 : 1;
    if (ordenMovimiento !== 0) return ordenMovimiento;
    return a.cuentaContable.localeCompare(b.cuentaContable);
  });

  return {
    numeroAsiento: asiento.numeroAsiento,
    concepto: asiento.concepto,
    fechaAsiento: fechaIso(asiento.fechaContable),
    estado: asiento.estado,
    lineas,
    totalDebito: totalDebito.toFixed(2),
    totalCredito: totalCredito.toFixed(2),
  };
}
