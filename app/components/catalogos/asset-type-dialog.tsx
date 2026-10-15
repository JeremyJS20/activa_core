"use client";

import React, { useState, useEffect } from "react";
import { Tag, X, Loader2, AlertCircle, Calculator, FileText, CheckCircle2 } from "lucide-react";
import {
  AssetTypeCreateSchema,
  AssetTypeUpdateSchema,
  METODOS_DEPRECIACION,
  DGII_PARAMETROS_POR_DEFECTO,
} from "@/lib/schemas/asset-type.schema";

export interface AssetTypeRow {
  id: string;
  codigo: string;
  descripcion: string;
  cuentaContableCompra: string;
  cuentaContableDepreciacion: string;
  metodoDepreciacion: "DGII_CAT1" | "DGII_CAT2" | "DGII_CAT3" | "LINEA_RECTA";
  porcentajeDepreciacionAnual: number;
  vidaUtilMeses: number;
  estado: "ACTIVO" | "INACTIVO";
  createdAt?: string;
  updatedAt?: string;
}

interface AssetTypeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  assetTypeToEdit?: AssetTypeRow | null;
}

export function formatAccountNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (!digits) return "";
  let res = digits.slice(0, 1);
  if (digits.length > 1) res += "-" + digits.slice(1, 3);
  if (digits.length > 3) res += "-" + digits.slice(3, 5);
  if (digits.length > 5) res += "-" + digits.slice(5, 9);
  return res;
}

export function AssetTypeDialog({
  isOpen,
  onClose,
  onSaved,
  assetTypeToEdit,
}: AssetTypeDialogProps) {
  const isEditing = Boolean(assetTypeToEdit);

  // Form State
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [metodoDepreciacion, setMetodoDepreciacion] = useState<
    "DGII_CAT1" | "DGII_CAT2" | "DGII_CAT3" | "LINEA_RECTA"
  >("DGII_CAT2");
  const [porcentaje, setPorcentaje] = useState<number>(25.0);
  const [vidaUtilMeses, setVidaUtilMeses] = useState<number>(48);
  const [cuentaCompra, setCuentaCompra] = useState("");
  const [cuentaDepreciacion, setCuentaDepreciacion] = useState("");
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">("ACTIVO");

  // Operational State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (assetTypeToEdit) {
      setCodigo(assetTypeToEdit.codigo || "");
      setDescripcion(assetTypeToEdit.descripcion || "");
      setMetodoDepreciacion(assetTypeToEdit.metodoDepreciacion || "DGII_CAT2");
      setPorcentaje(Number(assetTypeToEdit.porcentajeDepreciacionAnual) || 25.0);
      setVidaUtilMeses(Number(assetTypeToEdit.vidaUtilMeses) || 48);
      setCuentaCompra(assetTypeToEdit.cuentaContableCompra || "");
      setCuentaDepreciacion(assetTypeToEdit.cuentaContableDepreciacion || "");
      setEstado(assetTypeToEdit.estado || "ACTIVO");
    } else {
      setCodigo("");
      setDescripcion("");
      setMetodoDepreciacion("DGII_CAT2");
      setPorcentaje(25.0);
      setVidaUtilMeses(48);
      setCuentaCompra("");
      setCuentaDepreciacion("");
      setEstado("ACTIVO");
    }

    setFieldErrors({});
    setServerError(null);
  }, [isOpen, assetTypeToEdit]);

  if (!isOpen) return null;

  // Manejar cambio de categoria fiscal DGII con auto-relleno
  const handleMetodoChange = (
    nuevoMetodo: "DGII_CAT1" | "DGII_CAT2" | "DGII_CAT3" | "LINEA_RECTA"
  ) => {
    setMetodoDepreciacion(nuevoMetodo);
    const defaults = DGII_PARAMETROS_POR_DEFECTO[nuevoMetodo];
    if (defaults) {
      setPorcentaje(defaults.porcentaje);
      setVidaUtilMeses(defaults.vidaUtilMeses);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const payload: {
      codigo?: string;
      descripcion: string;
      metodoDepreciacion: "DGII_CAT1" | "DGII_CAT2" | "DGII_CAT3" | "LINEA_RECTA";
      porcentajeDepreciacionAnual: number;
      vidaUtilMeses: number;
      cuentaContableCompra: string;
      cuentaContableDepreciacion: string;
      estado: "ACTIVO" | "INACTIVO";
    } = {
      descripcion: descripcion.trim(),
      metodoDepreciacion,
      porcentajeDepreciacionAnual: Number(porcentaje),
      vidaUtilMeses: Number(vidaUtilMeses),
      cuentaContableCompra: cuentaCompra.trim(),
      cuentaContableDepreciacion: cuentaDepreciacion.trim(),
      estado,
    };

    if (codigo.trim()) {
      payload.codigo = codigo.trim().toUpperCase();
    }

    // Validar esquema mediante Zod
    const schema = isEditing ? AssetTypeUpdateSchema : AssetTypeCreateSchema;
    const validation = schema.safeParse(payload);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const fieldName = (issue.path[0] as string) || "general";
        if (!errors[fieldName]) {
          errors[fieldName] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing
        ? "/api/tipos-activos/" + assetTypeToEdit!.id
        : "/api/tipos-activos";

      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (responseData.error === "ASSET_TYPE_CODE_DUPLICATE") {
          setFieldErrors((prev) => ({
            ...prev,
            codigo: "Ya existe un tipo de activo registrado con este código.",
          }));
          throw new Error("El código de tipo de activo ya se encuentra registrado.");
        }
        if (responseData.error === "ASSET_TYPE_DESCRIPCION_DUPLICATE") {
          setFieldErrors((prev) => ({
            ...prev,
            descripcion: "Ya existe un tipo de activo con esta descripción.",
          }));
          throw new Error("La descripción del tipo de activo ya está en uso.");
        }
        if (responseData.error === "IDENTICAL_ACCOUNT_CODES") {
          setFieldErrors((prev) => ({
            ...prev,
            cuentaContableDepreciacion: "La cuenta de compra y depreciación no pueden ser idénticas.",
          }));
          throw new Error("Las cuentas contables no pueden ser iguales.");
        }

        throw new Error(
          responseData.message ||
            (isEditing
              ? "Error al actualizar el tipo de activo."
              : "Error al registrar el tipo de activo.")
        );
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setServerError(err.message || "Ocurri? un error inesperado al procesar el tipo de activo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-8">
        {/* Header Modal */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002D62] text-white flex items-center justify-center shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                {isEditing ? "Modificar Tipo de Activo" : "Nuevo Tipo de Activo"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditing
                  ? "Actualice los par?metros de depreciación DGII y cuentas contables asociadas."
                  : "Defina la categor?a fiscal DGII y las cuentas de compra y depreciación."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Banner de Error del Servidor */}
          {serverError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200/90 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {/* Grid de Código y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Código */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Código del Tipo de Activo
                {!isEditing && (
                  <span className="text-[11px] font-normal text-slate-400 ml-1">
                    (Opcional)
                  </span>
                )}
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value.toUpperCase());
                  if (fieldErrors.codigo) {
                    setFieldErrors((prev) => ({ ...prev, codigo: "" }));
                  }
                }}
                maxLength={10}
                placeholder={isEditing ? "ej. TPA-001" : "Auto-generado (TPA-XXX)"}
                className={
                  "w-full px-3.5 py-2 text-sm font-mono bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (fieldErrors.codigo
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              />
              {fieldErrors.codigo ? (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.codigo}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">
                  Identificador alfanumérico (ej: TPA-001).
                </p>
              )}
            </div>

            {/* Estado Operativo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Estado Operativo <span className="text-rose-500">*</span>
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as "ACTIVO" | "INACTIVO")}
                className="w-full px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003D9B]/20 focus:border-[#003D9B] focus:bg-white transition-all text-slate-800"
              >
                <option value="ACTIVO">Activo (Habilitado)</option>
                <option value="INACTIVO">Inactivo (Deshabilitado)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Tipos inactivos no pueden seleccionarse para nuevos activos.
              </p>
            </div>
          </div>

          {/* Nombre / Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Descripción del Tipo de Activo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => {
                setDescripcion(e.target.value);
                if (fieldErrors.descripcion) {
                  setFieldErrors((prev) => ({ ...prev, descripcion: "" }));
                }
              }}
              maxLength={150}
              placeholder="ej. Equipos de Computaci?n y Servidores"
              className={
                "w-full px-3.5 py-2 text-sm bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                (fieldErrors.descripcion
                  ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                  : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
              }
            />
            {fieldErrors.descripcion ? (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                {fieldErrors.descripcion}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Denominaci?n t?cnica de la familia o clase de bienes.
              </p>
            )}
          </div>

          {/* Categoría Fiscal DGII & Par?metros */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#002D62] font-mono">
              <Calculator className="w-4 h-4 text-[#003D9B]" />
              <span>Régimen Fiscal DGII & Depreciación</span>
            </div>

            {/* Selector de M?todo / Categoría */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Categoría Fiscal DGII <span className="text-rose-500">*</span>
              </label>
              <select
                value={metodoDepreciacion}
                onChange={(e) =>
                  handleMetodoChange(
                    e.target.value as "DGII_CAT1" | "DGII_CAT2" | "DGII_CAT3" | "LINEA_RECTA"
                  )
                }
                className="w-full px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800"
              >
                <option value="DGII_CAT2">
                  Categoría 2 DGII ? C?mputo, Veh?culos y Mobiliario (25% anual / 48 meses)
                </option>
                <option value="DGII_CAT1">
                  Categoría 1 DGII ? Edificaciones e Infraestructura (5% anual / 240 meses)
                </option>
                <option value="DGII_CAT3">
                  Categoría 3 DGII ? Maquinaria Pesada y Otros Bienes (15% anual / 80 meses)
                </option>
                <option value="LINEA_RECTA">
                  Línea Recta Est?ndar (Personalizado)
                </option>
              </select>
            </div>

            {/* Par?metros Calculados (Porcentaje y Vida útil) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tasa de Depreciación Anual (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(parseFloat(e.target.value) || 0)}
                    disabled={metodoDepreciacion !== "LINEA_RECTA"}
                    className={
                      "w-full px-3.5 py-2 text-sm font-mono border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                      (metodoDepreciacion !== "LINEA_RECTA"
                        ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                        : "bg-white border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                    % anual
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Vida útil en Meses
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="1200"
                    value={vidaUtilMeses}
                    onChange={(e) => setVidaUtilMeses(parseInt(e.target.value, 10) || 0)}
                    disabled={metodoDepreciacion !== "LINEA_RECTA"}
                    className={
                      "w-full px-3.5 py-2 text-sm font-mono border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                      (metodoDepreciacion !== "LINEA_RECTA"
                        ? "bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed"
                        : "bg-white border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                    meses
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cuentas Contables (Formato X-XX-XX-XXXX) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cuenta Compra */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cuenta Contable de Compra <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={cuentaCompra}
                onChange={(e) => {
                  setCuentaCompra(formatAccountNumber(e.target.value));
                  if (fieldErrors.cuentaContableCompra) {
                    setFieldErrors((prev) => ({ ...prev, cuentaContableCompra: "" }));
                  }
                }}
                maxLength={12}
                placeholder="ej. 1-01-05-0001"
                className={
                  "w-full px-3.5 py-2 text-sm font-mono bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (fieldErrors.cuentaContableCompra
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              />
              {fieldErrors.cuentaContableCompra ? (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.cuentaContableCompra}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">
                  Estructura contable: X-XX-XX-XXXX
                </p>
              )}
            </div>

            {/* Cuenta Depreciación */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cuenta Depreciación Acumulada <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={cuentaDepreciacion}
                onChange={(e) => {
                  setCuentaDepreciacion(formatAccountNumber(e.target.value));
                  if (fieldErrors.cuentaContableDepreciacion) {
                    setFieldErrors((prev) => ({ ...prev, cuentaContableDepreciacion: "" }));
                  }
                }}
                maxLength={12}
                placeholder="ej. 1-01-05-0002"
                className={
                  "w-full px-3.5 py-2 text-sm font-mono bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (fieldErrors.cuentaContableDepreciacion
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              />
              {fieldErrors.cuentaContableDepreciacion ? (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.cuentaContableDepreciacion}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">
                  Estructura contable: X-XX-XX-XXXX
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
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#002D62] hover:bg-[#003D9B] active:bg-[#002047] rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : isEditing ? (
                <span>Guardar Cambios</span>
              ) : (
                <span>Crear Tipo de Activo</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
