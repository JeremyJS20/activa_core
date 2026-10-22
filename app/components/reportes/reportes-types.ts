export interface InventarioKpis {
  cantidadActivos: number;
  costoTotalAdquisicion: string;
  depreciacionAcumulada: string;
  valorEnLibrosTotal: string;
}

export interface InventarioRow {
  id: string;
  codigo: string;
  descripcion: string;
  numeroSerie: string | null;
  fechaAdquisicion: string;
  costoAdquisicion: string;
  depreciacionAcumulada: string;
  valorEnLibros: string;
  estado: string;
  tipoActivo: { id: string; descripcion: string; vidaUtilMeses: number } | null;
  departamento: { id: string; descripcion: string } | null;
  custodio: { id: string; nombre: string; cedula: string } | null;
}

export interface InventarioResponse {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    sort: "codigo" | "descripcion" | "costo" | "fecha";
    dir: "asc" | "desc";
  };
  kpis: InventarioKpis;
  data: InventarioRow[];
}

export type EstadoActivoFiltro = "ACTIVO" | "EN_MANTENIMIENTO" | "DADO_DE_BAJA";

export interface ReportFilters {
  fechaInicio: string;
  fechaFin: string;
  montoMin: string;
  montoMax: string;
  departamentoId: string;
  tipoActivoId: string;
  custodio: string;
  search: string;
  estados: EstadoActivoFiltro[];
}

export const EMPTY_FILTERS: ReportFilters = {
  fechaInicio: "",
  fechaFin: "",
  montoMin: "",
  montoMax: "",
  departamentoId: "",
  tipoActivoId: "",
  custodio: "",
  search: "",
  estados: [],
};

export const ESTADOS_ACTIVO: Array<{ value: EstadoActivoFiltro; label: string }> = [
  { value: "ACTIVO", label: "Activo" },
  { value: "EN_MANTENIMIENTO", label: "En mantenimiento" },
  { value: "DADO_DE_BAJA", label: "Dado de baja" },
];

/** Convierte los filtros en querystring (omite valores vacíos). */
export function filtersToSearchParams(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.fechaInicio) params.set("fechaInicio", filters.fechaInicio);
  if (filters.fechaFin) params.set("fechaFin", filters.fechaFin);
  if (filters.montoMin) params.set("montoMin", filters.montoMin);
  if (filters.montoMax) params.set("montoMax", filters.montoMax);
  if (filters.departamentoId) params.set("departamentoId", filters.departamentoId);
  if (filters.tipoActivoId) params.set("tipoActivoId", filters.tipoActivoId);
  if (filters.custodio) params.set("custodio", filters.custodio);
  if (filters.search) params.set("search", filters.search);
  if (filters.estados.length > 0) params.set("estados", filters.estados.join(","));
  return params;
}

/** Reconstruye los filtros desde el querystring (fuente de verdad del estado). */
export function searchParamsToFilters(params: URLSearchParams): ReportFilters {
  const estadosRaw = params.get("estados") ?? "";
  const estados = estadosRaw
    .split(",")
    .map((e) => e.trim().toUpperCase())
    .filter((e): e is EstadoActivoFiltro =>
      ["ACTIVO", "EN_MANTENIMIENTO", "DADO_DE_BAJA"].includes(e)
    );

  return {
    fechaInicio: params.get("fechaInicio") ?? "",
    fechaFin: params.get("fechaFin") ?? "",
    montoMin: params.get("montoMin") ?? "",
    montoMax: params.get("montoMax") ?? "",
    departamentoId: params.get("departamentoId") ?? "",
    tipoActivoId: params.get("tipoActivoId") ?? "",
    custodio: params.get("custodio") ?? "",
    search: params.get("search") ?? "",
    estados,
  };
}

/** Formato dominicano de moneda: RD$ 8,450,000.50 */
export function formatRD(value: string | number): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "RD$ 0.00";
  return `RD$ ${numeric.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Formato de conteo: 1,234 */
export function formatCount(value: number): string {
  return value.toLocaleString("es-DO");
}
