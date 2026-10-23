"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  History,
  Lock,
  UserRound,
  X,
} from "lucide-react";
import { EstadoPill } from "@/components/reportes/estado-pill";
import {
  formatRD,
  type KardexResponse,
  type KardexTimelineEntry,
} from "@/components/reportes/reportes-types";

interface KardexModalProps {
  activoId: string;
  onClose: () => void;
}

interface TimelineMeta {
  label: string;
  dot: string;
  badge: string;
}

const TIMELINE_META: Record<string, TimelineMeta> = {
  ALTA_INICIAL: {
    label: "Alta inicial",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  },
  TRASLADO: {
    label: "Traslado",
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-700 border-sky-200/60",
  },
  BAJA: {
    label: "Baja",
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-700 border-rose-200/60",
  },
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Etiqueta legible para códigos del dominio (ALTA_INICIAL → Alta inicial). */
function formatEtiqueta(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

/** `YYYY-MM-DD` → `DD/MM/YYYY` sin reinterpretar zona horaria. */
function formatFechaCorta(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/** ISO timestamp → fecha/hora institucional (America/Santo_Domingo). */
function formatFechaHora(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function CustodiaLinea({ entry }: { entry: KardexTimelineEntry }) {
  if (!entry.custodioAnterior && !entry.custodioNuevo) return null;

  if (!entry.custodioAnterior) {
    return (
      <p className="flex items-center gap-1.5 flex-wrap">
        <span className="text-slate-400">Custodio asignado:</span>
        <span className="font-medium text-slate-800">{entry.custodioNuevo}</span>
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 flex-wrap">
      <span className="text-slate-400">Custodio:</span>
      <span className="text-slate-700">{entry.custodioAnterior}</span>
      <ArrowRight className="w-3 h-3 text-slate-300" aria-hidden="true" />
      <span className="font-medium text-slate-800">{entry.custodioNuevo ?? "—"}</span>
    </p>
  );
}

function DepartamentoLinea({ entry }: { entry: KardexTimelineEntry }) {
  if (!entry.departamentoAnterior && !entry.departamentoNuevo) return null;

  if (!entry.departamentoAnterior) {
    return (
      <p className="flex items-center gap-1.5 flex-wrap">
        <span className="text-slate-400">Departamento asignado:</span>
        <span className="font-medium text-slate-800">{entry.departamentoNuevo}</span>
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 flex-wrap">
      <span className="text-slate-400">Departamento:</span>
      <span className="text-slate-700">{entry.departamentoAnterior}</span>
      <ArrowRight className="w-3 h-3 text-slate-300" aria-hidden="true" />
      <span className="font-medium text-slate-800">{entry.departamentoNuevo ?? "—"}</span>
    </p>
  );
}

/**
 * REQ-REP-005 — Kardex del activo: ficha histórica inmutable de solo lectura.
 * Focus trap + cierre por ESC/overlay. Ninguna acción de mutación expuesta.
 */
export function KardexModal({ activoId, onClose }: KardexModalProps) {
  const [data, setData] = useState<KardexResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Carga de la ficha histórica (solo lectura).
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/reportes/activos/${activoId}/kardex`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          const problem = await res.json().catch(() => null);
          const detail = problem?.errors
            ? Object.values(problem.errors as Record<string, string>)[0]
            : problem?.detail;
          throw new Error(detail || "No fue posible consultar el kardex del activo.");
        }

        const json: KardexResponse = await res.json();
        if (active) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Error inesperado al consultar el kardex.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [activoId]);

  // Focus trap, ESC y restauración del foco al cerrar.
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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
  }, [onClose]);

  const activo = data?.activo ?? null;

  return (
    <div
      className="fixed inset-0 z-50 no-print bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kardex-title"
        tabIndex={-1}
        className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 focus:outline-none"
      >
        {/* Encabezado */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#002D62] text-white flex items-center justify-center shadow-xs shrink-0">
              <History className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="kardex-title"
                  className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight"
                >
                  Kardex del Activo
                </h2>
                {activo && (
                  <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-200">
                    {activo.codigo}
                  </span>
                )}
                {activo && <EstadoPill estado={activo.estado} />}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {activo
                  ? activo.descripcion
                  : "Consultando la ficha histórica y las cuotas del bien…"}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            aria-label="Cerrar Kardex"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && (
            <div className="space-y-4" aria-busy="true">
              <div className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
            </div>
          )}

          {!isLoading && data && (
            <>
              {/* Banner de activo desincorporado (antes que el resto del contenido) */}
              {activo?.bajaInfo && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/90 text-rose-900">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                    <p className="font-display font-bold text-sm tracking-tight">
                      ACTIVO DESINCORPORADO — FUERA DE SERVICIO
                    </p>
                  </div>
                  <p className="text-xs mt-1.5 text-rose-800">
                    Acta <span className="font-mono font-semibold">{activo.bajaInfo.numeroActa}</span> ·
                    Baja {formatFechaCorta(activo.bajaInfo.fechaBaja)} ·{" "}
                    {formatEtiqueta(activo.bajaInfo.motivoBaja)} · Valor en libros al momento de la
                    baja {formatRD(activo.bajaInfo.valorEnLibrosAlBaja)}
                  </p>
                  <p className="text-xs mt-1 text-rose-700 leading-relaxed">
                    {activo.bajaInfo.justificacion}
                  </p>
                </div>
              )}

              {/* Ficha del activo */}
              <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/60 border border-slate-200/70">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Tipo de activo
                  </dt>
                  <dd className="text-sm text-slate-800 font-medium mt-0.5">
                    {activo?.tipoActivo ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Departamento
                  </dt>
                  <dd className="text-sm text-slate-800 font-medium mt-0.5">
                    {activo?.departamento ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Custodio
                  </dt>
                  <dd className="text-sm text-slate-800 font-medium mt-0.5 flex items-center gap-1.5">
                    <UserRound className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    {activo?.custodio ?? "Sin custodio"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    N° de serie
                  </dt>
                  <dd className="text-sm text-slate-800 font-mono mt-0.5">
                    {activo?.numeroSerie ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Adquisición
                  </dt>
                  <dd className="text-sm text-slate-800 font-mono mt-0.5">
                    {activo ? formatFechaCorta(activo.fechaAdquisicion) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Costo original
                  </dt>
                  <dd className="text-sm text-slate-800 font-mono tabular-nums mt-0.5">
                    {activo ? formatRD(activo.costoAdquisicion) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Dep. acumulada
                  </dt>
                  <dd className="text-sm text-slate-800 font-mono tabular-nums mt-0.5">
                    {activo ? formatRD(activo.depreciacionAcumulada) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">
                    Valor en libros
                  </dt>
                  <dd className="text-sm text-slate-900 font-mono tabular-nums font-semibold mt-0.5">
                    {activo ? formatRD(activo.valorEnLibros) : "—"}
                  </dd>
                </div>
              </dl>

              {/* Línea de tiempo inmutable */}
              <section aria-labelledby="kardex-timeline-title">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3
                    id="kardex-timeline-title"
                    className="font-display font-bold text-sm text-[#1B2A4A] tracking-tight"
                  >
                    Línea de tiempo de custodia
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 font-mono border border-slate-200">
                    {data.timeline.length} {data.timeline.length === 1 ? "evento" : "eventos"}
                  </span>
                </div>

                {data.timeline.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Sin movimientos de custodia registrados para este activo.
                  </p>
                ) : (
                  <ol className="relative border-l-2 border-slate-100 ml-1.5 pl-6 space-y-5">
                    {data.timeline.map((entry, index) => {
                      const meta =
                        TIMELINE_META[entry.tipo] ?? {
                          label: formatEtiqueta(entry.tipo),
                          dot: "bg-slate-400",
                          badge: "bg-slate-100 text-slate-600 border-slate-200",
                        };

                      return (
                        <li key={`${entry.fecha}-${index}`} className="relative">
                          <span
                            className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${meta.dot}`}
                            aria-hidden="true"
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badge}`}
                            >
                              {meta.label}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatFechaHora(entry.fecha)}
                            </span>
                          </div>

                          <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                            <CustodiaLinea entry={entry} />
                            <DepartamentoLinea entry={entry} />
                            <p className="text-slate-500 leading-relaxed pt-0.5">
                              {entry.justificacion}
                            </p>
                            {entry.usuario && (
                              <p className="text-[11px] text-slate-400 font-mono pt-0.5">
                                Responsable: {entry.usuario}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {/* Cuotas históricas de depreciación */}
              <section aria-labelledby="kardex-cuotas-title">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3
                    id="kardex-cuotas-title"
                    className="font-display font-bold text-sm text-[#1B2A4A] tracking-tight"
                  >
                    Cuotas de depreciación procesadas
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 font-mono border border-slate-200">
                    {data.cuotas.length} {data.cuotas.length === 1 ? "cuota" : "cuotas"}
                  </span>
                </div>

                {data.cuotas.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Sin cuotas de depreciación procesadas para este activo.
                  </p>
                ) : (
                  <div className="rounded-xl border border-slate-200/80 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono sticky top-0">
                          <tr>
                            <th className="px-4 py-2.5">Período</th>
                            <th className="px-4 py-2.5 text-right">Cuota del mes</th>
                            <th className="px-4 py-2.5 text-right">Dep. acumulada</th>
                            <th className="px-4 py-2.5 text-right">Valor en libros</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {data.cuotas.map((cuota) => (
                            <tr key={cuota.periodo} className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-2.5 font-mono font-semibold text-slate-700">
                                {cuota.periodo}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                                {formatRD(cuota.cuotaMes)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                                {formatRD(cuota.depreciacionAcumulada)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                                {formatRD(cuota.valorEnLibros)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Pie */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
            <Lock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            Registro inmutable · solo lectura
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
