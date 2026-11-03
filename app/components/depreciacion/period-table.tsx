"use client";

import {
  AlertCircle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderSearch,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import {
  codigoPeriodo,
  formatCurrency,
  formatFechaHora,
  nombrePeriodo,
  PeriodoRow,
} from "./types";

interface PeriodTableProps {
  periodos: PeriodoRow[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  estadoFilter: string;
  onEstadoChange: (estado: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRefresh: () => void;
  onEjecutar: (periodo: PeriodoRow) => void;
  onCerrar: (periodo: PeriodoRow) => void;
  onVerDetalle: (periodo: PeriodoRow) => void;
  canOperate: boolean;
}

function EstadoPill({ estado }: { estado: PeriodoRow["estado"] }) {
  switch (estado) {
    case "ABIERTO":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Abierto
        </span>
      );
    case "CALCULADO":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Calculado
        </span>
      );
    case "CERRADO":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Cerrado
        </span>
      );
    default:
      return <span className="text-xs">{estado}</span>;
  }
}

export function PeriodTable({
  periodos,
  isLoading,
  error,
  totalCount,
  page,
  pageSize,
  totalPages,
  estadoFilter,
  onEstadoChange,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onEjecutar,
  onCerrar,
  onVerDetalle,
  canOperate,
}: PeriodTableProps) {
  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-4">
      {/* Encabezado del listado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 font-display">
              Períodos de Depreciación
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono border border-slate-200">
              {totalCount} {totalCount === 1 ? "período" : "períodos"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Corridas mensuales, montos consolidados y cierre contable inmutable.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="filtro-estado-periodo"
              className="text-xs font-semibold text-slate-500 font-mono"
            >
              Estado:
            </label>
            <select
              id="filtro-estado-periodo"
              value={estadoFilter}
              onChange={(e) => onEstadoChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors cursor-pointer"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ABIERTO">Abiertos</option>
              <option value="CALCULADO">Calculados</option>
              <option value="CERRADO">Cerrados</option>
            </select>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Actualizar períodos"
            aria-label="Actualizar listado de períodos"
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#003D9B]" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 flex-1 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : periodos.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <FolderSearch className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 font-display">
              No se encontraron períodos de depreciación
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              {estadoFilter !== "TODOS"
                ? "Ajuste el filtro de estado para ver otros períodos."
                : "Cree el primer período mensual para iniciar el motor de depreciación."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono select-none">
                <tr>
                  <th scope="col" className="py-3 px-4 sm:px-6">Período</th>
                  <th scope="col" className="py-3 px-4 sm:px-6 text-center">Estado</th>
                  <th scope="col" className="py-3 px-4 sm:px-6 text-right">Activos</th>
                  <th scope="col" className="py-3 px-4 sm:px-6 text-right">Total Cuota</th>
                  <th scope="col" className="py-3 px-4 sm:px-6">Ejecutado por</th>
                  <th scope="col" className="py-3 px-4 sm:px-6">Cierre</th>
                  <th scope="col" className="py-3 px-4 sm:px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodos.map((periodo) => {
                  const esAbierto = periodo.estado === "ABIERTO";
                  const esCalculado = periodo.estado === "CALCULADO";
                  const esCerrado = periodo.estado === "CERRADO";

                  return (
                    <tr
                      key={periodo.id}
                      className="hover:bg-[#F2F3FF] transition-colors group"
                      data-testid={`periodo-row-${codigoPeriodo(periodo.anio, periodo.mes)}`}
                    >
                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">
                            {nombrePeriodo(periodo.anio, periodo.mes)}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#003D9B] group-hover:translate-x-0.5 transition-transform">
                            {codigoPeriodo(periodo.anio, periodo.mes)}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-center whitespace-nowrap">
                        <EstadoPill estado={periodo.estado} />
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {periodo.totalActivos}
                        </span>
                        {(periodo.activosOmitidos > 0 || periodo.activosExcluidos > 0) && (
                          <div className="flex items-center justify-end gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                            {periodo.activosOmitidos > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <SkipForward className="w-2.5 h-2.5" />
                                {periodo.activosOmitidos}
                              </span>
                            )}
                            {periodo.activosExcluidos > 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                <Ban className="w-2.5 h-2.5" />
                                {periodo.activosExcluidos}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {esAbierto ? "—" : formatCurrency(periodo.totalCuota)}
                        </span>
                      </td>

                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                        <span className="text-xs text-slate-600">
                          {periodo.ejecutadoPor?.nombre ?? "—"}
                        </span>
                        {periodo.fechaEjecucion && (
                          <p className="text-[10px] text-slate-400 font-mono">
                            {formatFechaHora(periodo.fechaEjecucion)}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                        {esCerrado ? (
                          <>
                            <span className="text-xs text-slate-600">
                              {periodo.cerradoPor?.nombre ?? "—"}
                            </span>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {formatFechaHora(periodo.fechaCierre)}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">Pendiente</span>
                        )}
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {canOperate && esAbierto && (
                            <button
                              onClick={() => onEjecutar(periodo)}
                              title="Ejecutar corrida de depreciación"
                              aria-label={`Ejecutar corrida del período ${codigoPeriodo(periodo.anio, periodo.mes)}`}
                              className="p-1.5 text-slate-400 hover:text-[#003D9B] hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {canOperate && esCalculado && (
                            <button
                              onClick={() => onEjecutar(periodo)}
                              title="Re-ejecutar corrida"
                              aria-label={`Re-ejecutar corrida del período ${codigoPeriodo(periodo.anio, periodo.mes)}`}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}

                          {canOperate && esCalculado && (
                            <button
                              onClick={() => onCerrar(periodo)}
                              title="Cerrar período (irreversible)"
                              aria-label={`Cerrar período ${codigoPeriodo(periodo.anio, periodo.mes)}`}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <Lock className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => onVerDetalle(periodo)}
                            title="Ver detalle del período"
                            aria-label={`Ver detalle del período ${codigoPeriodo(periodo.anio, periodo.mes)}`}
                            className="p-1.5 text-slate-400 hover:text-[#003D9B] hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && totalCount > 0 && (
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span>
                Mostrando <span className="font-semibold text-slate-800">{startRecord}</span> -{" "}
                <span className="font-semibold text-slate-800">{endRecord}</span> de{" "}
                <span className="font-semibold text-slate-800">{totalCount}</span> períodos
              </span>
              <label htmlFor="page-size-periodos" className="sr-only">
                Registros por página
              </label>
              <select
                id="page-size-periodos"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="px-2 py-1 text-[11px] font-mono bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30"
              >
                <option value={10}>10 / pág.</option>
                <option value={25}>25 / pág.</option>
                <option value={50}>50 / pág.</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label="Página anterior"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="px-3 py-1 font-mono font-medium text-slate-700">
                Pág. {page} de {totalPages || 1}
              </span>

              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                aria-label="Página siguiente"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
