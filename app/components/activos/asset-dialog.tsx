"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Package,
  X,
  Loader2,
  AlertCircle,
  Lock,
  CheckCircle2,
  Building2,
  Tag,
  DollarSign,
  Layers,
  Info,
} from "lucide-react";
import { AssetRow } from "@/components/activos/asset-table";
import { formatearCedula } from "@/lib/validators/identity";

export interface AssetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (asset: any) => void;
  assetToEdit?: AssetRow | null;
  departamentos: { id: string; codigo: string; descripcion: string }[];
  tiposActivos: {
    id: string;
    codigo: string;
    descripcion: string;
    porcentajeDepreciacionAnual: number;
    metodoDepreciacion?: string;
  }[];
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

export function AssetDialog({
  isOpen,
  onClose,
  onSaved,
  assetToEdit,
  departamentos,
  tiposActivos,
}: AssetDialogProps) {
  const isEditing = Boolean(assetToEdit);

  // Estados de datos auxiliares
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [isLoadingEmpleados, setIsLoadingEmpleados] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [poseeHistorialDepreciacion, setPoseeHistorialDepreciacion] = useState(false);

  // Estados del Formulario
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipoActivoId, setTipoActivoId] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [fechaAdquisicion, setFechaAdquisicion] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [costoAdquisicion, setCostoAdquisicion] = useState("");
  const [valorResidual, setValorResidual] = useState("0");
  const [estado, setEstado] = useState<"ACTIVO" | "EN_MANTENIMIENTO">("ACTIVO");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [ubicacionFisica, setUbicacionFisica] = useState("");
  const [color, setColor] = useState("");

  // Estados Operativos
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

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
        console.error("[ASSET_DIALOG] Error al cargar custodios:", err);
      } finally {
        if (isMounted) setIsLoadingEmpleados(false);
      }
    }

    loadEmpleados();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);
  // Inicializar o cargar datos del activo (incluyendo verificación de bloqueo contable)
  useEffect(() => {
    if (!isOpen) return;

    setFieldErrors({});
    setServerError(null);

    if (assetToEdit) {
      setCodigo(assetToEdit.codigo || "");
      setDescripcion(assetToEdit.descripcion || "");
      setTipoActivoId(assetToEdit.tipoActivo?.id || "");
      setDepartamentoId(assetToEdit.departamento?.id || "");
      setEmpleadoId(assetToEdit.empleado?.id || "");
      setFechaAdquisicion(
        assetToEdit.fechaAdquisicion
          ? assetToEdit.fechaAdquisicion.split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setCostoAdquisicion(String(assetToEdit.costoAdquisicion || ""));
      setValorResidual(String(assetToEdit.valorResidual ?? "0"));
      setEstado(
        assetToEdit.estado === "EN_MANTENIMIENTO" ? "EN_MANTENIMIENTO" : "ACTIVO"
      );
      setMarca(assetToEdit.marca || "");
      setModelo(assetToEdit.modelo || "");
      setNumeroSerie(assetToEdit.numeroSerie || "");
      setUbicacionFisica(assetToEdit.ubicacionFisica || "");
      setColor(assetToEdit.color || "");

      // Consultar endpoint de detalle para verificar historial de depreciación en tiempo real
      setIsLoadingDetail(true);
      fetch(`/api/activos/${assetToEdit.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((detail) => {
          if (detail) {
            setPoseeHistorialDepreciacion(Boolean(detail.poseeHistorialDepreciacion));
            if (detail.fechaAdquisicion) {
              setFechaAdquisicion(detail.fechaAdquisicion.split("T")[0]);
            }
          }
        })
        .catch((err) => {
          console.error("[ASSET_DIALOG] Error al consultar detalle de activo:", err);
        })
        .finally(() => {
          setIsLoadingDetail(false);
        });
    } else {
      setCodigo("");
      setDescripcion("");
      setTipoActivoId(tiposActivos[0]?.id || "");
      setDepartamentoId(departamentos[0]?.id || "");
      setEmpleadoId("");
      setFechaAdquisicion(new Date().toISOString().split("T")[0]);
      setCostoAdquisicion("");
      setValorResidual("0");
      setEstado("ACTIVO");
      setMarca("");
      setModelo("");
      setNumeroSerie("");
      setUbicacionFisica("");
      setColor("");
      setPoseeHistorialDepreciacion(false);
      setIsLoadingDetail(false);
    }
  }, [isOpen, assetToEdit, departamentos, tiposActivos]);

  // Filtrado de custodios por departamento seleccionado para facilitar asignación rápida
  const empleadosFiltrados = useMemo(() => {
    if (!departamentoId) return empleados;
    const porDept = empleados.filter((e) => e.departamentoId === departamentoId);
    return porDept.length > 0 ? porDept : empleados;
  }, [empleados, departamentoId]);

  if (!isOpen) return null;

  // Validación de campos en cliente antes del envío
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!descripcion.trim()) {
      errors.descripcion = "La descripción del activo es obligatoria.";
    } else if (descripcion.trim().length < 3) {
      errors.descripcion = "La descripción debe contener al menos 3 caracteres.";
    }

    if (!isEditing) {
      if (!departamentoId) {
        errors.departamentoId = "Debe seleccionar el departamento de radicación.";
      }
      if (!empleadoId) {
        errors.empleadoId = "Debe seleccionar el custodio responsable inicial.";
      }
      if (!tipoActivoId) {
        errors.tipoActivoId = "Debe seleccionar la clasificación de tipo de activo.";
      }
    }

    if (!isEditing || !poseeHistorialDepreciacion) {
      const costoNum = parseFloat(costoAdquisicion);
      if (isNaN(costoNum) || costoNum <= 0) {
        errors.costoAdquisicion = "El costo de adquisición debe ser estrictamente mayor a RD$ 0.00.";
      }

      const residualNum = parseFloat(valorResidual || "0");
      if (isNaN(residualNum) || residualNum < 0) {
        errors.valorResidual = "El valor residual no puede ser negativo.";
      } else if (!isNaN(costoNum) && residualNum > costoNum) {
        errors.valorResidual = "El valor residual no puede exceder el costo de compra.";
      }

      if (!fechaAdquisicion) {
        errors.fechaAdquisicion = "La fecha de adquisición es obligatoria.";
      } else {
        const fechaIngresada = new Date(fechaAdquisicion + "T00:00:00");
        const hoy = new Date();
        hoy.setHours(23, 59, 59, 999);
        if (fechaIngresada > hoy) {
          errors.fechaAdquisicion = "La fecha de adquisición no puede ser futura.";
        }
      }
    }

    if (codigo.trim() && !/^ACT-\d{4}-\d{4,}$/.test(codigo.trim())) {
      errors.codigo = "Formato inválido. Debe seguir el patrón ACT-YYYY-NNNN (ej. ACT-2026-0001).";
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
      if (isEditing && assetToEdit) {
        // Enviar actualización
        const payload: Record<string, any> = {
          descripcion: descripcion.trim(),
          estado,
          marca: marca.trim() || null,
          modelo: modelo.trim() || null,
          numeroSerie: numeroSerie.trim() || null,
          ubicacionFisica: ubicacionFisica.trim() || null,
          color: color.trim() || null,
        };

        if (!poseeHistorialDepreciacion) {
          payload.costoAdquisicion = parseFloat(costoAdquisicion);
          payload.valorResidual = parseFloat(valorResidual || "0");
          payload.fechaAdquisicion = fechaAdquisicion;
          if (tipoActivoId) payload.tipoActivoId = tipoActivoId;
        }

        const res = await fetch(`/api/activos/${assetToEdit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) {
          if (res.status === 409 && json.error === "FINANCIAL_FIELDS_LOCKED") {
            setPoseeHistorialDepreciacion(true);
            throw new Error(
              "No es posible modificar valores financieros: el bien ya posee corridas de depreciación registradas."
            );
          }
          throw new Error(json.message || "Error al actualizar el activo fijo.");
        }

        onSaved(json);
        onClose();
      } else {
        // Enviar creación
        const payload: Record<string, any> = {
          descripcion: descripcion.trim(),
          departamentoId,
          empleadoId,
          tipoActivoId,
          fechaAdquisicion,
          costoAdquisicion: parseFloat(costoAdquisicion),
          valorResidual: parseFloat(valorResidual || "0"),
          estado,
          marca: marca.trim() || null,
          modelo: modelo.trim() || null,
          numeroSerie: numeroSerie.trim() || null,
          ubicacionFisica: ubicacionFisica.trim() || null,
          color: color.trim() || null,
        };

        if (codigo.trim()) {
          payload.codigo = codigo.trim();
        }

        const res = await fetch("/api/activos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) {
          if (res.status === 409 && json.error === "ASSET_CODE_DUPLICATE") {
            setFieldErrors((prev) => ({
              ...prev,
              codigo: "El código institucional ya se encuentra asignado a otro bien.",
            }));
            throw new Error("El código institucional ya está registrado en el inventario.");
          }
          throw new Error(json.message || "Error al registrar el activo fijo.");
        }

        onSaved(json);
        onClose();
      }
    } catch (err: any) {
      setServerError(err.message || "Ocurrió un error inesperado al procesar el activo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-8">
        {/* Encabezado Modal */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002D62] text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                  {isEditing ? "Editar Ficha de Activo Fijo" : "Alta de Activo Institucional"}
                </h2>
                {isEditing && (
                  <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {codigo}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditing
                  ? "Actualice los metadatos físicos y ubicación del bien. Custodia y valores fiscales protegidos."
                  : "Ingrese los detalles del activo, asignación de custodia inicial y parámetros contables DGII."}
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

        {/* Cuerpo del Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Banner de Error del Servidor */}
          {serverError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in duration-150">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {/* Banner de Bloqueo Contable en Edición */}
          {isEditing && poseeHistorialDepreciacion && (
            <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-xl flex items-start gap-3 text-xs text-amber-900 animate-in fade-in duration-150">
              <Lock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 leading-relaxed">
                <strong className="font-semibold text-amber-950 block mb-0.5">
                  Bloqueo Contable Activo (Historial de Depreciación Detectado)
                </strong>
                Este bien ya posee corridas de depreciación o asientos fiscales registrados. Los valores de adquisición, valor residual, fecha y tipo de activo están bloqueados para garantizar la consistencia en el balance general y reportes de la DGII.
              </div>
            </div>
          )}

          {/* Custodia Actual en Modo Edición (Informativo) */}
          {isEditing && assetToEdit && (
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>Custodia y Radicación Actual</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block">Departamento:</span>
                  <span className="font-medium text-slate-800">
                    {assetToEdit.departamento?.codigo} — {assetToEdit.departamento?.descripcion}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Custodio Responsable:</span>
                  <span className="font-medium text-slate-800">
                    {assetToEdit.empleado?.nombre} {assetToEdit.empleado?.apellido} ({formatearCedula(assetToEdit.empleado?.cedula || "")})
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic mt-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Para trasladar este bien a otro custodio o departamento, utilice la opción <strong>Trasladar</strong> en el menú de la tabla.
              </p>
            </div>
          )}
          {/* Sección 1: Identificación y Clasificación */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Layers className="w-3.5 h-3.5" />
              <span>Identificación Institucional</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Código de Activo */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Código Correlativo
                </label>
                <input
                  type="text"
                  disabled={isEditing}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder={isEditing ? codigo : "ACT-YYYY-NNNN (Auto)"}
                  className={`w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border ${
                    fieldErrors.codigo
                      ? "border-rose-300 focus:ring-rose-500"
                      : "border-slate-200 focus:ring-[#002D62]"
                  } ${
                    isEditing
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "bg-white text-slate-800 placeholder-slate-400"
                  } focus:outline-hidden focus:ring-2 transition-all`}
                />
                {fieldErrors.codigo && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {fieldErrors.codigo}
                  </p>
                )}
                {!isEditing && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Opcional. Si se deja en blanco, el sistema asignará el siguiente correlativo anual.
                  </p>
                )}
              </div>

              {/* Estado Operativo */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Estado Operativo *
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as "ACTIVO" | "EN_MANTENIMIENTO")}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#002D62] transition-all cursor-pointer"
                >
                  <option value="ACTIVO">ACTIVO (En operación normal)</option>
                  <option value="EN_MANTENIMIENTO">EN MANTENIMIENTO (Revisión técnica)</option>
                </select>
              </div>
            </div>

            {/* Descripción del Activo */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Descripción del Activo Fijo *
              </label>
              <textarea
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Computador Todo-en-Uno Dell OptiPlex 7400, Core i7, 16GB RAM, SSD 512GB"
                className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.descripcion
                    ? "border-rose-300 focus:ring-rose-500"
                    : "border-slate-200 focus:ring-[#002D62]"
                } bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 transition-all`}
              />
              {fieldErrors.descripcion && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.descripcion}
                </p>
              )}
            </div>
          </div>

          {/* Sección 2: Custodia y Clasificación (Solo en creación) */}
          {!isEditing && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Building2 className="w-3.5 h-3.5" />
                <span>Asignación Inicial y Ubicación</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Departamento */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Departamento de Radicación *
                  </label>
                  <select
                    value={departamentoId}
                    onChange={(e) => setDepartamentoId(e.target.value)}
                    className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                      fieldErrors.departamentoId
                        ? "border-rose-300 focus:ring-rose-500"
                        : "border-slate-200 focus:ring-[#002D62]"
                    } bg-white text-slate-800 focus:outline-hidden focus:ring-2 transition-all cursor-pointer`}
                  >
                    <option value="">-- Seleccione un Departamento --</option>
                    {departamentos.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.codigo} — {dept.descripcion}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.departamentoId && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                      {fieldErrors.departamentoId}
                    </p>
                  )}
                </div>

                {/* Custodio Responsable */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Custodio Responsable (Empleado) *
                  </label>
                  <select
                    disabled={isLoadingEmpleados}
                    value={empleadoId}
                    onChange={(e) => setEmpleadoId(e.target.value)}
                    className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                      fieldErrors.empleadoId
                        ? "border-rose-300 focus:ring-rose-500"
                        : "border-slate-200 focus:ring-[#002D62]"
                    } bg-white text-slate-800 focus:outline-hidden focus:ring-2 transition-all disabled:bg-slate-100 cursor-pointer`}
                  >
                    <option value="">
                      {isLoadingEmpleados
                        ? "Cargando lista de custodios..."
                        : "-- Seleccione el Empleado Custodio --"}
                    </option>
                    {empleadosFiltrados.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombre} {emp.apellido} — Céd: {formatearCedula(emp.cedula)}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.empleadoId && (
                    <p className="text-[11px] text-rose-600 mt-1 font-medium">
                      {fieldErrors.empleadoId}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sección 3: Metadatos Físicos y de Fabricante */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Tag className="w-3.5 h-3.5" />
              <span>Especificaciones Físicas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Marca */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Marca
                </label>
                <input
                  type="text"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ej: Dell, HP, Epson, Cisco"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#002D62] transition-all"
                />
              </div>

              {/* Modelo */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Modelo
                </label>
                <input
                  type="text"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ej: OptiPlex 7400"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#002D62] transition-all"
                />
              </div>

              {/* Número de Serie */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Número de Serie
                </label>
                <input
                  type="text"
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                  placeholder="Ej: SN-9874521098"
                  className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#002D62] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Ubicación Física */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Ubicación Física Detallada
                </label>
                <input
                  type="text"
                  value={ubicacionFisica}
                  onChange={(e) => setUbicacionFisica(e.target.value)}
                  placeholder="Ej: Edificio 1, Nivel 2, Laboratorio de Cómputo B"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#002D62] transition-all"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Color
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Ej: Negro, Gris Plata, Blanco"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#002D62] transition-all"
                />
              </div>
            </div>
          </div>

          {/* Sección 4: Parámetros Financieros y Clasificación DGII */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Datos Financieros y Clasificación DGII</span>
              </div>
              {isEditing && poseeHistorialDepreciacion && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  <Lock className="w-3 h-3" /> Bloqueado Contablemente
                </span>
              )}
            </div>

            {/* Clasificación de Tipo de Activo */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tipo de Activo / Categoría Fiscal DGII *
              </label>
              <select
                disabled={isEditing && poseeHistorialDepreciacion}
                value={tipoActivoId}
                onChange={(e) => setTipoActivoId(e.target.value)}
                className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                  fieldErrors.tipoActivoId
                    ? "border-rose-300 focus:ring-rose-500"
                    : "border-slate-200 focus:ring-[#002D62]"
                } ${
                  isEditing && poseeHistorialDepreciacion
                    ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                    : "bg-white text-slate-800"
                } focus:outline-hidden focus:ring-2 transition-all cursor-pointer`}
              >
                <option value="">-- Seleccione la Categoría Fiscal --</option>
                {tiposActivos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.codigo} — {tipo.descripcion} (Depr: {tipo.porcentajeDepreciacionAnual}% anual)
                  </option>
                ))}
              </select>
              {fieldErrors.tipoActivoId && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {fieldErrors.tipoActivoId}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Fecha de Adquisición */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Fecha de Adquisición *
                </label>
                <input
                  type="date"
                  disabled={isEditing && poseeHistorialDepreciacion}
                  max={new Date().toISOString().split("T")[0]}
                  value={fechaAdquisicion}
                  onChange={(e) => setFechaAdquisicion(e.target.value)}
                  className={`w-full text-xs px-3.5 py-2.5 rounded-xl border ${
                    fieldErrors.fechaAdquisicion
                      ? "border-rose-300 focus:ring-rose-500"
                      : "border-slate-200 focus:ring-[#002D62]"
                  } ${
                    isEditing && poseeHistorialDepreciacion
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "bg-white text-slate-800"
                  } focus:outline-hidden focus:ring-2 transition-all`}
                />
                {fieldErrors.fechaAdquisicion && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {fieldErrors.fechaAdquisicion}
                  </p>
                )}
              </div>

              {/* Costo de Adquisición */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Costo de Adquisición (RD$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    RD$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    disabled={isEditing && poseeHistorialDepreciacion}
                    value={costoAdquisicion}
                    onChange={(e) => setCostoAdquisicion(e.target.value)}
                    placeholder="0.00"
                    className={`w-full text-xs font-mono pl-11 pr-3.5 py-2.5 rounded-xl border ${
                      fieldErrors.costoAdquisicion
                        ? "border-rose-300 focus:ring-rose-500"
                        : "border-slate-200 focus:ring-[#002D62]"
                    } ${
                      isEditing && poseeHistorialDepreciacion
                        ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                        : "bg-white text-slate-800 placeholder-slate-400"
                    } focus:outline-hidden focus:ring-2 transition-all`}
                  />
                </div>
                {fieldErrors.costoAdquisicion && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {fieldErrors.costoAdquisicion}
                  </p>
                )}
              </div>

              {/* Valor Residual */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Valor Residual Estimado (RD$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    RD$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.00"
                    disabled={isEditing && poseeHistorialDepreciacion}
                    value={valorResidual}
                    onChange={(e) => setValorResidual(e.target.value)}
                    placeholder="0.00"
                    className={`w-full text-xs font-mono pl-11 pr-3.5 py-2.5 rounded-xl border ${
                      fieldErrors.valorResidual
                        ? "border-rose-300 focus:ring-rose-500"
                        : "border-slate-200 focus:ring-[#002D62]"
                    } ${
                      isEditing && poseeHistorialDepreciacion
                        ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                        : "bg-white text-slate-800 placeholder-slate-400"
                    } focus:outline-hidden focus:ring-2 transition-all`}
                  />
                </div>
                {fieldErrors.valorResidual && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">
                    {fieldErrors.valorResidual}
                  </p>
                )}
              </div>
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
              disabled={isSubmitting || isLoadingDetail}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#002D62] hover:bg-[#002047] shadow-xs hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : isEditing ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Registrar Activo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}