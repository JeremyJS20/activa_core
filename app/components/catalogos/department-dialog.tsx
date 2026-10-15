"use client";

import React, { useState, useEffect } from "react";
import { Building2, X, Loader2, AlertCircle } from "lucide-react";
import {
  DepartmentCreateSchema,
  DepartmentUpdateSchema,
} from "@/lib/schemas/department.schema";

export interface DepartmentRow {
  id: string;
  codigo: string;
  descripcion: string;
  responsable: {
    id: string;
    codigo: string;
    nombre: string;
    apellido: string;
    correo?: string | null;
    cargo?: string | null;
  } | null;
  responsableId?: string | null;
  estado: "ACTIVO" | "INACTIVO";
  totalEmpleados: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeOption {
  id: string;
  codigo: string;
  nombreCompleto: string;
  cargo: string | null;
}

interface DepartmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  departmentToEdit?: DepartmentRow | null;
}

export function DepartmentDialog({
  isOpen,
  onClose,
  onSaved,
  departmentToEdit,
}: DepartmentDialogProps) {
  const isEditing = Boolean(departmentToEdit);

  // Form State
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">("ACTIVO");

  // Operational State
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Cargar datos iniciales al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    if (departmentToEdit) {
      setCodigo(departmentToEdit.codigo || "");
      setDescripcion(departmentToEdit.descripcion || "");
      setResponsableId(departmentToEdit.responsable?.id || departmentToEdit.responsableId || "");
      setEstado(departmentToEdit.estado || "ACTIVO");
    } else {
      setCodigo("");
      setDescripcion("");
      setResponsableId("");
      setEstado("ACTIVO");
    }

    setFieldErrors({});
    setServerError(null);

    // Cargar custodios/empleados activos para asignacion de responsable
    let isMounted = true;
    setIsLoadingEmployees(true);

    fetch("/api/empleados?estado=ACTIVO&limit=100")
      .then(async (res) => {
        if (!res.ok) throw new Error("No fue posible cargar el cat?logo de empleados.");
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        const mapped: EmployeeOption[] = list.map((emp: any) => ({
          id: emp.id,
          codigo: emp.codigo,
          nombreCompleto: emp.nombreCompleto || (emp.nombre + " " + emp.apellido).trim(),
          cargo: emp.cargo || null,
        }));

        // Si estamos editando y el responsable actual esta inactivo, conservarlo en el select
        if (departmentToEdit?.responsable && !mapped.some((e) => e.id === departmentToEdit.responsable!.id)) {
          mapped.unshift({
            id: departmentToEdit.responsable.id,
            codigo: departmentToEdit.responsable.codigo,
            nombreCompleto: departmentToEdit.responsable.nombre + " " + departmentToEdit.responsable.apellido + " (Inactivo)",
            cargo: departmentToEdit.responsable.cargo || null,
          });
        }

        setEmployees(mapped);
        setIsLoadingEmployees(false);
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Error al cargar empleados para responsable:", err);
          setIsLoadingEmployees(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, departmentToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const payload: {
      codigo?: string;
      descripcion: string;
      responsableId?: string | null;
      estado: "ACTIVO" | "INACTIVO";
    } = {
      descripcion: descripcion.trim(),
      responsableId: responsableId ? responsableId : null,
      estado,
    };

    if (codigo.trim()) {
      payload.codigo = codigo.trim().toUpperCase();
    }

    // Validar esquema mediante Zod
    const schema = isEditing ? DepartmentUpdateSchema : DepartmentCreateSchema;
    const validation = schema.safeParse(payload);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const fieldName = issue.path[0] as string;
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
        ? "/api/departamentos/" + departmentToEdit!.id
        : "/api/departamentos";

      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (responseData.error === "DEP_CODE_DUPLICATE") {
          setFieldErrors((prev) => ({
            ...prev,
            codigo: "Ya existe un departamento registrado con este c?digo.",
          }));
          throw new Error("El c?digo de departamento ya se encuentra registrado.");
        }
        if (responseData.error === "DEP_DESCRIPCION_DUPLICATE") {
          setFieldErrors((prev) => ({
            ...prev,
            descripcion: "Ya existe un departamento con esta descripci?n o nombre.",
          }));
          throw new Error("La descripci?n del departamento ya est? en uso.");
        }
        if (responseData.error === "RESPONSABLE_NOT_FOUND") {
          setFieldErrors((prev) => ({
            ...prev,
            responsableId: "El custodio responsable seleccionado no existe.",
          }));
          throw new Error("El custodio responsable no es v?lido.");
        }
        if (responseData.error === "RESPONSABLE_INACTIVE") {
          setFieldErrors((prev) => ({
            ...prev,
            responsableId: "El custodio seleccionado se encuentra en estado inactivo.",
          }));
          throw new Error("No se puede asignar un custodio inactivo como responsable.");
        }

        throw new Error(
          responseData.message ||
            (isEditing
              ? "Error al actualizar el departamento."
              : "Error al registrar el departamento.")
        );
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setServerError(err.message || "Ocurrió un error inesperado al procesar el departamento.");
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
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                {isEditing ? "Modificar Departamento" : "Nuevo Departamento"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditing
                  ? "Actualice los datos generales y el custodio asignado al centro de costos."
                  : "Complete los datos del centro de costo institucional para asignaci?n de activos."}
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

          {/* Grid de Codigo y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Codigo */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Código del Departamento
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
                placeholder={isEditing ? "ej. DEP-001" : "Auto-generado (DEP-XXX)"}
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
                  Formato alfanumérico institucional (ej: DEP-001).
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
                Departamentos inactivos no reciben nuevos activos.
              </p>
            </div>
          </div>

          {/* Nombre / Descripcion */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nombre o Descripción del Departamento <span className="text-rose-500">*</span>
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
              maxLength={120}
              placeholder="ej. Dirección de Tecnología de la Información"
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
                M?nimo 3 caracteres, m?ximo 120 caracteres.
              </p>
            )}
          </div>

          {/* Responsable / Custodio */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Custodio / Responsable del Departamento
            </label>
            <div className="relative">
              <select
                value={responsableId}
                onChange={(e) => {
                  setResponsableId(e.target.value);
                  if (fieldErrors.responsableId) {
                    setFieldErrors((prev) => ({ ...prev, responsableId: "" }));
                  }
                }}
                disabled={isLoadingEmployees}
                className={
                  "w-full pl-3.5 pr-8 py-2 text-sm bg-slate-50/70 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all " +
                  (fieldErrors.responsableId
                    ? "border-rose-300 focus:ring-rose-500/20 text-rose-900"
                    : "border-slate-200 focus:ring-[#003D9B]/20 focus:border-[#003D9B] text-slate-800")
                }
              >
                <option value="">-- Sin responsable asignado --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombreCompleto} {emp.cargo ? "? " + emp.cargo : ""} ({emp.codigo})
                  </option>
                ))}
              </select>
              {isLoadingEmployees && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              )}
            </div>
            {fieldErrors.responsableId ? (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                {fieldErrors.responsableId}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Colaborador que figura como firmante y custodio general del centro.
              </p>
            )}
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
                <span>Crear Departamento</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
