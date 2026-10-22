"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { User, ArrowDown, ArrowUp, ArrowUpDown, AlertCircle } from "lucide-react";
import { ReportDataTable } from "@/components/reportes/report-data-table";
import { KpiCards } from "@/components/reportes/kpi-cards";
import { EstadoPill } from "@/components/reportes/estado-pill";
import { EmptyState } from "@/components/reportes/empty-state";
import { useDebouncedValue } from "@/components/reportes/use-debounced-value";
import {
  EMPTY_FILTERS,
  ESTADOS_ACTIVO,
  filtersToSearchParams,
  formatRD,
  searchParamsToFilters,
  type EstadoActivoFiltro,
  type InventarioResponse,
  type ReportFilters,
} from "@/components/reportes/reportes-types";

type SortField = "codigo" | "descripcion" | "costo" | "fecha";
type SortDir = "asc" | "desc";

interface CatalogoOption {
  id: string;
  identifier: string;
  label: string;
}

export function InventarioContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryString = searchParams.toString();
  // Ventana de estabilización de 300ms: el URL sigue siendo la fuente de verdad,
  // pero solo se consulta la API una vez consolidados los cambios (REQ-REP-001).
  const debouncedQuery = useDebouncedValue(queryString, 300);

  const filters = useMemo(
    () => searchParamsToFilters(new URLSearchParams(debouncedQuery)),
    [debouncedQuery]
  );

  const sort = (searchParams.get("sort") as SortField | null) ?? "codigo";
  const dir = (searchParams.get("dir") as SortDir | null) ?? "asc";
  const requestedPage = Number(searchParams.get("page") ?? "1") || 1;
  const requestedLimit = Number(searchParams.get("pageSize") ?? "10") || 10;

  const [data, setData] = useState<InventarioResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departamentos, setDepartamentos] = useState<CatalogoOption[]>([]);
  const [tiposActivos, setTiposActivos] = useState<CatalogoOption[]>([]);

  const replaceQuery = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  // Consulta del inventario (endpoint del Sub-04)
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const query = debouncedQuery === "" ? "page=1&pageSize=10" : debouncedQuery;
        const res = await fetch(`/api/reportes/inventario?${query}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const problem = await res.json().catch(() => null);
          const detail = problem?.errors
            ? Object.values(problem.errors as Record<string, string>)[0]
            : problem?.detail;
          throw new Error(detail || "No fue posible consultar el inventario.");
        }

        const json: InventarioResponse = await res.json();
        if (active) {
          setData(json);
          // Clamp de página si el resultset se reduce entre consultas
          if (json.meta.totalPages > 0 && json.meta.page !== requestedPage && requestedPage > json.meta.totalPages) {
            const params = new URLSearchParams(debouncedQuery);
            params.set("page", String(json.meta.totalPages));
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }
        }
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Error inesperado al consultar.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedQuery, pathname, requestedPage, router]);

  // Catálogos maestros reales (Sub-01)
  useEffect(() => {
    let active = true;

    async function loadCatalogs() {
      try {
        const [deptosRes, tiposRes] = await Promise.all([
          fetch("/api/departamentos?page=1&limit=100&estado=ACTIVO"),
          fetch("/api/tipos-activos?page=1&limit=100"),
        ]);

        if (!active) return;

        if (deptosRes.ok) {
          const json = await deptosRes.json();
          if (active) {
            setDepartamentos(
              (json.data ?? []).map((d: { id: string; codigo: string; descripcion: string }) => ({
                id: d.id,
                identifier: d.codigo,
                label: `${d.codigo} · ${d.descripcion}`,
              }))
            );
          }
        }
        if (tiposRes.ok) {
          const json = await tiposRes.json();
          if (active) {
            setTiposActivos(
              (json.data ?? []).map((t: { id: string; codigo: string; descripcion: string }) => ({
                id: t.id,
                identifier: t.codigo,
                label: `${t.codigo} · ${t.descripcion}`,
              }))
            );
          }
        }
      } catch (err) {
        console.error("[REPORTES_FILTROS] No se pudieron cargar los catálogos:", err);
      }
    }

    loadCatalogs();
    return () => {
      active = false;
    };
  }, []);

  const estadoSingle = filters.estados.length === 0 ? "TODOS" : filters.estados[0];

  // Cambiar cualquier filtro reinicia a la página 1 (patrón de catálogos).
  const applyFilters = useCallback(
    (patch: Partial<ReportFilters>) => {
      const next: ReportFilters = { ...filters, ...patch };
      const params = filtersToSearchParams(next);
      if (dir !== "asc") params.set("dir", dir);
      if (sort !== "codigo") params.set("sort", sort);
      if (requestedLimit !== 10) params.set("pageSize", String(requestedLimit));
      replaceQuery(params);
    },
    [filters, dir, sort, requestedLimit, replaceQuery]
  );

  const resetFilters = useCallback(() => {
    replaceQuery(filtersToSearchParams(EMPTY_FILTERS));
  }, [replaceQuery]);

  const changePage = useCallback(
    (nextPage: number) => {
      const params = filtersToSearchParams(filters);
      if (sort !== "codigo") params.set("sort", sort);
      if (dir !== "asc") params.set("dir", dir);
      if (nextPage > 1) params.set("page", String(nextPage));
      if (requestedLimit !== 10) params.set("pageSize", String(requestedLimit));
      replaceQuery(params);
    },
    [filters, sort, dir, requestedLimit, replaceQuery]
  );

  const toggleSort = useCallback(
    (field: SortField) => {
      const nextDir: SortDir = sort === field && dir === "asc" ? "desc" : "asc";
      const params = filtersToSearchParams(filters);
      params.set("sort", field);
      params.set("dir", nextDir);
      if (requestedLimit !== 10) params.set("pageSize", String(requestedLimit));
      replaceQuery(params);
    },
    [filters, sort, dir, requestedLimit, replaceQuery]
  );

  const total = data?.meta.total ?? 0;
  const page = data?.meta.page ?? requestedPage;
  const totalPages = data?.meta.totalPages ?? 0;
  const rows = data?.data ?? [];

  const SORTABLE_COLUMNS: Array<{ key: SortField; label: string; align?: "right" }> = [
    { key: "codigo", label: "Código" },
    { key: "descripcion", label: "Descripción / Activo" },
    { key: "costo", label: "Costo (RD$)", align: "right" },
    { key: "fecha", label: "Adquisición" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI metric cards (sobre el conjunto filtrado — REQ-REP-002) */}
      <KpiCards kpis={data?.kpis ?? null} isLoading={isLoading} />

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium bg-rose-50 border-rose-200 text-rose-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <ReportDataTable
        title="Inventario de Activos Fijos"
        reporteKey="inventario"
        subtitle="Consultas multicriterio del parque institucional con trazabilidad de custodia y valor en libros."
        searchPlaceholder="Buscar por código, descripción o serial..."
        searchValue={filters.search}
        onSearchChange={(value) => applyFilters({ search: value })}
        onRefresh={() => replaceQuery(searchParams)}
        isLoading={isLoading}
        totalCount={total}
        page={page}
        limit={data?.meta.pageSize ?? requestedLimit}
        totalPages={totalPages}
        onPageChange={changePage}
        emptyTitle="No se encontraron activos"
        emptyDescription="Ningún activo coincide con los filtros seleccionados. Ajuste los criterios o restablezca la consulta."
        filters={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Filtro Departamento */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 font-mono">Depto:</label>
              <select
                value={filters.departamentoId}
                onChange={(e) => applyFilters({ departamentoId: e.target.value })}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors max-w-[160px] truncate"
              >
                <option value="">Todos los Departamentos</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Tipo de Activo */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 font-mono">Tipo:</label>
              <select
                value={filters.tipoActivoId}
                onChange={(e) => applyFilters({ tipoActivoId: e.target.value })}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors max-w-[180px] truncate"
              >
                <option value="">Todos los Tipos</option>
                {tiposActivos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Custodio */}
            <label className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 font-mono whitespace-nowrap">
                Custodio:
              </span>
              <input
                type="text"
                placeholder="Nombre o cédula"
                value={filters.custodio}
                onChange={(e) => applyFilters({ custodio: e.target.value })}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 w-32 sm:w-40 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
              />
            </label>

            {/* Filtro Estado (patrón de catálogos: select único estilo TODOS) */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 font-mono">Estado:</label>
              <select
                value={estadoSingle}
                onChange={(e) => {
                  applyFilters({
                    estados: e.target.value === "TODOS" ? [] : [e.target.value as EstadoActivoFiltro],
                  });
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
              >
                <option value="TODOS">Todos los Estados</option>
                {ESTADOS_ACTIVO.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            title="No hay resultados en esta página"
            onReset={resetFilters}
          />
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              <tr>
                {SORTABLE_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    className={`px-5 py-3 ${column.align === "right" ? "text-right" : ""}`}
                    aria-sort={sort === column.key ? (dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={`inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors ${
                        column.align === "right" ? "ml-auto" : ""
                      }`}
                    >
                      {column.label}
                      {sort === column.key ? (
                        dir === "asc" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-300" />
                      )}
                    </button>
                  </th>
                ))}
                <th className="px-5 py-3">Tipo / Departamento</th>
                <th className="px-5 py-3">Custodio</th>
                <th className="px-5 py-3 text-center">Estado</th>
                <th className="px-5 py-3 text-right">Dep. Acumulada</th>
                <th className="px-5 py-3 text-right">Valor en Libros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Código */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/60">
                      {row.codigo}
                    </span>
                  </td>

                  {/* Descripción + Fecha */}
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900 leading-tight">{row.descripcion}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {row.numeroSerie ? `Serial: ${row.numeroSerie}` : "Sin serial"}
                    </div>
                  </td>

                  {/* Costo (columna ordenable) */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono tabular-nums text-slate-800">
                    {formatRD(row.costoAdquisicion)}
                  </td>

                  {/* Fecha de adquisición (columna ordenable) */}
                  <td className="px-5 py-3.5 text-center whitespace-nowrap font-mono text-xs text-slate-600">
                    {row.fechaAdquisicion}
                  </td>

                  {/* Tipo y Departamento */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="text-[11px] font-semibold text-slate-700 leading-tight">
                      {row.tipoActivo?.descripcion ?? "—"}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {row.departamento?.descripcion ?? "—"}
                    </div>
                  </td>

                  {/* Custodio (coincide con avatar de catálogos) */}
                  <td className="px-5 py-3.5">
                    {row.custodio ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#002D62] text-white flex items-center justify-center font-display font-bold text-[10px] shrink-0 shadow-2xs">
                          {row.custodio.nombre
                            .split(" ")
                            .map((part) => part[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800 leading-tight flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" aria-hidden="true" />
                            {row.custodio.nombre}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono leading-tight">
                            {row.custodio.cedula}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Sin custodio</span>
                    )}
                  </td>

                  {/* Estado (pills con dot) */}
                  <td className="px-5 py-3.5 text-center whitespace-nowrap">
                    <EstadoPill estado={row.estado} />
                  </td>

                  {/* Dep. Acumulada */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono tabular-nums text-slate-700">
                    {formatRD(row.depreciacionAcumulada)}
                  </td>

                  {/* Valor en Libros */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap font-mono tabular-nums font-semibold text-slate-900">
                    {formatRD(row.valorEnLibros)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportDataTable>
    </div>
  );
}
