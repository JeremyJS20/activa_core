"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  History,
  Landmark,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { PayloadViewer } from "./payload-viewer";
import {
  codigoPeriodo,
  estadoAsientoLabel,
  formatFechaContable,
  formatFechaHora,
  formatRD,
  mensajeDeErrorIntegracion,
  nombrePeriodo,
  type AccionAsientoResponse,
  type AsientoDetalle,
  type AsientoDetalleResponse,
  type BitacoraItem,
  type BitacoraResponse,
  type ProblemDetails,
} from "./types";

interface AsientoDetailSheetProps {
  asientoId: string;
  refreshKey?: number;
  canManage: boolean;
  canReadLog: boolean;
  onClose: () => void;
  onMutated: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function EstadoBadge({ estado }: { estado: string }) {
  const config =
    estado === "PENDIENTE_ENVIO"
      ? "bg-amber-50 text-amber-700 border-amber-200/70"
      : estado === "ENVIADO"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
        : estado === "ERROR"
          ? "bg-rose-50 text-rose-700 border-rose-200/70"
          : "bg-slate-100 text-slate-600 border-slate-200";
  const dot =
    estado === "PENDIENTE_ENVIO"
      ? "bg-amber-500"
      : estado === "ENVIADO"
        ? "bg-emerald-600"
        : estado === "ERROR"
          ? "bg-rose-500"
          : "bg-slate-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {estadoAsientoLabel(estado)}
    </span>
  );
}

function MovimientoBadge({ tipo }: { tipo: "DB" | "CR" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
        tipo === "DB"
          ? "bg-sky-50 text-sky-700 border-sky-200/70"
          : "bg-amber-50 text-amber-700 border-amber-200/70"
      }`}
    >
      {tipo}
    </span>
  );
}

function DatoIntegracion({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
        {label}
      </span>
      <p className={`text-xs text-slate-700 mt-0.5 break-all ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

export function AsientoDetailSheet({
  asientoId,
  refreshKey = 0,
  canManage,
  canReadLog,
  onClose,
  onMutated,
  onNotify,
}: AsientoDetailSheetProps) {
  const [detalle, setDetalle] = useState<AsientoDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventos, setEventos] = useState<BitacoraItem[]>([]);
  const [isBitacoraLoading, setIsBitacoraLoading] = useState(canReadLog);
  const [bitacoraError, setBitacoraError] = useState<string | null>(null);
  const [showBitacora, setShowBitacora] = useState(false);
  const [payloadSeleccionado, setPayloadSeleccionado] = useState<BitacoraItem | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const payloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/contabilidad/asientos/${asientoId}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
          throw new Error(
            mensajeDeErrorIntegracion(problem, `No fue posible cargar el asiento (HTTP ${res.status}).`)
          );
        }
        const json = (await res.json()) as AsientoDetalleResponse;
        if (active) setDetalle(json.data);
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Error inesperado al cargar el asiento.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [asientoId, refreshKey, reloadKey]);

  useEffect(() => {
    if (!canReadLog) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadBitacora() {
      setIsBitacoraLoading(true);
      setBitacoraError(null);
      try {
        const params = new URLSearchParams({
          asientoId,
          page: "1",
          pageSize: "50",
        });
        const res = await fetch(`/api/contabilidad/bitacora?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
          throw new Error(
            mensajeDeErrorIntegracion(problem, `No fue posible cargar la bitácora (HTTP ${res.status}).`)
          );
        }
        const json = (await res.json()) as BitacoraResponse;
        if (active) setEventos(json.data ?? []);
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === "AbortError")) return;
        setBitacoraError(
          err instanceof Error ? err.message : "Error inesperado al cargar la bitácora."
        );
      } finally {
        if (active) setIsBitacoraLoading(false);
      }
    }

    void loadBitacora();
    return () => {
      active = false;
      controller.abort();
    };
  }, [asientoId, canReadLog, refreshKey, reloadKey]);

  // Focus trap + Escape + scroll lock + restauración de foco.
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

  const ejecutarAccion = useCallback(
    async (tipo: "despachar" | "reintentar") => {
      setIsSubmitting(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/contabilidad/asientos/${asientoId}/${tipo}`, {
          method: "POST",
        });
        const json = (await res.json().catch(() => null)) as
          | AccionAsientoResponse
          | ProblemDetails
          | null;

        if (!res.ok) {
          const mensaje = mensajeDeErrorIntegracion(
            json as ProblemDetails | null,
            `No fue posible ${tipo === "despachar" ? "despachar" : "reintentar"} el asiento (HTTP ${res.status}).`
          );
          setActionError(mensaje);
          onNotify("error", mensaje);
          return;
        }

        const data = (json as AccionAsientoResponse).data;
        onNotify(
          "success",
          `Asiento ${data.numeroAsiento} ${data.estado === "ENVIADO" ? "enviado" : "actualizado"} correctamente (intento ${data.intento}).`
        );
        setReloadKey((value) => value + 1);
        onMutated();
      } catch {
        const mensaje = "No fue posible comunicarse con el servidor. Intente nuevamente.";
        setActionError(mensaje);
        onNotify("error", mensaje);
      } finally {
        setIsSubmitting(false);
      }
    },
    [asientoId, onMutated, onNotify]
  );

  const ultimoEvento = eventos.length > 0 ? eventos[eventos.length - 1] : null;
  const cuadrado = detalle?.balance === "0.00";

  useEffect(() => {
    if (payloadSeleccionado) {
      payloadRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [payloadSeleccionado]);

  return (
    <div
      className="fixed inset-0 z-50 no-print bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle-asiento"
        tabIndex={-1}
        className="w-full max-w-4xl bg-[#F9F9FF] h-full shadow-2xl border-l border-slate-200/80 flex flex-col animate-in slide-in-from-right duration-200 focus:outline-none"
      >
        <div className="p-6 bg-white border-b border-slate-200/80 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="titulo-detalle-asiento"
                className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight"
              >
                Detalle del asiento
              </h2>
              {detalle && (
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#003D9B]/10 text-[#003D9B] border border-[#003D9B]/20">
                  {detalle.numeroAsiento}
                </span>
              )}
              {detalle && <EstadoBadge estado={detalle.estado} />}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {detalle
                ? `${detalle.concepto} · ${nombrePeriodo(detalle.periodo.anio, detalle.periodo.mes)}`
                : "Cargando asiento contable..."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar detalle del asiento"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#003D9B]" aria-hidden="true" />
              Cargando asiento contable...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {!isLoading && !error && detalle && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    Total débito
                  </span>
                  <p className="font-display font-extrabold text-lg text-slate-900 font-mono mt-1">
                    {formatRD(detalle.totalDebito)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    Total crédito
                  </span>
                  <p className="font-display font-extrabold text-lg text-slate-900 font-mono mt-1">
                    {formatRD(detalle.totalCredito)}
                  </p>
                </div>
                <div
                  className={`rounded-xl p-4 border shadow-2xs ${
                    cuadrado
                      ? "bg-emerald-50 border-emerald-200/70"
                      : "bg-rose-50 border-rose-200/70"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider font-mono text-slate-500">
                    Balance (Σ DB − Σ CR)
                  </span>
                  <p
                    className={`font-display font-extrabold text-lg font-mono mt-1 ${
                      cuadrado ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatRD(detalle.balance)}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${cuadrado ? "text-emerald-700" : "text-rose-700"}`}>
                    {cuadrado ? "Asiento cuadrado" : "Diferencia detectada"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
                <DatoIntegracion
                  label="Período"
                  value={`${nombrePeriodo(detalle.periodo.anio, detalle.periodo.mes)} (${codigoPeriodo(detalle.periodo.anio, detalle.periodo.mes)})`}
                />
                <DatoIntegracion
                  label="Fecha contable"
                  value={formatFechaContable(detalle.fechaContable)}
                />
                <DatoIntegracion label="Intentos de envío" value={String(detalle.intentosEnvio)} />
                <DatoIntegracion
                  label="Transacción WS"
                  value={detalle.transaccionWsId ?? "Sin confirmación"}
                  mono
                />
              </div>

              <section className="space-y-2">
                <h3 className="font-display font-bold text-sm text-[#1B2A4A]">
                  Líneas contables
                </h3>
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
                        <tr>
                          <th scope="col" className="py-2.5 px-3">Tipo inventario</th>
                          <th scope="col" className="py-2.5 px-3">Cuenta contable</th>
                          <th scope="col" className="py-2.5 px-3 text-center">Movimiento</th>
                          <th scope="col" className="py-2.5 px-3 text-right">Monto</th>
                          <th scope="col" className="py-2.5 px-3">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detalle.lineas.map((linea) => (
                          <tr key={linea.id} className="hover:bg-[#F2F3FF] transition-colors">
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                              {linea.tipoInventario ?? "—"}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-800">
                              {linea.cuentaContable}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <MovimientoBadge tipo={linea.tipoMovimiento} />
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-slate-900">
                              {formatRD(linea.monto)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              <span className="block max-w-[280px] truncate" title={linea.descripcion}>
                                {linea.descripcion}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#003D9B]/10 text-[#003D9B]">
                      <Landmark className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <h3 className="font-display font-bold text-sm text-[#1B2A4A]">
                      Integración con Contabilidad
                    </h3>
                  </div>
                  <EstadoBadge estado={detalle.estado} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DatoIntegracion
                    label="Código de respuesta WS"
                    value={detalle.codigoRespuestaWs ?? "—"}
                    mono
                  />
                  <DatoIntegracion
                    label="Mensaje del WS"
                    value={detalle.mensajeRespuestaWs ?? "—"}
                  />
                  <DatoIntegracion
                    label="Fecha de envío"
                    value={detalle.fechaEnvioWs ? formatFechaHora(detalle.fechaEnvioWs) : "—"}
                  />
                  <DatoIntegracion
                    label="Último intento"
                    value={
                      detalle.ultimoIntento
                        ? `#${detalle.ultimoIntento.intento} · ${detalle.ultimoIntento.resultado} · ${formatFechaHora(detalle.ultimoIntento.createdAt)}`
                        : "Sin envíos registrados"
                    }
                  />
                </div>

                {detalle.ultimoIntento?.mensaje && (
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                    {detalle.ultimoIntento.mensaje}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {canReadLog && ultimoEvento && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayloadSeleccionado(ultimoEvento);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Ver payload
                    </button>
                  )}
                  {canReadLog && (
                    <button
                      type="button"
                      onClick={() => setShowBitacora((value) => !value)}
                      aria-expanded={showBitacora}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#003D9B] bg-[#003D9B]/5 hover:bg-[#003D9B]/10 border border-[#003D9B]/20 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" aria-hidden="true" />
                      Ver bitácora completa ({eventos.length})
                    </button>
                  )}
                  {!canReadLog && (
                    <p className="text-[11px] text-slate-500">
                      El payload y el historial completo requieren el permiso{" "}
                      <span className="font-mono font-semibold">ACC_LOG_READ</span>.
                    </p>
                  )}
                </div>

                <div ref={payloadRef}>
                  {payloadSeleccionado && (
                    <PayloadViewer
                      payload={payloadSeleccionado.payload}
                      label={`Payload · intento #${payloadSeleccionado.intento}`}
                    />
                  )}
                </div>

                {showBitacora && canReadLog && (
                  <div className="space-y-2 border-t border-slate-200/80 pt-3">
                    {isBitacoraLoading && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        Cargando bitácora...
                      </div>
                    )}
                    {bitacoraError && (
                      <p role="alert" className="text-xs text-rose-700">
                        {bitacoraError}
                      </p>
                    )}
                    {!isBitacoraLoading && !bitacoraError && eventos.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Este asiento aún no tiene eventos de envío registrados.
                      </p>
                    )}
                    {eventos.length > 0 && (
                      <ol className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {eventos.map((evento) => (
                          <li
                            key={evento.id}
                            className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-mono text-[11px] font-semibold text-slate-700">
                                Intento #{evento.intento}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  evento.resultado === "EXITOSO"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                                    : "bg-rose-50 text-rose-700 border-rose-200/70"
                                }`}
                              >
                                {evento.resultado}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-mono mt-1">
                              {formatFechaHora(evento.createdAt)} · {evento.usuario.correo} · HTTP{" "}
                              {evento.httpStatus ?? "—"} · {evento.duracionMs} ms
                            </p>
                            {evento.mensaje && (
                              <p className="text-[11px] text-slate-600 mt-1">{evento.mensaje}</p>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setPayloadSeleccionado(evento);
                                setShowBitacora(true);
                              }}
                              className="mt-2 text-[11px] font-semibold text-[#003D9B] hover:underline"
                            >
                              Ver payload del intento
                            </button>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </section>

              {actionError && (
                <div
                  role="alert"
                  className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800"
                >
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 font-medium">{actionError}</div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            {canManage ? (
              "Las acciones quedan registradas en la bitácora inmutable."
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                Modo auditoría: solo lectura, sin acciones de despacho.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {canManage && detalle?.estado === "PENDIENTE_ENVIO" && (
              <button
                type="button"
                onClick={() => void ejecutarAccion("despachar")}
                disabled={!detalle.puedeDespachar || isSubmitting}
                title={
                  detalle.puedeDespachar
                    ? "Despachar el asiento al Web Service de Contabilidad"
                    : "El asiento debe estar cuadrado para despacharse"
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="w-4 h-4" aria-hidden="true" />
                )}
                Despachar a Contabilidad
              </button>
            )}

            {canManage && detalle?.estado === "ERROR" && (
              <button
                type="button"
                onClick={() => void ejecutarAccion("reintentar")}
                disabled={!detalle.puedeReintentar || isSubmitting}
                title={
                  detalle.puedeReintentar
                    ? "Reintentar el envío al Web Service de Contabilidad"
                    : "El asiento debe estar cuadrado para reintentarse"
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                )}
                Reintentar envío
              </button>
            )}

            {canManage && detalle?.estado === "ENVIADO" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                Asiento enviado a Contabilidad
              </span>
            )}

            {canManage &&
              detalle &&
              (detalle.estado === "PENDIENTE_ENVIO" || detalle.estado === "ERROR") &&
              !cuadrado && (
                <span className="text-[11px] font-medium text-rose-700">
                  Corrija el descuadre antes de operar.
                </span>
              )}
          </div>
        </div>
      </aside>
    </div>
  );
}
