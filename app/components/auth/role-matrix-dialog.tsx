"use client";

import { useState, useEffect } from "react";
import { X, ShieldCheck, Check, Minus, Loader2 } from "lucide-react";

interface RoleData {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
  estado: string;
  totalUsuarios: number;
  totalPermisos: number;
  permisos: string[];
}

interface RoleMatrixDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALL_SYSTEM_PERMISSIONS = [
  { codigo: "USER_ADMIN", modulo: "Seguridad", descripcion: "Administración global de usuarios, roles y desbloqueo" },
  { codigo: "CAT_WRITE", modulo: "Catálogos", descripcion: "Creación, edición y anulación de departamentos y tipos de activos" },
  { codigo: "CAT_READ", modulo: "Catálogos", descripcion: "Consulta de catálogos institucionales" },
  { codigo: "ACT_OPERATE", modulo: "Activos", descripcion: "Registro, asignación de custodios y transferencias de activos" },
  { codigo: "ACT_READ", modulo: "Activos", descripcion: "Consulta de inventario y generación de fichas técnicas" },
  { codigo: "DEP_EXECUTE", modulo: "Depreciación", descripcion: "Cálculo mensual, generación de asientos y amortización DGII" },
  { codigo: "DEP_READ", modulo: "Depreciación", descripcion: "Consulta de tablas y proyecciones de depreciación" },
  { codigo: "INT_MANAGE", modulo: "Integraciones", descripcion: "Control de envíos contables y monitor de Web Service" },
];

export function RoleMatrixDialog({ isOpen, onClose }: RoleMatrixDialogProps) {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch("/api/roles")
      .then(async (res) => {
        if (!res.ok) throw new Error("No fue posible cargar el catálogo de roles.");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setRoles(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Error al consultar roles.");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EBF3FC] text-[#003D9B] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                Matriz Institucional de Roles y Permisos (RBAC)
              </h2>
              <p className="text-xs text-[#505F76]">
                Mapeo canónico de capacidades relacionales aplicadas en UNAPEC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#505F76] hover:bg-slate-100 hover:text-[#1B2A4A] transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-[#505F76]">
              <Loader2 className="w-8 h-8 animate-spin text-[#003D9B] mb-3" />
              <p className="text-sm font-medium">Cargando matriz relacional...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl text-sm font-medium bg-[#FFDAD6] text-[#93000A]">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tabla de Matriz */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F2F3FF] text-[#505F76] border-b border-slate-200">
                      <th className="py-3 px-4 font-semibold uppercase tracking-[0.08em] w-1/3">
                        Permiso / Capacidad
                      </th>
                      <th className="py-3 px-3 font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Módulo
                      </th>
                      {roles.map((r) => (
                        <th
                          key={r.id}
                          className="py-3 px-3 font-semibold uppercase tracking-[0.08em] text-center"
                        >
                          <span className="block text-[#1B2A4A]">{r.codigo}</span>
                          <span className="text-[10px] text-[#505F76] font-normal lowercase">
                            ({r.totalUsuarios} u.)
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ALL_SYSTEM_PERMISSIONS.map((perm) => (
                      <tr key={perm.codigo} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold text-[#1B2A4A] block">
                            {perm.codigo}
                          </span>
                          <span className="text-[11px] text-[#505F76]">
                            {perm.descripcion}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#505F76] font-medium">
                          {perm.modulo}
                        </td>
                        {roles.map((r) => {
                          const hasPermission = r.permisos.includes(perm.codigo);
                          return (
                            <td key={r.id} className="py-3 px-3 text-center">
                              {hasPermission ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#DCFCE7] text-[#166534]">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 text-slate-300">
                                  <Minus className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Roles Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {roles.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-display font-bold text-xs text-[#1B2A4A]">
                          {r.nombre}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#EBF3FC] text-[#003D9B]">
                          {r.codigo}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#505F76] leading-snug">
                        {r.descripcion || "Sin descripción asignada."}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Usuarios: {r.totalUsuarios}</span>
                      <span>Permisos: {r.permisos.length}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider text-[#1B2A4A] bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}