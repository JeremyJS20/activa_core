"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, Calculator, CalendarPlus, CheckCircle2 } from "lucide-react";
import { ClosePeriodDialog } from "./close-period-dialog";
import { DepreciationKpiCards } from "./depreciation-kpi-cards";
import { NewPeriodDialog } from "./new-period-dialog";
import { PeriodDetailSheet } from "./period-detail-sheet";
import { PeriodTable } from "./period-table";
import { ResumenCorrida, RunDepreciationDialog } from "./run-depreciation-dialog";
import {
  codigoPeriodo,
  formatCurrency,
  nombrePeriodo,
  PeriodoRow,
  RespuestaListado,
} from "./types";

export interface DepreciacionContentProps {
  initialRole?: string;
  initialPermisos?: string[];
}

export function DepreciacionContent({
  initialRole,
  initialPermisos = [],
}: DepreciacionContentProps = {}) {
  const { data: session } = useSession();
  const userPermisos = session?.user?.permisos || initialPermisos;
  const userRole = session?.user?.rol?.codigo || initialRole;

  const canOperate =
    userRole === "ADMIN" ||
    userPermisos.includes("USER_ADMIN") ||
    userPermisos.includes("DEP_CALCULATE");

  const [periodos, setPeriodos] = useState<PeriodoRow[]>([]);
  const [periodoDestacado, setPeriodoDestacado] = useState<PeriodoRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingKpi, setIsLoadingKpi] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [estadoFilter, setEstadoFilter] = useState("TODOS");

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [runTarget, setRunTarget] = useState<PeriodoRow | null>(null);
  const [closeTarget, setCloseTarget] = useState<PeriodoRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<PeriodoRow | null>(null);

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchPeriodos = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("estado", estadoFilter);

      const res = await fetch(`/api/depreciacion/periodos?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.detail ||
            body?.message ||
            body?.title ||
            "No fue posible cargar los períodos de depreciación."
        );
      }

      const json = (await res.json()) as RespuestaListado<PeriodoRow>;
      setPeriodos(json.data || []);
      setTotalCount(json.meta?.total ?? 0);
      setTotalPages(json.meta?.totalPages ?? 1);
      setError(null);
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : "Error al consultar los períodos de depreciación.";
      setError(mensaje);
      showToast("error", mensaje);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, estadoFilter]);

  const fetchDestacado = useCallback(async () => {
    try {
      const res = await fetch("/api/depreciacion/periodos?page=1&pageSize=1&estado=TODOS");
      if (!res.ok) return;
      const json = (await res.json()) as RespuestaListado<PeriodoRow>;
      setPeriodoDestacado(json.data?.[0] ?? null);
    } catch {
      // El KPI es informativo: un fallo aquí no bloquea el listado.
    } finally {
      setIsLoadingKpi(false);
    }
  }, []);

  useEffect(() => {
    void fetchPeriodos();
  }, [fetchPeriodos]);

  useEffect(() => {
    void fetchDestacado();
  }, [fetchDestacado]);

  const refrescarTodo = () => {
    setIsLoading(true);
    setIsLoadingKpi(true);
    void fetchPeriodos();
    void fetchDestacado();
  };

  const handleCompleted = (resumen: ResumenCorrida) => {
    showToast(
      "success",
      `Corrida ${codigoPeriodo(resumen.anio, resumen.mes)} completada: ${resumen.totalActivos} activos por ${formatCurrency(resumen.totalCuota)} (asiento ${resumen.asiento.numeroAsiento}).`
    );
    refrescarTodo();
  };

  const handleClosed = (periodo: PeriodoRow) => {
    showToast(
      "success",
      `Período ${nombrePeriodo(periodo.anio, periodo.mes)} cerrado. Queda inmutable para futuros recálculos.`
    );
    refrescarTodo();
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {toast && (
          <div
            role="status"
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

        {/* Encabezado Institucional del Módulo */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#003D9B] uppercase tracking-wider font-mono mb-1">
              <Calculator className="w-4 h-4" />
              <span>Operaciones Contables</span>
            </div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
              Depreciación DGII
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Cálculo mensual por línea recta, actualización de valores en libros y generación del
              asiento contable consolidado.
            </p>
          </div>

          {canOperate && (
            <button
              onClick={() => setIsNewOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] rounded-lg transition-colors shadow-xs self-start sm:self-auto"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Nuevo período</span>
            </button>
          )}
        </div>

        <DepreciationKpiCards periodo={periodoDestacado} isLoading={isLoadingKpi} />

        <PeriodTable
          periodos={periodos}
          isLoading={isLoading}
          error={error}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          estadoFilter={estadoFilter}
          onEstadoChange={(estado) => {
            setIsLoading(true);
            setEstadoFilter(estado);
            setPage(1);
          }}
          onPageChange={(nuevaPagina) => {
            setIsLoading(true);
            setPage(nuevaPagina);
          }}
          onPageSizeChange={(size) => {
            setIsLoading(true);
            setPageSize(size);
            setPage(1);
          }}
          onRefresh={refrescarTodo}
          onEjecutar={setRunTarget}
          onCerrar={setCloseTarget}
          onVerDetalle={setDetailTarget}
          canOperate={canOperate}
        />

        {isNewOpen && (
          <NewPeriodDialog
            onClose={() => setIsNewOpen(false)}
            onCreated={(periodo) => {
              showToast(
                "success",
                `Período ${nombrePeriodo(periodo.anio, periodo.mes)} creado en estado ABIERTO.`
              );
              refrescarTodo();
            }}
          />
        )}

        {runTarget && (
          <RunDepreciationDialog
            periodo={runTarget}
            onClose={() => setRunTarget(null)}
            onCompleted={handleCompleted}
          />
        )}

        {closeTarget && (
          <ClosePeriodDialog
            periodo={closeTarget}
            onClose={() => setCloseTarget(null)}
            onClosed={handleClosed}
          />
        )}

        {detailTarget && (
          <PeriodDetailSheet
            periodo={detailTarget}
            onClose={() => setDetailTarget(null)}
          />
        )}
      </div>
    </div>
  );
}
