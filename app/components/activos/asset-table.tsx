"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  Layers,
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
  Tag,
  MapPin,
  MoreVertical,
} from "lucide-react";
import { formatearCedula } from "@/lib/validators/identity";

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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Debounce de 200ms en búsqueda
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

  // Formateador de moneda dominicana
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Barra Superior de Herramientas & Filtros */}
      <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-b from-white to-slate-50/50">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Buscador reactivo */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar por código (ACT-...), descripción o serie..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#002D62]/20 focus:border-[#002D62] text-slate-800 placeholder-slate-400 transition-all"
            />
          </div>

          {/* Filtro por Departamento */}
          <select
            value={departamentoFilter}
            onChange={(e) => onDepartamentoChange(e.target.value)}
            className="text-xs py-2 px-3 bg-white rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-[#002D62]"
          >
            <option value="TODOS">Todos los Departamentos</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.codigo} - {d.descripcion}
              </option>
            ))}
          </select>

          {/* Filtro por Tipo de Activo */}
          <select
            value={tipoActivoFilter}
            onChange={(e) => onTipoActivoChange(e.target.value)}
            className="text-xs py-2 px-3 bg-white rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-[#002D62]"
          >
            <option value="TODOS">Todas las Categorías DGII</option>
            {tiposActivos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} - {t.descripcion}
              </option>
            ))}
          </select>

          {/* Filtro por Estado */}
          <select
            value={estadoFilter}
            onChange={(e) => onEstadoChange(e.target.value)}
            className="text-xs py-2 px-3 bg-white rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:border-[#002D62]"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="EN_MANTENIMIENTO">En Mantenimiento</option>
            <option value="DADO_DE_BAJA">Dados de Baja</option>
            <option value="VENDIDO">Vendidos</option>
          </select>
        </div>

        {/* Botones de acción general */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Actualizar datos"
              className="p-2 text-slate-500 hover:text-[#002D62] hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#002D62]" : ""}`} />
            </button>
          )}

          {canOperate && onAddNew && (
            <button
              onClick={onAddNew}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#002D62] hover:bg-[#00224a] rounded-xl shadow-xs transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Activo</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Activos Fijos */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/75 select-none">
              <th className="py-3 px-6">Código</th>
              <th className="py-3 px-6">Descripción & Detalle</th>
              <th className="py-3 px-6">Categoría DGII</th>
              <th className="py-3 px-6">Custodio & Ubicación</th>
              <th className="py-3 px-6 text-right">Valor en Libros</th>
              <th className="py-3 px-6 text-center">Estado</th>
              <th className="py-3 px-6 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {isLoading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-6"><div className="w-24 h-5 bg-slate-100 rounded-md" /></td>
                  <td className="py-4 px-6"><div className="w-48 h-5 bg-slate-100 rounded-md mb-1" /><div className="w-28 h-3 bg-slate-100 rounded-md" /></td>
                  <td className="py-4 px-6"><div className="w-32 h-5 bg-slate-100 rounded-md" /></td>
                  <td className="py-4 px-6"><div className="w-36 h-5 bg-slate-100 rounded-md mb-1" /><div className="w-24 h-3 bg-slate-100 rounded-md" /></td>
                  <td className="py-4 px-6 text-right"><div className="w-24 h-5 bg-slate-100 rounded-md ml-auto" /></td>
                  <td className="py-4 px-6 text-center"><div className="w-20 h-5 bg-slate-100 rounded-full mx-auto" /></td>
                  <td className="py-4 px-6 text-right"><div className="w-20 h-5 bg-slate-100 rounded-md ml-auto" /></td>
                </tr>
              ))
            ) : assets.length === 0 ? (
              // Estado vacío
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                      <Layers className="w-7 h-7" />
                    </div>
                    <h3 className="font-semibold text-slate-800 text-base">No se encontraron activos institucionales</h3>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {localSearch || departamentoFilter !== "TODOS" || tipoActivoFilter !== "TODOS" || estadoFilter !== "TODOS"
                        ? "Intente ajustar los filtros de búsqueda seleccionados para obtener resultados."
                        : "Comience registrando el primer activo fijo institucional de la universidad."}
                    </p>
                    {canOperate && onAddNew && (
                      <button
                        onClick={onAddNew}
                        className="mt-2 text-xs font-semibold text-[#002D62] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Registrar nuevo bien
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              // Renderizado de activos
              assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors group">
                  {/* Código Institucional */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#002D62] bg-[#F2F3FF] px-2.5 py-1 rounded-lg border border-[#002D62]/10">
                        {asset.codigo}
                      </span>
                    </div>
                  </td>

                  {/* Descripción & Metadatos */}
                  <td className="py-4 px-6 max-w-xs">
                    <p className="font-semibold text-slate-800 truncate" title={asset.descripcion}>
                      {asset.descripcion}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      {asset.marca && <span>{asset.marca}</span>}
                      {asset.modelo && <span>· {asset.modelo}</span>}
                      {asset.numeroSerie && (
                        <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                          S/N: {asset.numeroSerie}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Categoría DGII */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 text-xs">
                        {asset.tipoActivo.descripcion}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {asset.tipoActivo.codigo} ({asset.tipoActivo.porcentajeDepreciacionAnual}% anual)
                      </span>
                    </div>
                  </td>

                  {/* Custodio & Ubicación */}
                  <td className="py-4 px-6 max-w-xs">
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
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <p className="font-semibold text-slate-900 font-mono text-xs">
                      {formatCurrency(asset.valorEnLibros)}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Costo: {formatCurrency(asset.costoAdquisicion)}
                    </p>
                  </td>

                  {/* Estado */}
                  <td className="py-4 px-6 text-center whitespace-nowrap">
                    {renderEstadoBadge(asset.estado)}
                  </td>

                  {/* Menú de Acciones Rápidas */}
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {onViewDetail && (
                        <button
                          onClick={() => onViewDetail(asset)}
                          title="Ver Ficha Técnica"
                          className="p-1.5 text-slate-400 hover:text-[#002D62] hover:bg-slate-100 rounded-lg transition-colors"
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Barra de Paginación */}
      <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 bg-slate-50/50 select-none">
        <div>
          Mostrando{" "}
          <span className="font-semibold text-slate-700">
            {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
          </span>{" "}
          a{" "}
          <span className="font-semibold text-slate-700">
            {Math.min(page * pageSize, totalCount)}
          </span>{" "}
          de <span className="font-semibold text-slate-700">{totalCount}</span> activos institucionales
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-600"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
            {page} / {totalPages || 1}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-slate-600"
            title="Página siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
