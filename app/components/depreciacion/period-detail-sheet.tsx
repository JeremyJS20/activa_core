"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";
import { AsientoPreview } from "./asiento-preview";
import {
  codigoPeriodo,
  formatCurrency,
  nombrePeriodo,
  PeriodoDetalle,
  PeriodoRow,
} from "./types";

interface PeriodDetailSheetProps {
  periodo: PeriodoRow;
  onClose: () => void;
}

function TipoCuotaBadge({ tipo }: { tipo: string }) {
  if (tipo === "ULTIMA") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EBF3FC] text-[#003D9B] border border-[#003D9B]/20">
        Última
      </span>
    );
  }
  if (tipo === "NO_DEPRECIABLE") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        No depreciable
      </span>
    );
  }
  return null;
}

export function PeriodDetailSheet({ periodo, onClose }: PeriodDetailSheetProps) {
  const [detalle, setDetalle] = useState<PeriodoDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periodoId = periodo.id;

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const res = await fetch(`/api/depreciacion/periodos/${periodoId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          if (activo) {
            setError(
              body?.detail || body?.message || body?.title || `Error ${res.status}`
            );
          }
          return;
        }
        const json = await res.json();
        if (activo) setDetalle(json.data as PeriodoDetalle);
      } catch {
        if (activo) {
          setError("No fue posible cargar el detalle del período.");
        }
      } finally {
        if (activo) setIsLoading(false);
      }
    }

    cargar();
    return () => {
      activo = false;
    };
  }, [periodoId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const detalles = detalle?.detalles ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <button
        type="button"
        aria-label="Cerrar panel de detalle"
        onClick={onClose}
        className="flex-1 cursor-default"
        tabIndex={-1}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle-periodo"
        className="w-full max-w-3xl bg-[#F9F9FF] h-full shadow-2xl border-l border-slate-200/80 flex flex-col animate-in slide-in-from-right duration-200"
      >
        <div className="p-6 bg-white border-b border-slate-200/80 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="titulo-detalle-periodo"
                  className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight"
                >
                  Detalle del período
                </h2>
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-[#003D9B]/10 text-[#003D9B] border border-[#003D9B]/20">
                  {codigoPeriodo(periodo.anio, periodo.mes)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {nombrePeriodo(periodo.anio, periodo.mes)} · Desglose por activo y asiento contable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar panel de detalle"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-[#003D9B]" />
              Cargando detalle del período...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {!isLoading && !error && detalle && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    Monto del período
                  </span>
                  <p className="font-display font-extrabold text-lg text-[#003D9B] font-mono mt-1">
                    {formatCurrency(detalle.totalCuota)}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    Activos con cuota
                  </span>
                  <p className="font-display font-extrabold text-lg text-[#1B2A4A] mt-1">
                    {detalle.totalActivos}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                    Omitidos / Excluidos
                  </span>
                  <p className="font-display font-extrabold text-lg text-[#1B2A4A] mt-1 font-mono">
                    {detalle.activosOmitidos} / {detalle.activosExcluidos}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-display font-bold text-sm text-[#1B2A4A]">
                  Desglose por activo
                </h3>

                {detalles.length === 0 ? (
                  <div className="p-8 bg-white border border-slate-200/90 rounded-xl text-center">
                    <p className="text-sm text-slate-500">
                      El período no tiene detalle calculado. Ejecute la corrida para generarlo.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="max-h-[420px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono sticky top-0">
                          <tr>
                            <th scope="col" className="py-2.5 px-3">Activo</th>
                            <th scope="col" className="py-2.5 px-3 text-right">Cuota</th>
                            <th scope="col" className="py-2.5 px-3 text-right">Acumulada</th>
                            <th scope="col" className="py-2.5 px-3 text-right">Valor en libros</th>
                            <th scope="col" className="py-2.5 px-3 text-center">Tipo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detalles.map((linea) => (
                            <tr
                              key={linea.id}
                              className="hover:bg-[#F2F3FF] transition-colors"
                            >
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-[11px] font-bold text-[#003D9B]">
                                  {linea.activo?.codigo}
                                </span>
                                <p
                                  className="text-[11px] text-slate-600 truncate max-w-[220px]"
                                  title={linea.activo?.descripcion}
                                >
                                  {linea.activo?.descripcion}
                                </p>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <span className="font-mono text-xs font-semibold text-slate-900">
                                  {formatCurrency(linea.cuotaMensual)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <span className="font-mono text-xs text-slate-700">
                                  {formatCurrency(linea.depreciacionAcumuladaNueva)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <span className="font-mono text-xs text-slate-700">
                                  {formatCurrency(linea.valorEnLibrosNuevo)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <TipoCuotaBadge tipo={linea.tipoCuota} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-display font-bold text-sm text-[#1B2A4A]">
                  Asiento contable
                </h3>
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4">
                  <AsientoPreview asiento={detalle.asiento} />
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
