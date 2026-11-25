export type EstadoAsiento = "PENDIENTE_ENVIO" | "ENVIADO" | "ERROR";
export type EstadoAsientoFiltro = "TODOS" | EstadoAsiento;
export type SortAsiento = "fecha" | "numero";
export type DirAsiento = "asc" | "desc";
export type PageSizeAsientos = 10 | 25 | 50;

export interface ContabilidadQuery {
  estado: EstadoAsientoFiltro;
  periodo: string;
  page: number;
  pageSize: PageSizeAsientos;
  sort: SortAsiento;
  dir: DirAsiento;
}

export interface AsientoListado {
  id: string;
  numeroAsiento: string;
  concepto: string;
  fechaContable: string;
  estado: EstadoAsiento | string;
  totalDebito: string;
  totalCredito: string;
  intentosEnvio: number;
  transaccionWsId: string | null;
  periodo: { anio: number; mes: number; estado: string };
}

export interface AsientosKpis {
  total: number;
  pendientes: number;
  enviados: number;
  errores: number;
}

export interface AsientosMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AsientosResponse {
  data: AsientoListado[];
  kpis: AsientosKpis;
  meta: AsientosMeta;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  message?: string;
  errors?: Record<string, string> | Array<{ message?: string }>;
}

export interface LineaDetalle {
  id: string;
  tipoInventario: string | null;
  cuentaContable: string;
  tipoMovimiento: "DB" | "CR";
  monto: string;
  descripcion: string;
}

export interface AsientoDetalle {
  id: string;
  numeroAsiento: string;
  concepto: string;
  fechaContable: string;
  estado: EstadoAsiento | string;
  totalDebito: string;
  totalCredito: string;
  balance: string;
  intentosEnvio: number;
  transaccionWsId: string | null;
  codigoRespuestaWs: string | null;
  mensajeRespuestaWs: string | null;
  fechaEnvioWs: string | null;
  periodo: { id: string; anio: number; mes: number; estado: string };
  lineas: LineaDetalle[];
  ultimoIntento: {
    intento: number;
    resultado: string;
    httpStatus: number | null;
    mensaje: string | null;
    createdAt: string;
  } | null;
  puedeDespachar: boolean;
  puedeReintentar: boolean;
}

export interface AsientoDetalleResponse {
  data: AsientoDetalle;
}

export interface BitacoraItem {
  id: string;
  asientoId: string;
  numeroAsiento: string;
  usuario: { id: string; correo: string };
  intento: number;
  payload: unknown;
  endpoint: string;
  httpStatus: number | null;
  respuesta: unknown;
  mensaje: string | null;
  duracionMs: number;
  resultado: string;
  correlationId: string;
  createdAt: string;
}

export interface BitacoraResponse {
  data: BitacoraItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface AccionAsientoResultado {
  asientoId: string;
  numeroAsiento: string;
  estado: EstadoAsiento | string;
  transaccionWsId: string | null;
  codigoRespuestaWs?: string | null;
  fechaEnvioWs?: string | null;
  intento: number;
  duracionMs?: number;
}

export interface AccionAsientoResponse {
  data: AccionAsientoResultado;
}

export interface BatchResultadoItem {
  asientoId: string;
  numeroAsiento: string;
  estado: EstadoAsiento | string;
  transaccionWsId?: string | null;
  codigo?: string;
  mensaje?: string;
}

export interface BatchResultado {
  total: number;
  enviados: number;
  errores: number;
  restantes: number;
  resultados: BatchResultadoItem[];
}

export interface BatchResponse {
  data: BatchResultado;
}

export const MENSAJES_INTEGRACION: Record<string, string> = {
  ASIENTO_NOT_FOUND: "El asiento ya no existe o fue eliminado.",
  ASIENTO_ALREADY_SENT:
    "El asiento ya fue enviado a Contabilidad. No se puede despachar dos veces.",
  ASIENTO_NOT_RETRYABLE:
    "El asiento no admite reintento en su estado actual. Solo los asientos con error pueden reintentarse.",
  ASIENTO_SIN_LINEAS: "El asiento no tiene líneas contables para enviar.",
  ASIENTO_UNBALANCED:
    "El asiento no está cuadrado: el total de débitos no coincide con el de créditos.",
  TIPO_INVENTARIO_UNRESOLVED:
    "No fue posible resolver el tipo de inventario de una o más líneas del asiento.",
  WS_TIMEOUT:
    "El Web Service de Contabilidad no respondió a tiempo. El asiento quedó en error y puede reintentarse.",
  WS_REJECTED: "El Web Service rechazó el asiento. Revise el detalle del rechazo.",
  WS_SERVER_ERROR:
    "El Web Service de Contabilidad presentó un error interno. El asiento quedó en error y puede reintentarse.",
  WS_INVALID_RESPONSE:
    "El Web Service devolvió una respuesta inválida. El asiento quedó en error y puede reintentarse.",
  WS_NETWORK_ERROR:
    "No fue posible conectar con el Web Service de Contabilidad. El asiento quedó en error y puede reintentarse.",
  AUDIT_LOG_FAILED:
    "No fue posible registrar la bitácora del envío. La operación fue revertida para preservar la trazabilidad.",
  BATCH_START_FAILED:
    "No fue posible iniciar el despacho por lote. Intente nuevamente.",
  FORBIDDEN:
    "No posee privilegios suficientes para esta operación. Se requiere INT_MANAGE o ACC_POST_SEND.",
  UNAUTHORIZED: "Su sesión expiró o no es válida. Inicie sesión nuevamente.",
};

/** Extrae el mensaje más útil de un problem+json de integración. */
export function mensajeDeErrorIntegracion(
  problem: ProblemDetails | null,
  fallback = "No fue posible completar la operación de integración."
): string {
  if (!problem) return fallback;

  if (problem.code && MENSAJES_INTEGRACION[problem.code]) {
    return MENSAJES_INTEGRACION[problem.code];
  }

  if (Array.isArray(problem.errors)) {
    const primero = problem.errors[0]?.message;
    if (primero) return primero;
  } else if (problem.errors) {
    const primero = Object.values(problem.errors)[0];
    if (primero) return primero;
  }

  return problem.detail || problem.message || problem.title || fallback;
}

export const DEFAULT_CONTABILIDAD_QUERY: ContabilidadQuery = {
  estado: "TODOS",
  periodo: "",
  page: 1,
  pageSize: 10,
  sort: "fecha",
  dir: "desc",
};

export const ESTADOS_ASIENTO: Array<{ value: EstadoAsientoFiltro; label: string }> = [
  { value: "TODOS", label: "Todos los Estados" },
  { value: "PENDIENTE_ENVIO", label: "Pendiente de envío" },
  { value: "ENVIADO", label: "Enviado" },
  { value: "ERROR", label: "Con error" },
];

export const PAGE_SIZES_ASIENTOS: PageSizeAsientos[] = [10, 25, 50];

const ESTADOS_VALIDOS: EstadoAsientoFiltro[] = [
  "TODOS",
  "PENDIENTE_ENVIO",
  "ENVIADO",
  "ERROR",
];

const SORTS_VALIDOS: SortAsiento[] = ["fecha", "numero"];
const DIRS_VALIDAS: DirAsiento[] = ["asc", "desc"];

function esPageSizeValido(value: number): value is PageSizeAsientos {
  return value === 10 || value === 25 || value === 50;
}

/** Reconstruye el estado de la consola desde el querystring (fuente de verdad). */
export function parseContabilidadQuery(
  params: Pick<URLSearchParams, "get">
): ContabilidadQuery {
  const estadoRaw = (params.get("estado") ?? "").toUpperCase();
  const estado = ESTADOS_VALIDOS.includes(estadoRaw as EstadoAsientoFiltro)
    ? (estadoRaw as EstadoAsientoFiltro)
    : DEFAULT_CONTABILIDAD_QUERY.estado;

  const periodoRaw = params.get("periodo") ?? "";
  const periodo = /^\d{4}-(0[1-9]|1[0-2])$/.test(periodoRaw) ? periodoRaw : "";

  const pageRaw = Number(params.get("page") ?? "1");
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const pageSizeRaw = Number(params.get("pageSize") ?? "10");
  const pageSize = esPageSizeValido(pageSizeRaw)
    ? pageSizeRaw
    : DEFAULT_CONTABILIDAD_QUERY.pageSize;

  const sortRaw = (params.get("sort") ?? "").toLowerCase();
  const sort = SORTS_VALIDOS.includes(sortRaw as SortAsiento)
    ? (sortRaw as SortAsiento)
    : DEFAULT_CONTABILIDAD_QUERY.sort;

  const dirRaw = (params.get("dir") ?? "").toLowerCase();
  const dir = DIRS_VALIDAS.includes(dirRaw as DirAsiento)
    ? (dirRaw as DirAsiento)
    : DEFAULT_CONTABILIDAD_QUERY.dir;

  return { estado, periodo, page, pageSize, sort, dir };
}

/** Serializa omitiendo los valores por defecto para mantener la URL limpia. */
export function contabilidadQueryToSearchParams(query: ContabilidadQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.estado !== "TODOS") params.set("estado", query.estado);
  if (query.periodo) params.set("periodo", query.periodo);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== 10) params.set("pageSize", String(query.pageSize));
  if (query.sort !== "fecha") params.set("sort", query.sort);
  if (query.dir !== "desc") params.set("dir", query.dir);
  return params;
}

/** Querystring del endpoint GET /api/contabilidad/asientos. */
export function contabilidadQueryToApiParams(query: ContabilidadQuery): URLSearchParams {
  const params = new URLSearchParams({
    estado: query.estado,
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
    dir: query.dir,
  });
  if (query.periodo) params.set("periodo", query.periodo);
  return params;
}

const MESES = [
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

export function nombrePeriodo(anio: number, mes: number): string {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return "—";
  }
  return `${MESES[mes - 1]} ${anio}`;
}

export function codigoPeriodo(anio: number, mes: number): string {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return "—";
  }
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

const FORMATO_MONEDA = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  roundingMode: "halfExpand",
});

/** Formato dominicano de moneda: RD$ 47,812.50 (Half-Up a 2 decimales). */
export function formatRD(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "RD$ 0.00";
  return `RD$ ${FORMATO_MONEDA.format(numeric)}`;
}

/** Formato de conteo: 1,234 */
export function formatCount(value: number): string {
  return value.toLocaleString("es-DO");
}

/** Fecha contable (ISO UTC) sin desplazamiento de zona horaria. */
export function formatFechaContable(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Fecha y hora de auditoría en hora institucional (America/Santo_Domingo). */
export function formatFechaHora(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-DO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santo_Domingo",
  });
}

export function estadoAsientoLabel(estado: string): string {
  switch (estado) {
    case "PENDIENTE_ENVIO":
      return "Pendiente de envío";
    case "ENVIADO":
      return "Enviado";
    case "ERROR":
      return "Con error";
    default:
      return estado.replace(/_/g, " ").toLowerCase();
  }
}
