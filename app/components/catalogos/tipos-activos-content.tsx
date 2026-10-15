"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CatalogNav } from "@/components/catalogos/catalog-nav";
import { CatalogDataTable } from "@/components/catalogos/catalog-data-table";
import {
  AssetTypeDialog,
  AssetTypeRow,
} from "@/components/catalogos/asset-type-dialog";
import { AssetTypeDeleteDialog } from "@/components/catalogos/asset-type-delete-dialog";
import {
  Tag,
  Calculator,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  FileSpreadsheet,
} from "lucide-react";

export function TiposActivosContent() {
  const [assetTypes, setAssetTypes] = useState<AssetTypeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"TODOS" | "ACTIVO" | "INACTIVO">("TODOS");
  const [metodoFilter, setMetodoFilter] = useState<string>("TODOS");

  // Modales
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [assetTypeToEdit, setAssetTypeToEdit] = useState<AssetTypeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetTypeRow | null>(null);

  // Toast Notificación
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // Cargar tipos de activos desde API
  const fetchAssetTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search.trim()) params.set("search", search.trim());
      if (estadoFilter !== "TODOS") params.set("estado", estadoFilter);
      if (metodoFilter !== "TODOS") params.set("metodoDepreciacion", metodoFilter);

      const res = await fetch("/api/tipos-activos?" + params.toString());
      if (!res.ok) throw new Error("No fue posible cargar el listado de tipos de activos.");

      const json = await res.json();
      setAssetTypes(json.data || []);
      setTotalCount(json.pagination?.total || 0);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error("[TIPOS_ACTIVOS_FETCH] Error:", err);
      showToast("error", err.message || "Error al cargar tipos de activos.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, estadoFilter, metodoFilter]);

  useEffect(() => {
    fetchAssetTypes();
  }, [fetchAssetTypes]);

  const handleOpenCreate = () => {
    setAssetTypeToEdit(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: AssetTypeRow) => {
    setAssetTypeToEdit(item);
    setIsDialogOpen(true);
  };

  // Alternar estado Activo / Inactivo con feedback visual inmediato
  const handleToggleEstado = async (item: AssetTypeRow) => {
    const nuevoEstado = item.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    
    // Optimistic UI update
    setAssetTypes((prev) =>
      prev.map((t) => (t.id === item.id ? { ...t, estado: nuevoEstado } : t))
    );

    try {
      const res = await fetch("/api/tipos-activos/" + item.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (!res.ok) {
        throw new Error("No fue posible actualizar el estado del tipo de activo.");
      }

      showToast(
        "success",
        "Tipo de activo " + item.codigo + " marcado como " + nuevoEstado.toLowerCase() + "."
      );
    } catch (err: any) {
      // Revert optimistic update
      setAssetTypes((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, estado: item.estado } : t))
      );
      showToast("error", err.message || "Error al alternar estado.");
    }
  };

  const handleSaved = () => {
    showToast(
      "success",
      assetTypeToEdit
        ? "Tipo de activo actualizado satisfactoriamente."
        : "Tipo de activo registrado con ?xito en ActivaCore."
    );
    fetchAssetTypes();
  };

  const handleDeleted = () => {
    showToast("success", "Operación sobre el tipo de activo completada.");
    fetchAssetTypes();
  };

  const renderFiscalBadge = (metodo: string) => {
    switch (metodo) {
      case "DGII_CAT1":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/70">
            Cat. 1 DGII (5% / 20a)
          </span>
        );
      case "DGII_CAT2":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
            Cat. 2 DGII (25% / 4a)
          </span>
        );
      case "DGII_CAT3":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
            Cat. 3 DGII (15% / 6.6a)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
            Línea Recta
          </span>
        );
    }
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Principal con Identidad Institucional UNAPEC */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#003D9B] uppercase tracking-wider font-mono mb-1">
            <Tag className="w-4 h-4" />
            <span>Clasificación Contable & Tributaria</span>
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
            Catálogo de Tipos de Activos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Configuración de categorías fiscales DGII, tasas de amortización anual y asignación de cuentas contables.
          </p>
        </div>

        {/* Navegaci?n entre Pesta?as de Catálogos */}
        <CatalogNav />

        {/* Notificación Toast Local */}
        {toast && (
          <div
            className={
              "p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-150 " +
              (toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800")
            }
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {/* Tabla Reactiva con Buscador y Paginador */}
        <CatalogDataTable
          title="Listado de Tipos de Activos"
          subtitle="Categorías de activos con sus respectivas vidas útiles y cuentas contables vinculadas."
          catalogoKey="tipos-activos"
          searchPlaceholder="Buscar por código, descripción o cuenta contable..."
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          addNewLabel="Nuevo Tipo de Activo"
          onAddNew={handleOpenCreate}
          isLoading={isLoading}
          totalCount={totalCount}
          page={page}
          limit={limit}
          totalPages={totalPages}
          onPageChange={(newPage) => setPage(newPage)}
          onRefresh={fetchAssetTypes}
          emptyTitle="No se encontraron tipos de activos"
          emptyDescription="No existen tipos de activos registrados o ning?n registro coincide con los filtros aplicados."
          filters={
            <div className="flex items-center gap-3 flex-wrap">
              {/* Filtro Régimen Fiscal DGII */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500 font-mono">
                  Régimen:
                </label>
                <select
                  value={metodoFilter}
                  onChange={(e) => {
                    setMetodoFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
                >
                  <option value="TODOS">Todos los Métodos</option>
                  <option value="DGII_CAT1">Categoría 1 DGII</option>
                  <option value="DGII_CAT2">Categoría 2 DGII</option>
                  <option value="DGII_CAT3">Categoría 3 DGII</option>
                  <option value="LINEA_RECTA">Línea Recta</option>
                </select>
              </div>

              {/* Filtro Estado */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500 font-mono">
                  Estado:
                </label>
                <select
                  value={estadoFilter}
                  onChange={(e) => {
                    setEstadoFilter(e.target.value as "TODOS" | "ACTIVO" | "INACTIVO");
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
                >
                  <option value="TODOS">Todos los Estados</option>
                  <option value="ACTIVO">Solo Activos</option>
                  <option value="INACTIVO">Solo Inactivos</option>
                </select>
              </div>
            </div>
          }
        >
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              <tr>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Descripción / Clase</th>
                <th className="px-5 py-3">Régimen DGII</th>
                <th className="px-5 py-3">Cuentas Contables</th>
                <th className="px-5 py-3 text-center">Tasa & Vida útil</th>
                <th className="px-5 py-3 text-center">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assetTypes.map((tipo) => (
                <tr key={tipo.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Código */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/60">
                      {tipo.codigo}
                    </span>
                  </td>

                  {/* Descripción */}
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900">{tipo.descripcion}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Ref: {tipo.id.slice(0, 8)}
                    </div>
                  </td>

                  {/* Régimen DGII */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    {renderFiscalBadge(tipo.metodoDepreciacion)}
                  </td>

                  {/* Cuentas Contables */}
                  <td className="px-5 py-3.5 whitespace-nowrap space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[10px] uppercase font-mono font-semibold text-slate-400 w-12">
                        Compra:
                      </span>
                      <span className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 text-[11px]">
                        {tipo.cuentaContableCompra}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[10px] uppercase font-mono font-semibold text-slate-400 w-12">
                        Deprec.:
                      </span>
                      <span className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60 text-[11px]">
                        {tipo.cuentaContableDepreciacion}
                      </span>
                    </div>
                  </td>

                  {/* Tasa & Vida útil */}
                  <td className="px-5 py-3.5 text-center whitespace-nowrap">
                    <div className="font-mono font-semibold text-slate-800 text-xs">
                      {Number(tipo.porcentajeDepreciacionAnual).toFixed(2)}% anual
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {tipo.vidaUtilMeses} meses ({(tipo.vidaUtilMeses / 12).toFixed(1)}a)
                    </div>
                  </td>

                  {/* Estado (Interactivo con toggle r?pido) */}
                  <td className="px-5 py-3.5 text-center whitespace-nowrap">
                    <button
                      onClick={() => handleToggleEstado(tipo)}
                      title="Haga clic para alternar estado"
                      className="cursor-pointer group inline-flex items-center"
                    >
                      {tipo.estado === "ACTIVO" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 group-hover:bg-emerald-100 transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 group-hover:bg-slate-200 transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Inactivo
                        </span>
                      )}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(tipo)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#003D9B] hover:bg-slate-100 transition-colors"
                        title="Editar tipo de activo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tipo)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Eliminar o inactivar tipo de activo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CatalogDataTable>

        {/* Di?logo de Creaci?n / Edici?n */}
        <AssetTypeDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSaved={handleSaved}
          assetTypeToEdit={assetTypeToEdit}
        />

        {/* Di?logo de Confirmaci?n de Borrado */}
        <AssetTypeDeleteDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          assetType={deleteTarget}
          onDeleted={handleDeleted}
        />
      </div>
    </div>
  );
}
