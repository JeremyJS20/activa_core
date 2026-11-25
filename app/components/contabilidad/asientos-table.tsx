"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSearch,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import {
  ESTADOS_ASIENTO,
  PAGE_SIZES_ASIENTOS,
  codigoPeriodo,
  estadoAsientoLabel,
  formatFechaContable,
  formatRD,
  nombrePeriodo,
  type AsientoListado,
  type ContabilidadQuery,
  type DirAsiento,
  type EstadoAsientoFiltro,
  type PageSizeAsientos,
  type SortAsiento,
} from "./types";

interface AsientosTableProps {
  rows: AsientoListado[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: ContabilidadQuery;
  onQueryChange: (patch: Partial<ContabilidadQuery>) => void;
  onReset: () => void;
  onRefresh: () => void;
  onVer?: (asiento: AsientoListado) => void;
}

function EstadoAsientoPill({ estado }: { estado: string }) {
  const config =
    estado === "PENDIENTE_ENVIO"
      ? "bg-amber-50 text-amber-700 border-amber-200/70"
      : estado === "ENVIADO"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
        : estado === "ERROR"
          ? "bg-rose-50 text-rose-700 border-rose-200/70"
          : "bg-slate-100 text-slate-600 border-slate-200";
  const dot =
    estado === "PENDIENTE_ENVIO"
      ? "bg-amber-500"
      : estado === "ENVIADO"
        ? "bg-emerald-600"
        : estado === "ERROR"
          ? "bg-rose-500"
          : "bg-slate-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {estadoAsientoLabel(estado)}
    </span>
  );
}

function SortHeader({
  field,
  label,
  align,
  sort,
  dir,
  onSort,
}: {
  field: SortAsiento;
  label: string;
  align?: "right";
  sort: SortAsiento;
  dir: DirAsiento;
  onSort: (field: SortAsiento) => void;
}) {
  const active = sort === field;
  return (
    <th
      scope="col"
      className={`px-4 sm:px-5 py-3 ${align === "right" ? "text-right" : ""}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors ${
          align === "right" ? "ml-auto" : ""
        }`}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="w-3 h-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="w-3 h-3" aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-4" aria-busy="true" aria-label="Cargando asientos">
      <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 flex-1 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function AsientosTable({
  rows,
  isLoading,
  error,
  totalCount,
  page,
  pageSize,
  totalPages,
  query,
  onQueryChange,
  onReset,
  onRefresh,
  onVer,
}: AsientosTableProps) {
  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);
  const paginas = totalPages || 1;

  const toggleSort = (field: SortAsiento) => {
    const nextDir: DirAsiento =
      query.sort === field && query.dir === "asc" ? "desc" : "asc";
    onQueryChange({ sort: field, dir: nextDir, page: 1 });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 font-display">
              Asientos Contables
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono border border-slate-200">
              {totalCount} {totalCount === 1 ? "asiento" : "asientos"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Trazabilidad del despacho mensual hacia el Web Service de Contabilidad.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="filtro-estado-asiento"
              className="text-xs font-semibold text-slate-500 font-mono"
            >
              Estado:
            </label>
            <select
              id="filtro-estado-asiento"
              value={query.estado}
              onChange={(e) =>
                onQueryChange({ estado: e.target.value as EstadoAsientoFiltro, page: 1 })
              }
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors cursor-pointer"
            >
              {ESTADOS_ASIENTO.map((estado) => (
                <option key={estado.value} value={estado.value}>
                  {estado.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="filtro-periodo-asiento"
              className="text-xs font-semibold text-slate-500 font-mono"
            >
              Período:
            </label>
            <input
              id="filtro-periodo-asiento"
              type="month"
              value={query.periodo}
              onChange={(e) => onQueryChange({ periodo: e.target.value, page: 1 })}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="filtro-tamano-asiento"
              className="text-xs font-semibold text-slate-500 font-mono"
            >
              Tamaño:
            </label>
            <select
              id="filtro-tamano-asiento"
              value={query.pageSize}
              onChange={(e) =>
                onQueryChange({
                  pageSize: Number(e.target.value) as PageSizeAsientos,
                  page: 1,
                })
              }
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors cursor-pointer"
            >
              {PAGE_SIZES_ASIENTOS.map((size) => (
                <option key={size} value={size}>
                  {size} / pág.
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Restablecer
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Actualizar asientos"
            aria-label="Actualizar listado de asientos"
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin text-[#003D9B]" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1 font-medium">{error}</div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-2.5 py-1 rounded-lg border border-rose-200 bg-white text-rose-700 font-semibold hover:bg-rose-100 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <FileSearch className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 font-display">
              No hay asientos contables para los filtros seleccionados
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Ajuste el estado o el período, o restablezca la consulta para ver todos los
              asientos disponibles.
            </p>
            <button
              type="button"
              onClick={onReset}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#003D9B] rounded-lg hover:bg-[#002D72] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Restablecer filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono select-none">
                <tr>
                  <SortHeader
                    field="numero"
                    label="N° Asiento"
                    sort={query.sort}
                    dir={query.dir}
                    onSort={toggleSort}
                  />
                  <th scope="col" className="px-4 sm:px-5 py-3">
                    Concepto
                  </th>
                  <th scope="col" className="px-4 sm:px-5 py-3">
                    Período
                  </th>
                  <SortHeader
                    field="fecha"
                    label="Fecha contable"
                    sort={query.sort}
                    dir={query.dir}
                    onSort={toggleSort}
                  />
                  <th scope="col" className="px-4 sm:px-5 py-3 text-center">
                    Estado
                  </th>
                  <th scope="col" className="px-4 sm:px-5 py-3 text-right">
                    Débito
                  </th>
                  <th scope="col" className="px-4 sm:px-5 py-3 text-right">
                    Crédito
                  </th>
                  <th scope="col" className="px-4 sm:px-5 py-3 text-center">
                    Intentos
                  </th>
                  {onVer && (
                    <th scope="col" className="px-3 py-3 text-center">
                      Acciones
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((asiento) => (
                  <tr
                    key={asiento.id}
                    className="hover:bg-[#F2F3FF] transition-colors group"
                    data-testid={`asiento-row-${asiento.numeroAsiento}`}
                  >
                    <td className="px-4 sm:px-5 py-4 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-[#003D9B]">
                        {asiento.numeroAsiento}
                      </span>
                      {asiento.transaccionWsId && (
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                          {asiento.transaccionWsId}
                        </p>
                      )}
                    </td>
                    <td className="px-4 sm:px-5 py-4">
                      <span
                        className="block max-w-[280px] truncate text-slate-700"
                        title={asiento.concepto}
                      >
                        {asiento.concepto}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">
                        {nombrePeriodo(asiento.periodo.anio, asiento.periodo.mes)}
                      </span>
                      <p className="font-mono text-[10px] text-slate-400">
                        {codigoPeriodo(asiento.periodo.anio, asiento.periodo.mes)}
                      </p>
                    </td>
                    <td className="px-4 sm:px-5 py-4 whitespace-nowrap font-mono text-slate-600">
                      {formatFechaContable(asiento.fechaContable)}
                    </td>
                    <td className="px-4 sm:px-5 py-4 text-center whitespace-nowrap">
                      <EstadoAsientoPill estado={asiento.estado} />
                    </td>
                    <td className="px-4 sm:px-5 py-4 text-right whitespace-nowrap font-mono text-slate-800">
                      {formatRD(asiento.totalDebito)}
                    </td>
                    <td className="px-4 sm:px-5 py-4 text-right whitespace-nowrap font-mono text-slate-800">
                      {formatRD(asiento.totalCredito)}
                    </td>
                    <td className="px-4 sm:px-5 py-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex min-w-6 justify-center px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold ${
                          asiento.intentosEnvio > 0
                            ? "bg-slate-100 text-slate-700"
                            : "text-slate-400"
                        }`}
                      >
                        {asiento.intentosEnvio}
                      </span>
                    </td>
                    {onVer && (
                      <td className="px-3 py-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onVer(asiento)}
                          title="Ver detalle del asiento"
                          aria-label={`Ver detalle del asiento ${asiento.numeroAsiento}`}
                          className="p-1.5 text-slate-400 hover:text-[#003D9B] hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && totalCount > 0 && (
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span>
                Mostrando <span className="font-semibold text-slate-800">{startRecord}</span>–
                <span className="font-semibold text-slate-800">{endRecord}</span> de{" "}
                <span className="font-semibold text-slate-800">{totalCount}</span> asientos
              </span>
              <label htmlFor="page-size-asientos" className="sr-only">
                Registros por página
              </label>
              <select
                id="page-size-asientos"
                value={pageSize}
                onChange={(e) =>
                  onQueryChange({
                    pageSize: Number(e.target.value) as PageSizeAsientos,
                    page: 1,
                  })
                }
                className="px-2 py-1 text-[11px] font-mono bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30"
              >
                {PAGE_SIZES_ASIENTOS.map((size) => (
                  <option key={size} value={size}>
                    {size} / pág.
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onQueryChange({ page: page - 1 })}
                disabled={page <= 1}
                aria-label="Página anterior"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Anterior</span>
              </button>

              <span className="px-3 py-1 font-mono font-medium text-slate-700">
                Pág. {page} de {paginas}
              </span>

              <button
                type="button"
                onClick={() => onQueryChange({ page: page + 1 })}
                disabled={page >= paginas}
                aria-label="Página siguiente"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
