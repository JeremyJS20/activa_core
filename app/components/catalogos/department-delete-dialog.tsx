"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, X, Loader2, ShieldAlert } from "lucide-react";
import { DepartmentRow } from "./department-dialog";

interface DepartmentDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  department: DepartmentRow | null;
  onDeleted: () => void;
}

export function DepartmentDeleteDialog({
  isOpen,
  onClose,
  department,
  onDeleted,
}: DepartmentDeleteDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !department) return null;

  const hasEmployees = department.totalEmpleados > 0;

  // Confirmar eliminaci?n f?sica (si no tiene empleados)
  const handleDelete = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/departamentos/" + department.id, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "No fue posible eliminar el departamento.");
      }

      onDeleted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Error al intentar eliminar el departamento.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Alternativa segura: inactivar en vez de eliminar
  const handleInactivate = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/departamentos/" + department.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "INACTIVO" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "No fue posible inactivar el departamento.");
      }

      onDeleted();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Error al intentar inactivar el departamento.");
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
                (hasEmployees ? "bg-amber-600" : "bg-rose-600")
              }
            >
              {hasEmployees ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                {hasEmployees
                  ? "Departamento con Dependencias"
                  : "?Eliminar Departamento?"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {department.codigo} ? {department.descripcion}
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

          {hasEmployees ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Este departamento cuenta actualmente con{" "}
                <span className="font-semibold text-slate-900">
                  {department.totalEmpleados} colaborador(es)
                </span>{" "}
                o custodios asignados.
              </p>
              <div className="p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-800 leading-relaxed">
                Por directriz de integridad referencial contable, no se puede eliminar f?sicamente un centro de costos con dependencias. Se sugiere inactivarlo para que permanezca en el hist?rico de auditor?a sin aceptar nuevas asignaciones.
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">
              ?Est? seguro de que desea eliminar permanentemente el centro de costos{" "}
              <span className="font-semibold text-slate-900">
                "{department.descripcion}"
              </span>
              ? Esta acci?n no se puede deshacer y su c?digo quedar? liberado.
            </p>
          )}

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>

            {hasEmployees ? (
              <button
                type="button"
                onClick={handleInactivate}
                disabled={isProcessing || department.estado === "INACTIVO"}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Inactivando...</span>
                  </>
                ) : department.estado === "INACTIVO" ? (
                  <span>Ya est? Inactivo</span>
                ) : (
                  <span>Inactivar Departamento</span>
                )}
              </button>
            ) : (
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
