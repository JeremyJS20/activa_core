"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, X, Loader2, ShieldAlert } from "lucide-react";
import { EmployeeRow } from "./employee-dialog";

interface EmployeeDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeRow | null;
  onDeleted: () => void;
}

export function EmployeeDeleteDialog({
  isOpen,
  onClose,
  employee,
  onDeleted,
}: EmployeeDeleteDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !employee) return null;

  const isDepartmentHead =
    Array.isArray(employee.departamentosResponsable) &&
    employee.departamentosResponsable.length > 0;

  const handleDelete = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/empleados/" + employee.id, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "No fue posible eliminar el registro del empleado.");
      }

      onDeleted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Error al procesar la solicitud de eliminación.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInactivate = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/empleados/" + employee.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "INACTIVO" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "No fue posible inactivar al empleado.");
      }

      onDeleted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Error al intentar inactivar al empleado.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col my-8">
        {/* Header Modal */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={
                "w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs " +
                (isDepartmentHead ? "bg-amber-600" : "bg-rose-600")
              }
            >
              {isDepartmentHead ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                {isDepartmentHead
                  ? "Custodio con Departamentos Asignados"
                  : "¿Eliminar Colaborador?"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {employee.codigo} · {employee.nombre} {employee.apellido}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isDepartmentHead ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Este colaborador figura formalmente como responsable de:
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-xs font-semibold text-amber-900 space-y-1">
                {employee.departamentosResponsable!.map((dept) => (
                  <div key={dept.id}>? {dept.codigo} ? {dept.descripcion}</div>
                ))}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Por política de auditoría institucional UNAPEC, debe reasignar la titularidad del departamento antes de proceder con la desvinculación o baja de este custodio.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                ¿Está seguro de que desea eliminar permanentemente al colaborador{" "}
                <span className="font-semibold text-slate-900">
                  "{employee.nombre} {employee.apellido}"
                </span>
                ?
              </p>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
                Si el colaborador cuenta con activos fijos asignados en su histórico, se recomienda mantenerlo en estado <span className="font-semibold">INACTIVO</span> para no alterar los libros de inventario.
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            {!isDepartmentHead && employee.estado === "ACTIVO" && (
              <button
                type="button"
                onClick={handleInactivate}
                disabled={isProcessing}
                className="px-3.5 py-2 text-xs font-semibold text-amber-700 bg-amber-100/80 hover:bg-amber-200/80 rounded-xl transition-colors disabled:opacity-50"
              >
                Solo Inactivar
              </button>
            )}

            {!isDepartmentHead && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Definitivamente</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
