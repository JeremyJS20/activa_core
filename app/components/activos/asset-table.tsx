"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  Eye,
  ArrowRightLeft,
  FileDown,
  QrCode,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  FolderSearch,
  X,
} from "lucide-react";

export interface AssetRow {
  id: string;
  codigo: string;
  descripcion: string;
  costoAdquisicion: number;
  valorResidual: number;
  depreciacionAcumulada: number;
  valorEnLibros: number;
  estado: "ACTIVO" | "EN_MANTENIMIENTO" | "DADO_DE_BAJA" | "VENDIDO";
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  ubicacionFisica?: string | null;
  color?: string | null;
  fechaAdquisicion: string;
  createdAt: string;
  updatedAt: string;
  departamento: {
    id: string;
    codigo: string;
    descripcion: string;
  };
  tipoActivo: {
    id: string;
    codigo: string;
    descripcion: string;
    porcentajeDepreciacionAnual: number;
  };
  empleado: {
    id: string;
    codigo: string;
    nombre: string;
    apellido: string;
    cedula: string;
    cargo?: string | null;
  };
}

export interface AssetTableProps {
  assets: AssetRow[];
  isLoading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  onSearchChange: (search: string) => void;
  searchValue: string;
  departamentos: { id: string; codigo: string; descripcion: string }[];
  tiposActivos: { id: string; codigo: string; descripcion: string }[];
  departamentoFilter: string;
  onDepartamentoChange: (deptoId: string) => void;
  tipoActivoFilter: string;
  onTipoActivoChange: (tipoId: string) => void;
  estadoFilter: string;
  onEstadoChange: (estado: string) => void;
  onAddNew?: () => void;
  canOperate?: boolean;
  canDispose?: boolean;
  onViewDetail?: (asset: AssetRow) => void;
  onTransfer?: (asset: AssetRow) => void;
  onEdit?: (asset: AssetRow) => void;
  onDispose?: (asset: AssetRow) => void;
  onPrintMarbete?: (asset: AssetRow) => void;
  onDownloadPdf?: (asset: AssetRow) => void;
  onRefresh?: () => void;
}

export function AssetTable({
  assets,
  isLoading,
  totalCount,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onSearchChange,
  searchValue,
  departamentos,
  tiposActivos,
  departamentoFilter,
  onDepartamentoChange,
  tipoActivoFilter,
  onTipoActivoChange,
  estadoFilter,
  onEstadoChange,
  onAddNew,
  canOperate = true,
  canDispose = false,
  onViewDetail,
  onTransfer,
  onEdit,
  onDispose,
  onPrintMarbete,
  onDownloadPdf,
  onRefresh,
}: AssetTableProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);

  // Debounce fluido de 200ms en búsqueda
  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchValue) {
        onSearchChange(localSearch);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [localSearch, searchValue, onSearchChange]);

  // Formateador de moneda dominicana (DOP)
  const formatCurrency = (val: number) => {
    return Number(val).toLocaleString("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    });
  };

  // Renderizador de badge de estado institucional
  const renderEstadoBadge = (estado: AssetRow["estado"]) => {
    switch (estado) {
      case "ACTIVO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Activo
          </span>
        );
      case "EN_MANTENIMIENTO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            En Mantenimiento
          </span>
        );
      case "DADO_DE_BAJA":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Dado de Baja
          </span>
        );
      case "VENDIDO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Vendido
          </span>
        );
      default:
        return <span>{estado}</span>;
    }
  };

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 font-display">
              Listado General de Activos
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono border border-slate-200">
              {totalCount} {totalCount === 1 ? "activo" : "activos"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Registro detallado de bienes patrimoniales, valores contables y asignaciones.
          </p>
        </div>

        {/* Action Buttons: Refresh & Add New */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Actualizar inventario"
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#003D9B]" : ""}`} />
            </button>
          )}

          {canOperate && onAddNew && (
            <button
              onClick={onAddNew}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Activo</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Buscador reactivo */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por código (ACT-...), descripción o serie..."
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

        {/* Selectores de Filtro */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Filtro Departamento */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 font-mono">
              Depto:
            </label>
            <select
              value={departamentoFilter}
              onChange={(e) => onDepartamentoChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
            >
              <option value="TODOS">Todos los Deptos.</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.codigo} - {d.descripcion}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Categoría DGII */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 font-mono">
              Categoría:
            </label>
            <select
              value={tipoActivoFilter}
              onChange={(e) => onTipoActivoChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
            >
              <option value="TODOS">Todas las Categorías DGII</option>
              {tiposActivos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} - {t.descripcion}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 font-mono">
              Estado:
            </label>
            <select
              value={estadoFilter}
              onChange={(e) => onEstadoChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
            >
              <option value="TODOS">Todos los Estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="EN_MANTENIMIENTO">En Mantenimiento</option>
              <option value="DADO_DE_BAJA">Dados de Baja</option>
              <option value="VENDIDO">Vendidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Body Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 flex-1 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-28 bg-slate-100 rounded animate-pulse" />
                <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <FolderSearch className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 font-display">
              No se encontraron activos institucionales
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
              {localSearch || departamentoFilter !== "TODOS" || tipoActivoFilter !== "TODOS" || estadoFilter !== "TODOS"
                ? "Intente ajustar los filtros de búsqueda o restablecer los criterios seleccionados."
                : "Comience registrando el primer activo fijo institucional de la universidad."}
            </p>
            {canOperate && onAddNew && (
              <button
                onClick={onAddNew}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#003D9B] bg-[#003D9B]/10 hover:bg-[#003D9B]/20 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar nuevo bien</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono select-none">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Código</th>
                  <th className="py-3 px-4 sm:px-6">Descripción & Detalle</th>
                  <th className="py-3 px-4 sm:px-6">Categoría DGII</th>
                  <th className="py-3 px-4 sm:px-6">Custodio & Ubicación</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Valor en Libros</th>
                  <th className="py-3 px-4 sm:px-6 text-center">Estado</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Código Institucional */}
                    <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-[#003D9B] bg-[#003D9B]/10 px-2.5 py-1 rounded-md border border-[#003D9B]/20">
                        {asset.codigo}
                      </span>
                    </td>

                    {/* Descripción & Metadatos */}
                    <td className="py-4 px-4 sm:px-6 max-w-xs">
                      <p className="font-semibold text-slate-800 truncate" title={asset.descripcion}>
                        {asset.descripcion}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        {asset.marca && <span>{asset.marca}</span>}
                        {asset.modelo && <span>? {asset.modelo}</span>}
                        {asset.numeroSerie && (
                          <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                            S/N: {asset.numeroSerie}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Categoría DGII */}
                    <td className="py-4 px-4 sm:px-6 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 text-xs">
                          {asset.tipoActivo.descripcion}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {asset.tipoActivo.codigo} ({asset.tipoActivo.porcentajeDepreciacionAnual}% anual)
                        </span>
                      </div>
                    </td>

                    {/* Custodio & Ubicación */}
                    <td className="py-4 px-4 sm:px-6 max-w-xs">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {asset.empleado.nombre} {asset.empleado.apellido}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{asset.departamento.descripcion}</span>
                      </div>
                    </td>

                    {/* Valor en libros */}
                    <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                      <p className="font-semibold text-slate-900 font-mono text-xs">
                        {formatCurrency(asset.valorEnLibros)}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Costo: {formatCurrency(asset.costoAdquisicion)}
                      </p>
                    </td>

                    {/* Estado */}
                    <td className="py-4 px-4 sm:px-6 text-center whitespace-nowrap">
                      {renderEstadoBadge(asset.estado)}
                    </td>

                    {/* Menú de Acciones Rápidas */}
                    <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {onViewDetail && (
                          <button
                            onClick={() => onViewDetail(asset)}
                            title="Ver Ficha Técnica"
                            className="p-1.5 text-slate-400 hover:text-[#003D9B] hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}

                        {onDownloadPdf && (
                          <button
                            onClick={() => onDownloadPdf(asset)}
                            title="Descargar Acta de Custodia (PDF)"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                        )}

                        {onPrintMarbete && (
                          <button
                            onClick={() => onPrintMarbete(asset)}
                            title="Imprimir Marbete / Código de Barras"
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        )}

                        {canOperate && asset.estado === "ACTIVO" && onTransfer && (
                          <button
                            onClick={() => onTransfer(asset)}
                            title="Trasladar Custodia"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}

                        {canOperate && asset.estado !== "DADO_DE_BAJA" && onEdit && (
                          <button
                            onClick={() => onEdit(asset)}
                            title="Editar Datos Físicos"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {canDispose && asset.estado !== "DADO_DE_BAJA" && onDispose && (
                          <button
                            onClick={() => onDispose(asset)}
                            title="Dar de Baja (Exclusivo Administrador)"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Footer */}
        {!isLoading && totalCount > 0 && (
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
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
