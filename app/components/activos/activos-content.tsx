"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ConsoleShell } from "@/components/layout/console-shell";
import { AssetTable, AssetRow } from "@/components/activos/asset-table";
import { Layers, AlertCircle, CheckCircle2 } from "lucide-react";

export function ActivosContent() {
  const { data: session } = useSession();
  const userPermisos = session?.user?.permisos || [];
  const userRole = session?.user?.rol?.codigo;

  const canOperate =
    userRole === "ADMIN" ||
    userPermisos.includes("USER_ADMIN") ||
    userPermisos.includes("ACT_OPERATE") ||
    userPermisos.includes("ACT_CREATE");

  const canDispose =
    userRole === "ADMIN" || userPermisos.includes("USER_ADMIN");

  // Estados de datos
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [tiposActivos, setTiposActivos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados de paginación y filtros
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [departamentoFilter, setDepartamentoFilter] = useState("TODOS");
  const [tipoActivoFilter, setTipoActivoFilter] = useState("TODOS");
  const [estadoFilter, setEstadoFilter] = useState("TODOS");

  // Toast local de notificación
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // Cargar catálogos base para los filtros
  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [resDept, resTipos] = await Promise.all([
          fetch("/api/departamentos?limit=100&estado=ACTIVO"),
          fetch("/api/tipos-activos?limit=100&estado=ACTIVO"),
        ]);
        if (resDept.ok) {
          const json = await resDept.json();
          setDepartamentos(json.data || []);
        }
        if (resTipos.ok) {
          const json = await resTipos.json();
          setTiposActivos(json.data || []);
        }
      } catch (err) {
        console.error("Error al cargar catálogos auxiliares:", err);
      }
    }
    loadCatalogs();
  }, []);

  // Cargar inventario de activos fijos
  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search.trim()) params.set("search", search.trim());
      if (departamentoFilter !== "TODOS") params.set("departamentoId", departamentoFilter);
      if (tipoActivoFilter !== "TODOS") params.set("tipoActivoId", tipoActivoFilter);
      if (estadoFilter !== "TODOS") params.set("estado", estadoFilter);

      const res = await fetch("/api/activos?" + params.toString());
      if (!res.ok) throw new Error("No fue posible cargar el inventario de activos.");

      const json = await res.json();
      setAssets(json.data || []);
      setTotalCount(json.pagination?.total || 0);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error("[ACTIVOS_FETCH] Error:", err);
      showToast("error", err.message || "Error al consultar activos fijos.");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, departamentoFilter, tipoActivoFilter, estadoFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Manejadores de acciones
  const handleDownloadPdf = (asset: AssetRow) => {
    const url = `/api/activos/${asset.id}/acta-entrega`;
    window.open(url, "_blank");
    showToast("success", `Iniciando descarga de Acta de Entrega para ${asset.codigo}...`);
  };

  const handleViewDetail = (asset: AssetRow) => {
    showToast("success", `Consultando ficha técnica del activo ${asset.codigo}...`);
  };

  const handleAddNew = () => {
    showToast("success", "Apertura de formulario de nuevo activo...");
  };

  const handleEdit = (asset: AssetRow) => {
    showToast("success", `Apertura de edición para el activo ${asset.codigo}...`);
  };

  const handleTransfer = (asset: AssetRow) => {
    showToast("success", `Apertura de traslado para el activo ${asset.codigo}...`);
  };

  const handleDispose = (asset: AssetRow) => {
    showToast("success", `Apertura de desincorporación para ${asset.codigo}...`);
  };

  const handlePrintMarbete = (asset: AssetRow) => {
    showToast("success", `Generando vista de marbete para ${asset.codigo}...`);
  };

  return (
    <ConsoleShell>
      <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
        {/* Toast Notificación */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 text-sm animate-in fade-in slide-in-from-bottom-4 duration-200 ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-rose-50 text-rose-900 border-rose-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{toast.text}</span>
          </div>
        )}

        {/* Encabezado del Módulo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#002D62] text-white shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Inventario de Activos Fijos
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Control de bienes físicos, custodios departamentales, códigos correlativos y categorías fiscales DGII.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Grilla Principal de Inventario */}
        <AssetTable
          assets={assets}
          isLoading={isLoading}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          searchValue={search}
          onSearchChange={(s) => {
            setSearch(s);
            setPage(1);
          }}
          departamentos={departamentos}
          tiposActivos={tiposActivos}
          departamentoFilter={departamentoFilter}
          onDepartamentoChange={(dept) => {
            setDepartamentoFilter(dept);
            setPage(1);
          }}
          tipoActivoFilter={tipoActivoFilter}
          onTipoActivoChange={(tipo) => {
            setTipoActivoFilter(tipo);
            setPage(1);
          }}
          estadoFilter={estadoFilter}
          onEstadoChange={(est) => {
            setEstadoFilter(est);
            setPage(1);
          }}
          onAddNew={handleAddNew}
          canOperate={canOperate}
          canDispose={canDispose}
          onViewDetail={handleViewDetail}
          onTransfer={handleTransfer}
          onEdit={handleEdit}
          onDispose={handleDispose}
          onPrintMarbete={handlePrintMarbete}
          onDownloadPdf={handleDownloadPdf}
          onRefresh={fetchAssets}
        />
      </div>
    </ConsoleShell>
  );
}
