"use client";

import { useState } from "react";
import { AlertCircle, CalendarPlus, Loader2, X } from "lucide-react";
import { MESES, PeriodoRow } from "./types";

interface NewPeriodDialogProps {
  onClose: () => void;
  onCreated: (periodo: PeriodoRow) => void;
}

const MENSAJES_CONOCIDOS: Record<string, string> = {
  PERIOD_ALREADY_EXISTS:
    "Ya existe un período registrado para ese mes. Seleccione otro mes o consulte el período existente.",
  INVALID_PERIOD_FORMAT:
    "El período debe tener un año entre 2000 y 2100 y un mes entre 1 y 12.",
  VALIDATION_ERROR: "Revise los datos del período antes de continuar.",
};

export function NewPeriodDialog({ onClose, onCreated }: NewPeriodDialogProps) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getUTCFullYear());
  const [mes, setMes] = useState(hoy.getUTCMonth() + 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anioActual = hoy.getUTCFullYear();
  const anios = [anioActual - 1, anioActual, anioActual + 1];

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    onClose();
  };

  const handleCrear = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/depreciacion/periodos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anio, mes }),
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
      onCreated(json.data as PeriodoRow);
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
        aria-labelledby="titulo-nuevo-periodo"
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-8"
      >
        <div className="p-6 bg-[#F2F3FF] border-b border-slate-200/80 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003D9B] text-white flex items-center justify-center shadow-xs">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="titulo-nuevo-periodo"
                className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight"
              >
                Nuevo período
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Apertura de un mes contable para depreciación
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Cerrar modal de nuevo período"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/70 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="nuevo-periodo-anio"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Año *
              </label>
              <select
                id="nuevo-periodo-anio"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-all cursor-pointer font-mono"
              >
                {anios.map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="nuevo-periodo-mes"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Mes *
              </label>
              <select
                id="nuevo-periodo-mes"
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-all cursor-pointer"
              >
                {MESES.map((nombre, indice) => (
                  <option key={nombre} value={indice + 1}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            El período se crea en estado <strong>ABIERTO</strong>. La fecha de corte corresponde al
            último día del mes seleccionado y la corrida se ejecuta manualmente después de su
            creación.
          </p>

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
              onClick={handleCrear}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creando período...</span>
                </>
              ) : (
                <>
                  <CalendarPlus className="w-4 h-4" />
                  <span>Crear período</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
