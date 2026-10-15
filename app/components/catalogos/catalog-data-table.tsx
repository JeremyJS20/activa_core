"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderSearch,
  Loader2,
  X,
  Download,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export interface CatalogDataTableProps {
  title: string;
  subtitle: string;
  catalogoKey: "departamentos" | "tipos-activos" | "empleados";
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: React.ReactNode;
  onAddNew?: () => void;
  addNewLabel?: string;
  canWrite?: boolean;
  isLoading: boolean;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onRefresh?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  children: React.ReactNode;
}

export function CatalogDataTable({
  title,
  subtitle,
  catalogoKey,
  searchPlaceholder = "Buscar registros...",
  searchValue,
  onSearchChange,
  filters,
  onAddNew,
  addNewLabel = "Nuevo Registro",
  canWrite = true,
  isLoading,
  totalCount,
  page,
  limit,
  totalPages,
  onPageChange,
  onRefresh,
  emptyTitle = "No se encontraron registros",
  emptyDescription = "No hay registros que coincidan con los criterios de búsqueda o filtros seleccionados.",
  children,
}: CatalogDataTableProps) {
  // Input local para debounce fluido de 200ms
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sincronizar input local si cambia el estado padre
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  // Debounce de 200ms al escribir
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== searchValue) {
        onSearchChange(localSearch);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [localSearch, searchValue, onSearchChange]);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleExport = async (format: "xlsx" | "csv") => {
    setIsExportOpen(false);
    setIsExporting(true);

    try {
      const res = await fetch(`/api/catalogos/export?catalogo=${catalogoKey}&format=${format}`);
      if (!res.ok) {
        throw new Error("Error al generar la exportación");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `catalogo_${catalogoKey}_${Date.now()}.${format}`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      // Disparar descarga en el navegador del usuario
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(
        "success",
        `Catálogo exportado exitosamente a formato ${format.toUpperCase()}`
      );
    } catch (err) {
      console.error("Export error:", err);
      showToast("error", "No fue posible exportar el catálogo. Intente de nuevo.");
    } finally {
      setIsExporting(false);
    }
  };

  const startRecord = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border animate-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-display">
              {title}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono border border-slate-200">
              {totalCount} {totalCount === 1 ? "registro" : "registros"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        {/* Action Buttons: Export & Add New */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Actualizar catálogo"
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#003D9B]" : ""}`} />
            </button>
          )}

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              disabled={isExporting || totalCount === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#003D9B]" />
              ) : (
                <Download className="w-4 h-4 text-slate-500" />
              )}
              <span>Exportar</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isExportOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsExportOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50 text-sm animate-in fade-in-50 zoom-in-95">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                    Formato de Archivo
                  </div>
                  <button
                    onClick={() => handleExport("xlsx")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="font-medium block leading-none">Libro Excel (.xlsx)</span>
                      <span className="text-[11px] text-slate-400">Estilos UNAPEC oficiales</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleExport("csv")}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-sky-600" />
                    <div>
                      <span className="font-medium block leading-none">Archivo CSV (.csv)</span>
                      <span className="text-[11px] text-slate-400">UTF-8 BOM (Windows)</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* New Item Primary Button */}
          {canWrite && onAddNew && (
            <button
              onClick={onAddNew}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{addNewLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
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

        {/* Optional Filter Controls (e.g. Estado, Categoría, Método) */}
        {filters && <div className="flex items-center gap-2.5 flex-wrap">{filters}</div>}
      </div>

      {/* Main Table Body Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {isLoading ? (
          /* Animated Skeletons */
          <div className="p-6 space-y-4">
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
          /* Empty State Illustrated Card */
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <FolderSearch className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 font-display">
              {emptyTitle}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
              {emptyDescription}
            </p>
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
          </div>
        ) : (
          /* Render Table Children */
          <div className="overflow-x-auto">{children}</div>
        )}

        {/* Server-Side Pagination Footer */}
        {!isLoading && totalCount > 0 && (
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Mostrando <span className="font-semibold text-slate-800">{startRecord}</span> -{" "}
              <span className="font-semibold text-slate-800">{endRecord}</span> de{" "}
              <span className="font-semibold text-slate-800">{totalCount}</span> registros
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
