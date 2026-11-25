"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Send,
  X,
} from "lucide-react";
import {
  mensajeDeErrorIntegracion,
  nombrePeriodo,
  type BatchResponse,
  type BatchResultado,
  type ProblemDetails,
} from "./types";

interface BatchDispatchDialogProps {
  periodo: string;
  pendientes: number;
  onClose: () => void;
  onCompleted: (resultado: BatchResultado) => void;
  onNotify: (type: "success" | "error", message: string) => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function etiquetaPeriodo(periodo: string): string {
  if (!periodo) return "Todos los períodos";
  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes) return periodo;
  const nombre = nombrePeriodo(anio, mes);
  return nombre === "—" ? periodo : nombre;
}

export function BatchDispatchDialog({
  periodo,
  pendientes,
  onClose,
  onCompleted,
  onNotify,
}: BatchDispatchDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<BatchResultado | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!isSubmitting) onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.offsetParent !== null);

      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const isInside = current !== null && panel.contains(current);

      if (event.shiftKey && (!isInside || current === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!isInside || current === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [isSubmitting, onClose]);

  const despachar = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contabilidad/asientos/despachar-pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(periodo ? { periodo } : {}),
      });
      const json = (await res.json().catch(() => null)) as
        | BatchResponse
        | ProblemDetails
        | null;

      if (!res.ok) {
        const mensaje = mensajeDeErrorIntegracion(
          json as ProblemDetails | null,
          `No fue posible ejecutar el lote (HTTP ${res.status}).`
        );
        setError(mensaje);
        onNotify("error", mensaje);
        return;
      }

      const data = (json as BatchResponse).data;
      setResultado(data);
      onCompleted(data);
      onNotify(
        "success",
        `Lote procesado: ${data.enviados} enviados, ${data.errores} con error, ${data.restantes} restantes.`
      );
    } catch {
      const mensaje = "No fue posible comunicarse con el servidor. Intente nuevamente.";
      setError(mensaje);
      onNotify("error", mensaje);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] no-print bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-lote-contabilidad"
        tabIndex={-1}
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-8 focus:outline-none"
      >
        <div className="p-6 bg-[#F2F3FF] border-b border-slate-200/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003D9B] text-white flex items-center justify-center shadow-xs">
              <Send className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="titulo-lote-contabilidad"
                className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight"
              >
                Despachar pendientes en lote
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {etiquetaPeriodo(periodo)} · máximo 25 asientos por ejecución
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar diálogo de despacho por lote"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/70 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {!resultado ? (
            <>
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Período</span>
                  <span className="font-semibold text-slate-900">{etiquetaPeriodo(periodo)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Asientos pendientes</span>
                  <span className="font-mono font-bold text-[#003D9B]">{pendientes}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Estado de la operación</span>
                  <span className="font-mono text-slate-600">Irreversible</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <strong className="font-semibold block text-amber-950 mb-0.5">
                    Confirmación requerida
                  </strong>
                  Se enviarán hasta 25 asientos pendientes al Web Service de Contabilidad. Cada
                  envío queda registrado en la bitácora inmutable y no puede revertirse desde la
                  consola. Los fallos individuales no detienen el lote.
                </div>
              </div>

              {pendientes === 0 && (
                <p className="text-xs text-slate-500">
                  No hay asientos pendientes para el período seleccionado.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200/90 bg-slate-50 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    Total
                  </span>
                  <p className="font-display font-extrabold text-xl text-slate-900 font-mono mt-1">
                    {resultado.total}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 font-mono">
                    Enviados
                  </span>
                  <p className="font-display font-extrabold text-xl text-emerald-700 font-mono mt-1">
                    {resultado.enviados}
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200/70 bg-rose-50 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 font-mono">
                    Errores
                  </span>
                  <p className="font-display font-extrabold text-xl text-rose-700 font-mono mt-1">
                    {resultado.errores}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200/70 bg-amber-50 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 font-mono">
                    Restantes
                  </span>
                  <p className="font-display font-extrabold text-xl text-amber-700 font-mono mt-1">
                    {resultado.restantes}
                  </p>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200/90">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono sticky top-0">
                    <tr>
                      <th scope="col" className="py-2 px-3">Asiento</th>
                      <th scope="col" className="py-2 px-3 text-center">Estado</th>
                      <th scope="col" className="py-2 px-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultado.resultados.map((item) => (
                      <tr key={item.asientoId}>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {item.numeroAsiento}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              item.estado === "ENVIADO"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                                : "bg-rose-50 text-rose-700 border-rose-200/70"
                            }`}
                          >
                            {item.estado === "ENVIADO" ? "Enviado" : "Error"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {item.transaccionWsId ? (
                            <span className="font-mono text-[10px]">{item.transaccionWsId}</span>
                          ) : (
                            <span className="text-[11px]">
                              {item.codigo ?? "—"}
                              {item.mensaje ? ` · ${item.mensaje}` : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200/80 flex items-center justify-end gap-3">
          {resultado ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Cerrar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void despachar()}
                disabled={isSubmitting || pendientes === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="w-4 h-4" aria-hidden="true" />
                )}
                {isSubmitting ? "Procesando lote..." : `Confirmar y despachar (${pendientes})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
