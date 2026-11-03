export type EstadoPeriodo = "ABIERTO" | "CALCULADO" | "CERRADO";

export interface PeriodoRow {
  id: string;
  anio: number;
  mes: number;
  estado: EstadoPeriodo;
  fechaCorte: string;
  totalActivos: number;
  totalCuota: string;
  activosOmitidos: number;
  activosExcluidos: number;
  fechaEjecucion: string | null;
  fechaCierre: string | null;
  ejecutadoPor?: { id: string; nombre: string } | null;
  cerradoPor?: { id: string; nombre: string } | null;
}

export interface LineaAsientoRow {
  id: string;
  cuentaContable: string;
  tipoMovimiento: "DEBITO" | "CREDITO";
  monto: string;
  descripcion: string;
}

export interface AsientoRow {
  id: string;
  numeroAsiento: string;
  periodoId: string;
  concepto: string;
  fechaContable: string;
  estado: string;
  totalDebito: string;
  totalCredito: string;
  lineas: LineaAsientoRow[];
}

export interface DetalleRow {
  id: string;
  activoId: string;
  cuotaMensual: string;
  depreciacionAcumuladaAnterior: string;
  depreciacionAcumuladaNueva: string;
  valorEnLibrosAnterior: string;
  valorEnLibrosNuevo: string;
  tipoCuota: string;
  esCuotaFinal: boolean;
  activo: { id: string; codigo: string; descripcion: string };
}

export interface PeriodoDetalle extends PeriodoRow {
  detalles: DetalleRow[];
  asiento: AsientoRow | null;
}

export interface RespuestaListado<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/** Etiqueta legible: "Noviembre 2026". */
export function nombrePeriodo(anio: number, mes: number): string {
  return `${MESES[mes - 1] ?? mes} ${anio}`;
}

/** Código corto monoespaciado: "2026-11". */
export function codigoPeriodo(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

export function formatCurrency(valor: string | number | null | undefined): string {
  const numero = Number(valor ?? 0);
  return numero.toLocaleString("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatFecha(valor: string | null | undefined): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatFechaHora(valor: string | null | undefined): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Extrae un mensaje legible de una respuesta de error (RFC 7807 o RBAC). */
export async function leerMensajeError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.detail || body.message || body.title || `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}
