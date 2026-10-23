"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FolderSearch,
  X,
} from "lucide-react";
import { ExportButtons } from "@/components/reportes/export-buttons";

export interface ReportDataTableProps {
  title: string;
  subtitle: string;
  reporteKey: "inventario" | "depreciacion";
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Oculta la barra de búsqueda cuando el endpoint origen no soporta `search`. */
  showSearch?: boolean;
  filters?: React.ReactNode;
  onRefresh?: () => void;
  isLoading: boolean;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Acción de recuperación mostrada en el estado vacío (p. ej. restablecer filtros). */
  onResetEmpty?: () => void;
  /** Querystring con los filtros activos que se reenvía a la exportación. */
  exportQuery?: string;
  children: React.ReactNode;
}

/**
 * Shell de tabla de reportes — réplica estructural del `CatalogDataTable`
 * (Sub-01), rewireando la exportación al endpoint del Sub-04
 * (/api/reportes/export?reporte=&formato=).
 */
export function ReportDataTable({
  title,
  subtitle,
  reporteKey,
  searchPlaceholder = "Buscar registros...",
  searchValue,
  onSearchChange,
  showSearch = true,
  filters,
  onRefresh,
  isLoading,
  totalCount,
  page,
  limit,
  totalPages,
  onPageChange,
  emptyTitle = "No se encontraron registros",
  emptyDescription = "No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados.",
  onResetEmpty,
  exportQuery = "",
  children,
}: ReportDataTableProps) {
  // Input local para debounce fluido de 300ms (REP-REP-001)
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [prevSearchValue, setPrevSearchValue] = useState(searchValue);

  // Sincronizar input local si cambia el estado padre (patrón derivado de props,
  // sin setState síncrono dentro de un efecto).
  if (prevSearchValue !== searchValue) {
    setPrevSearchValue(searchValue);
    setLocalSearch(searchValue);
  }

  // Debounce de 300ms al escribir
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== searchValue) {
        onSearchChange(localSearch);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [localSearch, searchValue, onSearchChange]);

  const startRecord = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 font-display">
              {title}
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono border border-slate-200">
              {totalCount} {totalCount === 1 ? "activo" : "activos"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Actualizar reporte"
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#003D9B]" : ""}`} />
            </button>
          )}

          {/* Exportación (precheck + descarga) e impresión institucional */}
          <ExportButtons
            reporteKey={reporteKey}
            exportQuery={exportQuery}
            disabled={isLoading || totalCount === 0}
          />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="no-print bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {showSearch && (
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all text-slate-800 placeholder-slate-400"
            />
            {localSearch && (
              <button
                onClick={() => {
                  setLocalSearch("");
                  onSearchChange("");
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Optional Filter Controls */}
        {filters && <div className="flex items-center gap-2.5 flex-wrap">{filters}</div>}
      </div>

      {/* Main Table Body Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4" aria-busy="true">
            <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 flex-1 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-16 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <FolderSearch className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 font-display">{emptyTitle}</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">{emptyDescription}</p>
            {(localSearch || onResetEmpty) && (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {localSearch && (
                  <button
                    onClick={() => {
                      setLocalSearch("");
                      onSearchChange("");
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#003D9B] bg-[#003D9B]/10 hover:bg-[#003D9B]/20 rounded-md transition-colors"
                  >
                    Limpiar término de búsqueda
                  </button>
                )}
                {onResetEmpty && (
                  <button
                    type="button"
                    onClick={onResetEmpty}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#003D9B] bg-[#003D9B]/10 hover:bg-[#003D9B]/20 rounded-md transition-colors"
                  >
                    Restablecer filtros
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">{children}</div>
        )}

        {/* Server-Side Pagination Footer */}
        {!isLoading && totalCount > 0 && (
          <div className="no-print px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Mostrando <span className="font-semibold text-slate-800">{startRecord}</span> -{" "}
              <span className="font-semibold text-slate-800">{endRecord}</span> de{" "}
              <span className="font-semibold text-slate-800">{totalCount}</span> activos
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
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
