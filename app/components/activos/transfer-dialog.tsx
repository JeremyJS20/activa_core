"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowRightLeft,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  User,
  FileDown,
  Info,
  Layers,
  ArrowRight,
} from "lucide-react";
import { AssetRow } from "@/components/activos/asset-table";
import { formatearCedula } from "@/lib/validators/identity";
import { MOTIVOS_CUSTODIA, MotivoCustodia } from "@/lib/schemas/asset.schema";

export interface TransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  asset: AssetRow | null;
  departamentos: { id: string; codigo: string; descripcion: string }[];
}

interface EmpleadoOption {
  id: string;
  codigo: string;
  nombre: string;
  apellido: string;
  cedula: string;
  cargo?: string | null;
  departamentoId: string;
}

const MOTIVO_LABELS: Record<MotivoCustodia, string> = {
  ALTA_INICIAL: "Alta Inicial de Inventario",
  ROTACION_INTERNA: "Rotación Interna / Reasignación",
  CAMBIO_DEPARTAMENTO: "Cambio de Departamento / Área",
  MANTENIMIENTO: "Custodia Temporal por Mantenimiento",
  OTRO: "Otro Motivo Administrativo",
};

export function TransferDialog({
  isOpen,
  onClose,
  onSuccess,
  asset,
  departamentos,
}: TransferDialogProps) {
  // Catálogo de empleados
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [isLoadingEmpleados, setIsLoadingEmpleados] = useState(false);

  // Estados del Formulario
  const [departamentoNuevoId, setDepartamentoNuevoId] = useState("");
  const [empleadoNuevoId, setEmpleadoNuevoId] = useState("");
  const [motivo, setMotivo] = useState<MotivoCustodia>("ROTACION_INTERNA");
  const [justificacion, setJustificacion] = useState("");

  // Estados Operativos
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Estado de éxito post-traslado
  const [transferResult, setTransferResult] = useState<{
    movimientoId: string;
    activoId: string;
  } | null>(null);

  // Cargar empleados activos al abrir el diálogo
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function loadEmpleados() {
      setIsLoadingEmpleados(true);
      try {
        const res = await fetch("/api/empleados?limit=200&estado=ACTIVO");
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setEmpleados(json.data || []);
          }
        }
      } catch (err) {
        console.error("[TRANSFER_DIALOG] Error al cargar custodios:", err);
      } finally {
        if (isMounted) setIsLoadingEmpleados(false);
      }
    }

    loadEmpleados();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Reiniciar estado al cambiar de activo o abrir el modal
  useEffect(() => {
    if (!isOpen) {
      setTransferResult(null);
      return;
    }

    setDepartamentoNuevoId(asset?.departamento?.id || "");
    setEmpleadoNuevoId("");
    setMotivo("ROTACION_INTERNA");
    setJustificacion("");
    setFieldErrors({});
    setServerError(null);
    setTransferResult(null);
  }, [isOpen, asset]);

  // Filtrado de custodios por el nuevo departamento seleccionado
  const empleadosFiltrados = useMemo(() => {
    if (!departamentoNuevoId) return empleados;
    const porDept = empleados.filter((e) => e.departamentoId === departamentoNuevoId);
    return porDept.length > 0 ? porDept : empleados;
  }, [empleados, departamentoNuevoId]);
  if (!isOpen || !asset) return null;

  const isCurrentCustodyIdentical =
    departamentoNuevoId === asset.departamento?.id &&
    empleadoNuevoId === asset.empleado?.id;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!departamentoNuevoId) {
      errors.departamentoNuevoId = "Debe seleccionar el nuevo departamento de radicación.";
    }

    if (!empleadoNuevoId) {
      errors.empleadoNuevoId = "Debe seleccionar el nuevo empleado custodio.";
    }

    if (isCurrentCustodyIdentical) {
      errors.empleadoNuevoId =
        "El nuevo custodio y/o el nuevo departamento deben ser diferentes a los actuales.";
    }

    if (!justificacion.trim()) {
      errors.justificacion = "La justificación del traslado es obligatoria.";
    } else if (justificacion.trim().length < 10) {
      errors.justificacion = "La justificación debe tener al menos 10 caracteres explicativos.";
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
        departamentoNuevoId,
        empleadoNuevoId,
        motivo,
        justificacion: justificacion.trim(),
      };

      const res = await fetch(`/api/activos/${asset.id}/traslados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        if (res.status === 422 && json.error === "NO_CUSTODY_CHANGE_DETECTED") {
          setFieldErrors((prev) => ({
            ...prev,
            empleadoNuevoId: "El custodio y departamento destino son idénticos a los actuales.",
          }));
        }
        throw new Error(json.message || "Error al procesar el traslado de custodia.");
      }

      setTransferResult({
        movimientoId: json.movimientoId,
        activoId: asset.id,
      });

      // Refrescar inventario principal en segundo plano
      onSuccess();
    } catch (err: any) {
      setServerError(err.message || "Ocurrió un error inesperado al registrar el traslado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!transferResult) return;
    const url = `/api/activos/${transferResult.activoId}/acta-entrega?movimientoId=${transferResult.movimientoId}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-8">
        {/* Encabezado Modal */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002D62] text-white flex items-center justify-center shadow-xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                  Traslado de Custodia y Asignación
                </h2>
                <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {asset.codigo}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Reasigne formalmente la responsabilidad física y radicación departamental del bien.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* Cuerpo del Modal */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Vista de Éxito Post-Traslado */}
          {transferResult ? (
            <div className="text-center py-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900">
                  ¡Traslado de Custodia Registrado!
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  La reasignación del bien <strong className="text-slate-800">{asset.codigo}</strong> ha sido asentada de forma inmutable en el historial de auditoría.
                </p>
              </div>

              {/* Botón de Descarga Inmediata de Acta Digital */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Descargar Acta de Entrega (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                >
                  Finalizar y Cerrar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Banner de Error del Servidor */}
              {serverError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in duration-150">
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                  <div className="flex-1 font-medium">{serverError}</div>
                </div>
              )}

              {/* Tarjeta Informativa: Custodia Actual de Referencia */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Custodia Actual (Origen)
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 truncate max-w-[250px]">
                    {asset.descripcion}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/70">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" /> Departamento
                    </span>
                    <span className="font-semibold text-slate-800">
                      {asset.departamento?.codigo} — {asset.departamento?.descripcion}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/70">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" /> Custodio Responsable
                    </span>
                    <span className="font-semibold text-slate-800">
                      {asset.empleado?.nombre} {asset.empleado?.apellido}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Cédula: {formatearCedula(asset.empleado?.cedula || "")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Formulario de Reasignación Destino */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Destino de Traslado</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nuevo Departamento */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Nuevo Departamento *
                    </label>
                    <select
                      value={departamentoNuevoId}
                      onChange={(e) => setDepartamentoNuevoId(e.target.value)}
                      className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                        fieldErrors.departamentoNuevoId
                          ? "border-rose-300 focus:ring-rose-500"
                          : "border-slate-200 focus:ring-[#002D62]"
                      } bg-white text-slate-800 focus:outline-hidden focus:ring-2 transition-all cursor-pointer`}
                    >
                      <option value="">-- Seleccione Departamento --</option>
                      {departamentos.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.codigo} — {dept.descripcion}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.departamentoNuevoId && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">
                        {fieldErrors.departamentoNuevoId}
                      </p>
                    )}
                  </div>

                  {/* Nuevo Custodio */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Nuevo Empleado Custodio *
                    </label>
                    <select
                      disabled={isLoadingEmpleados}
                      value={empleadoNuevoId}
                      onChange={(e) => setEmpleadoNuevoId(e.target.value)}
                      className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                        fieldErrors.empleadoNuevoId
                          ? "border-rose-300 focus:ring-rose-500"
                          : "border-slate-200 focus:ring-[#002D62]"
                      } bg-white text-slate-800 focus:outline-hidden focus:ring-2 transition-all disabled:bg-slate-100 cursor-pointer`}
                    >
                      <option value="">
                        {isLoadingEmpleados
                          ? "Cargando lista de custodios..."
                          : "-- Seleccione el Nuevo Custodio --"}
                      </option>
                      {empleadosFiltrados.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.nombre} {emp.apellido} ({formatearCedula(emp.cedula)})
                        </option>
                      ))}
                    </select>
                    {fieldErrors.empleadoNuevoId && (
                      <p className="text-[11px] text-rose-600 mt-1 font-medium">
                        {fieldErrors.empleadoNuevoId}
                      </p>
                    )}
                  </div>
                </div>

                {/* Motivo de Traslado */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Motivo Operativo del Traslado *
                  </label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value as MotivoCustodia)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#002D62] transition-all cursor-pointer"
                  >
                    {MOTIVOS_CUSTODIA.map((m) => (
                      <option key={m} value={m}>
                        {MOTIVO_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Justificación Obligatoria */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      Justificación Administrativa / Técnica *
                    </label>
                    <span className={`text-[10px] ${
                      justificacion.trim().length >= 10 ? "text-slate-400" : "text-amber-600 font-medium"
                    }`}>
                      {justificacion.trim().length}/1000 (mínimo 10 caracteres)
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={justificacion}
                    onChange={(e) => setJustificacion(e.target.value)}
                    placeholder="Detalle la causa formal de la reasignación, proyecto universitario, o resolución administrativa que autoriza el movimiento..."
                    className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                      fieldErrors.justificacion
                        ? "border-rose-300 focus:ring-rose-500"
                        : "border-slate-200 focus:ring-[#002D62]"
                    } bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 transition-all`}
                  />
                  {fieldErrors.justificacion && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                      {fieldErrors.justificacion}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer de Acciones del Formulario */}
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
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#002D62] hover:bg-[#002047] shadow-xs hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando Traslado...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Confirmar Traslado</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}