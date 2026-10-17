"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  X,
  Loader2,
  AlertCircle,
  Building2,
  DollarSign,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { AssetRow } from "@/components/activos/asset-table";
import { MOTIVOS_BAJA, MotivoBaja } from "@/lib/schemas/asset.schema";

export interface DisposalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: AssetRow | null;
  canDispose: boolean;
}

const MOTIVOS_BAJA_LABELS: Record<MotivoBaja, string> = {
  OBSOLESCENCIA_TECNOLOGICA: "Obsolescencia Tecnológica (Vida útil agotada)",
  DANO_IRREPARABLE: "Daño Físico Irreparable / Falla Catastrófica",
  PERDIDA_ROBO: "Pérdida, Extravío o Robo",
  VENTA_DESECHO: "Enajenación / Venta como Chatarra o Desecho",
  DONACION: "Donación Formal a Entidad Externa",
};

export function DisposalDialog({
  isOpen,
  onClose,
  onSuccess,
  asset,
  canDispose,
}: DisposalDialogProps) {
  // Estados del Formulario
  const [motivoBaja, setMotivoBaja] = useState<MotivoBaja>("OBSOLESCENCIA_TECNOLOGICA");
  const [numeroActa, setNumeroActa] = useState("");
  const [fechaBaja, setFechaBaja] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [justificacion, setJustificacion] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Estados Operativos
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Reiniciar formulario al abrir
  useEffect(() => {
    if (!isOpen) return;

    setMotivoBaja("OBSOLESCENCIA_TECNOLOGICA");
    setNumeroActa("");
    setFechaBaja(new Date().toISOString().split("T")[0]);
    setJustificacion("");
    setConfirmed(false);
    setFieldErrors({});
    setServerError(null);
  }, [isOpen, asset]);
  if (!isOpen || !asset) return null;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!canDispose) {
      errors.general = "No posee permisos de Administrador para desincorporar activos.";
    }

    if (!numeroActa.trim()) {
      errors.numeroActa = "El número de acta administrativa o expediente es obligatorio.";
    } else if (numeroActa.trim().length < 3) {
      errors.numeroActa = "El número de acta debe tener al menos 3 caracteres.";
    }

    if (!justificacion.trim()) {
      errors.justificacion = "El dictamen técnico / justificación de baja es obligatorio.";
    } else if (justificacion.trim().length < 20) {
      errors.justificacion =
        "El dictamen debe contener al menos 20 caracteres explicativos de la causa de desincorporación.";
    }

    if (!fechaBaja) {
      errors.fechaBaja = "La fecha legal de baja es obligatoria.";
    } else {
      const fechaIngresada = new Date(fechaBaja + "T00:00:00");
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      if (fechaIngresada > hoy) {
        errors.fechaBaja = "La fecha de baja no puede ser posterior a la fecha actual.";
      }
    }

    if (!confirmed) {
      errors.confirmed = "Debe marcar la casilla de confirmación destructiva para proceder.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        motivoBaja,
        numeroActa: numeroActa.trim(),
        justificacion: justificacion.trim(),
        fechaBaja,
      };

      const res = await fetch(`/api/activos/${asset.id}/baja`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Error al procesar la baja del activo fijo.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setServerError(err.message || "Ocurrió un error inesperado al desincorporar el bien.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-rose-200/90 overflow-hidden flex flex-col my-8">
        {/* Encabezado Destructivo Modal */}
        <div className="p-6 bg-rose-50/80 border-b border-rose-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-rose-950 tracking-tight">
                  Desincorporación y Baja Formal
                </h2>
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  {asset.codigo}
                </span>
              </div>
              <p className="text-xs text-rose-700/90 mt-0.5">
                Acción administrativa irreversible de retiro de inventario institucional.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-rose-100/50 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Cuerpo del Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Banner de Error del Servidor */}
          {serverError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in duration-150">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {/* Banner de Alerta Crítica */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <strong className="font-semibold block text-amber-950 mb-0.5">
                Proceso Irreversible
              </strong>
              Al confirmar la baja, el activo cambiará permanentemente su estado a <strong>DADO_DE_BAJA</strong>, se congelará su valor en libros en los balances fiscales de la universidad y no podrá ser reactivado ni transferido nuevamente.
            </div>
          </div>

          {/* Tarjeta de Resumen Técnico del Activo */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-700">
              <span className="text-slate-500 font-medium">Activo:</span>
              <span className="font-semibold text-slate-900 truncate max-w-[280px]">
                {asset.descripcion}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span className="text-slate-500 font-medium">Departamento / Custodio:</span>
              <span className="text-slate-800">
                {asset.departamento?.codigo} — {asset.empleado?.nombre} {asset.empleado?.apellido}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-200/70">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                Valor en Libros al Momento de Baja:
              </span>
              <span className="font-bold text-slate-900 font-mono">
                RD$ {Number(asset.valorEnLibros).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Campos del Formulario */}
          <div className="space-y-4">
            {/* Motivo de Baja */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Causa / Motivo Formal de Baja *
              </label>
              <select
                value={motivoBaja}
                onChange={(e) => setMotivoBaja(e.target.value as MotivoBaja)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition-all cursor-pointer"
              >
                {MOTIVOS_BAJA.map((m) => (
                  <option key={m} value={m}>
                    {MOTIVOS_BAJA_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Número de Acta */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Número de Acta Administrativa *
                </label>
                <input
                  type="text"
                  value={numeroActa}
                  onChange={(e) => setNumeroActa(e.target.value.toUpperCase())}
                  placeholder="Ej: ACTA-BAJA-2026-004"
                  className={`w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border ${
                    fieldErrors.numeroActa
                      ? "border-rose-300 focus:ring-rose-500"
                      : "border-slate-200 focus:ring-rose-500"
                  } bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 transition-all`}
                />
                {fieldErrors.numeroActa && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {fieldErrors.numeroActa}
                  </p>
                )}
              </div>

              {/* Fecha de Baja */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Fecha Legal de Desincorporación *
                </label>
                <input
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={fechaBaja}
                  onChange={(e) => setFechaBaja(e.target.value)}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                    fieldErrors.fechaBaja
                      ? "border-rose-300 focus:ring-rose-500"
                      : "border-slate-200 focus:ring-rose-500"
                  } bg-white text-slate-800 focus:outline-hidden focus:ring-2 transition-all`}
                />
                {fieldErrors.fechaBaja && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {fieldErrors.fechaBaja}
                  </p>
                )}
              </div>
            </div>

            {/* Justificación Técnica Obligatoria */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  Dictamen Técnico y Justificación de Baja *
                </label>
                <span className={`text-[10px] ${
                  justificacion.trim().length >= 20 ? "text-slate-400" : "text-amber-600 font-medium"
                }`}>
                  {justificacion.trim().length}/2000 (mínimo 20 caracteres)
                </span>
              </div>
              <textarea
                rows={3}
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                placeholder="Describa el diagnóstico técnico, peritaje institucional, número de reporte o circunstancias de pérdida que sustentan la desincorporación..."
                className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.justificacion
                    ? "border-rose-300 focus:ring-rose-500"
                    : "border-slate-200 focus:ring-rose-500"
                } bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 transition-all`}
              />
              {fieldErrors.justificacion && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.justificacion}
                </p>
              )}
            </div>

            {/* Casilla de Confirmación Destructiva */}
            <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200/80">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs text-rose-950 font-medium leading-relaxed">
                  Confirmo que he verificado el dictamen técnico y autorizo formalmente la desincorporación definitiva de este activo del patrimonio institucional.
                </span>
              </label>
              {fieldErrors.confirmed && (
                <p className="text-[11px] text-rose-600 mt-1.5 font-medium ml-6.5">
                  {fieldErrors.confirmed}
                </p>
              )}
            </div>
          </div>

          {/* Footer de Acciones */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !confirmed || !canDispose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando Baja...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirmar Desincorporación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}