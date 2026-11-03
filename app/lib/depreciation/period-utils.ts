export const ANIO_MINIMO = 2000;
export const ANIO_MAXIMO = 2100;

/** Último día del mes del período, en UTC a medianoche. */
export function fechaCorte(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes, 0));
}

/** Primer día del mes del período, en UTC a medianoche. */
export function primerDiaDelPeriodo(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes - 1, 1));
}

/** Valida que el período esté dentro del rango contable admitido. */
export function esPeriodoValido(anio: number, mes: number): boolean {
  return (
    Number.isInteger(anio) &&
    Number.isInteger(mes) &&
    anio >= ANIO_MINIMO &&
    anio <= ANIO_MAXIMO &&
    mes >= 1 &&
    mes <= 12
  );
}

/** Compara dos períodos: negativo si A < B, cero si iguales, positivo si A > B. */
export function compararPeriodos(
  a: { anio: number; mes: number },
  b: { anio: number; mes: number }
): number {
  if (a.anio !== b.anio) return a.anio - b.anio;
  return a.mes - b.mes;
}

/** Etiqueta legible del período en formato AAAAMM. */
export function etiquetaPeriodo(anio: number, mes: number): string {
  return `${anio}${String(mes).padStart(2, "0")}`;
}

/** Correlativo de asiento contable con formato DEP-AAAAMM-{SEQ}. */
export function generarNumeroAsiento(anio: number, mes: number, secuencia: number): string {
  if (!Number.isInteger(secuencia) || secuencia < 1) {
    throw new Error("INVALID_ASIENTO_SEQUENCE");
  }
  return `DEP-${etiquetaPeriodo(anio, mes)}-${String(secuencia).padStart(3, "0")}`;
}

/** Convierte una fecha al período (anio, mes) en UTC. */
export function periodoDeFecha(fecha: Date | string): { anio: number; mes: number } {
  const d = new Date(fecha);
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
}

/** Fecha contable del asiento: último día del período. */
export function fechaContable(anio: number, mes: number): Date {
  return fechaCorte(anio, mes);
}
