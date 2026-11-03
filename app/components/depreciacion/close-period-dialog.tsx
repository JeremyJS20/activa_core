"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle, Loader2, Lock, X } from "lucide-react";
import { codigoPeriodo, formatCurrency, nombrePeriodo, PeriodoRow } from "./types";

interface ClosePeriodDialogProps {
  periodo: PeriodoRow;
  onClose: () => void;
  onClosed: (periodo: PeriodoRow) => void;
}

const MENSAJES_CONOCIDOS: Record<string, string> = {
  PERIOD_IMMUTABLE:
    "El período ya fue cerrado y no admite reapertura. Registre un asiento de ajuste en el período abierto.",
  PERIOD_NOT_CLOSABLE:
    "Solo puede cerrarse un período con la corrida de depreciación ejecutada.",
  PERIOD_HAS_NO_DETAIL:
    "El período no posee detalle de depreciación calculado. Ejecute la corrida antes de cerrar.",
  PERIOD_NOT_FOUND: "El período seleccionado ya no existe.",
  AUDIT_LOG_FAILED:
    "No fue posible registrar la auditoría del cierre. El cierre fue revertido.",
};

export function ClosePeriodDialog({
  periodo,
  onClose,
  onClosed,
}: ClosePeriodDialogProps) {
  const [confirmado, setConfirmado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    onClose();
  };

  const handleCerrar = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/depreciacion/periodos/${periodo.id}/cerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmar: true }),
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
      onClosed(json.data as PeriodoRow);
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
        aria-labelledby="titulo-cerrar-periodo"
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-rose-200/90 overflow-hidden flex flex-col my-8"
      >
        <div className="p-6 bg-rose-50/80 border-b border-rose-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="titulo-cerrar-periodo"
                  className="font-display font-bold text-lg text-rose-950 tracking-tight"
                >
                  Cerrar período
                </h2>
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  {codigoPeriodo(periodo.anio, periodo.mes)}
                </span>
              </div>
              <p className="text-xs text-rose-700/90 mt-0.5">
                Acción contable irreversible sobre el período mensual.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Cerrar modal de cierre de período"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-rose-100/50 transition-colors disabled:opacity-50"
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

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <strong className="font-semibold block text-amber-950 mb-0.5">
                Proceso irreversible
              </strong>
              Al confirmar, el período <strong>{nombrePeriodo(periodo.anio, periodo.mes)}</strong>{" "}
              quedará en estado <strong>CERRADO</strong>. No podrá reabrirse ni recalcularse; los
              ajustes posteriores deberán registrarse como asiento de ajuste en el período abierto.
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Activos con cuota registrada</span>
              <span className="font-mono text-slate-800">{periodo.totalActivos}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Omitidos / Excluidos</span>
              <span className="font-mono text-slate-800">
                {periodo.activosOmitidos} / {periodo.activosExcluidos}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200/70">
              <span className="text-slate-500">Monto total a cerrar</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(periodo.totalCuota)}
              </span>
            </div>
          </div>

          <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200/80">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs text-rose-950 font-medium leading-relaxed">
                Entiendo que el cierre es irreversible y que el período no podrá reabrirse.
              </span>
            </label>
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
              onClick={handleCerrar}
              disabled={isSubmitting || !confirmado}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cerrando período...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Confirmar cierre</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
