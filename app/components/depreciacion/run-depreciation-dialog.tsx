"use client";

import { useState } from "react";
import { AlertCircle, Calculator, CheckCircle2, Loader2, X } from "lucide-react";
import {
  codigoPeriodo,
  formatCurrency,
  nombrePeriodo,
  PeriodoRow,
} from "./types";

export interface ResumenCorrida {
  periodoId: string;
  anio: number;
  mes: number;
  estado: string;
  totalActivos: number;
  totalCuota: string;
  activosOmitidos: number;
  activosExcluidos: number;
  asiento: {
    id: string;
    numeroAsiento: string;
    estado: string;
    totalDebito: string;
    totalCredito: string;
  };
}

interface RunDepreciationDialogProps {
  periodo: PeriodoRow;
  onClose: () => void;
  onCompleted: (resumen: ResumenCorrida) => void;
}

const MENSAJES_CONOCIDOS: Record<string, string> = {
  PERIOD_ALREADY_CLOSED:
    "El período ya está cerrado. Un período cerrado es inmutable y no admite recálculo.",
  NO_DEPRECIABLE_ASSETS:
    "No hay activos depreciables en el universo del período. Verifique los estados, las fechas de adquisición y la vida útil de los tipos de activo.",
  DEPRECIATION_EXPENSE_ACCOUNT_MISSING:
    "Un tipo de activo no tiene cuenta contable de gasto por depreciación configurada. Complete el catálogo antes de ejecutar la corrida.",
  ASIENTO_UNBALANCED:
    "El asiento generado no cuadra entre débitos y créditos. La corrida fue revertida.",
  AUDIT_LOG_FAILED:
    "No fue posible registrar la auditoría. La corrida fue revertida para preservar la trazabilidad.",
  PERIOD_NOT_FOUND: "El período seleccionado ya no existe.",
};

export function RunDepreciationDialog({
  periodo,
  onClose,
  onCompleted,
}: RunDepreciationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esReejecucion = periodo.estado === "CALCULADO";

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    onClose();
  };

  const handleEjecutar = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/depreciacion/periodos/${periodo.id}/ejecutar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const codigo = body?.code as string | undefined;
        const mensaje =
          body?.detail || body?.message || body?.title || `Error ${res.status}`;
        setError((codigo && MENSAJES_CONOCIDOS[codigo]) || mensaje);
        return;
      }

      const json = await res.json();
      onCompleted(json.data as ResumenCorrida);
      setError(null);
      onClose();
    } catch {
      setError("No fue posible comunicarse con el servidor. Intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-run-depreciacion"
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-8"
      >
        <div className="p-6 bg-[#F2F3FF] border-b border-slate-200/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003D9B] text-white flex items-center justify-center shadow-xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="titulo-run-depreciacion"
                  className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight"
                >
                  {esReejecucion ? "Re-ejecutar corrida" : "Ejecutar corrida"}
                </h2>
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#003D9B] border border-[#003D9B]/20">
                  {codigoPeriodo(periodo.anio, periodo.mes)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {nombrePeriodo(periodo.anio, periodo.mes)} · Depreciación mensual DGII
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Cerrar modal de corrida"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/70 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in duration-150">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Período</span>
              <span className="font-semibold text-slate-900">
                {nombrePeriodo(periodo.anio, periodo.mes)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Estado actual</span>
              <span className="font-mono text-slate-800">{periodo.estado}</span>
            </div>
            {esReejecucion && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Activos de la corrida previa</span>
                  <span className="font-mono text-slate-800">{periodo.totalActivos}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200/70">
                  <span className="text-slate-500">Monto acumulado previo</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(periodo.totalCuota)}
                  </span>
                </div>
              </>
            )}
            {!esReejecucion && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Activos estimados</span>
                <span className="font-mono text-slate-800">
                  Se determinan al ejecutar la corrida
                </span>
              </div>
            )}
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <strong className="font-semibold block text-amber-950 mb-0.5">
                {esReejecucion ? "Recálculo del período" : "Cálculo definitivo del período"}
              </strong>
              {esReejecucion
                ? "La corrida reemplaza el detalle y el asiento actuales del período sin duplicar la depreciación acumulada de los activos. Los montos se recalculan con la línea base previa al período."
                : "Se calculará la cuota mensual de cada activo depreciable, se actualizará su depreciación acumulada y se generará el asiento contable consolidado en estado PENDIENTE_ENVIO."}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEjecutar}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando corrida...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{esReejecucion ? "Confirmar recálculo" : "Confirmar ejecución"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
