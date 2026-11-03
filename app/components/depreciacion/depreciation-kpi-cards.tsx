"use client";

import { CheckCircle2, SkipForward, Ban } from "lucide-react";
import { codigoPeriodo, formatCurrency, nombrePeriodo, PeriodoRow } from "./types";

interface DepreciationKpiCardsProps {
  periodo: PeriodoRow | null;
  isLoading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs space-y-2">
      <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
      <div className="h-7 w-40 bg-slate-100 rounded animate-pulse" />
      <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
    </div>
  );
}

export function DepreciationKpiCards({ periodo, isLoading = false }: DepreciationKpiCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!periodo) {
    return (
      <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-2xs text-center">
        <p className="text-sm text-slate-500">
          Aún no existen períodos de depreciación registrados.
        </p>
      </div>
    );
  }

  const sinEjecutar = periodo.estado === "ABIERTO";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Total del período
        </span>
        <p className="font-display font-extrabold text-2xl text-[#003D9B] font-mono">
          {sinEjecutar ? "RD$ 0.00" : formatCurrency(periodo.totalCuota)}
        </p>
        <p className="text-xs text-slate-400 font-mono">
          {nombrePeriodo(periodo.anio, periodo.mes)} · {codigoPeriodo(periodo.anio, periodo.mes)}
        </p>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Activos procesados
        </span>
        <p className="font-display font-extrabold text-2xl text-[#1B2A4A] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          {periodo.totalActivos}
        </p>
        <p className="text-xs text-slate-400">
          {sinEjecutar ? "Pendiente de ejecutar la corrida" : "Con cuota registrada en el período"}
        </p>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Omitidos
        </span>
        <p className="font-display font-extrabold text-2xl text-[#1B2A4A] flex items-center gap-2">
          <SkipForward className="w-5 h-5 text-amber-500" />
          {periodo.activosOmitidos}
        </p>
        <p className="text-xs text-slate-400">Vida útil agotada o sin remanente</p>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Excluidos
        </span>
        <p className="font-display font-extrabold text-2xl text-[#1B2A4A] flex items-center gap-2">
          <Ban className="w-5 h-5 text-slate-400" />
          {periodo.activosExcluidos}
        </p>
        <p className="text-xs text-slate-400">Bajas, tipo inactivo o fuera del corte</p>
      </div>
    </div>
  );
}
