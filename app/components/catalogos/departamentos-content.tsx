"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CatalogNav } from "@/components/catalogos/catalog-nav";
import { CatalogDataTable } from "@/components/catalogos/catalog-data-table";
import {
  DepartmentDialog,
  DepartmentRow,
} from "@/components/catalogos/department-dialog";
import { DepartmentDeleteDialog } from "@/components/catalogos/department-delete-dialog";
import {
  Building2,
  Users,
  User,
  UserX,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export function DepartamentosContent() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"TODOS" | "ACTIVO" | "INACTIVO">("TODOS");

  // Modales
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [departmentToEdit, setDepartmentToEdit] = useState<DepartmentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentRow | null>(null);

  // Toast Notificacion local
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // Cargar departamentos desde API
  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search.trim()) params.set("search", search.trim());
      if (estadoFilter !== "TODOS") params.set("estado", estadoFilter);

      const res = await fetch("/api/departamentos?" + params.toString());
      if (!res.ok) throw new Error("No fue posible cargar el listado de departamentos.");

      const json = await res.json();
      setDepartments(json.data || []);
      setTotalCount(json.pagination?.total || 0);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error("[DEPARTAMENTOS_FETCH] Error:", err);
      showToast("error", err.message || "Error al cargar departamentos.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, estadoFilter]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleOpenCreate = () => {
    setDepartmentToEdit(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (dept: DepartmentRow) => {
    setDepartmentToEdit(dept);
    setIsDialogOpen(true);
  };

  const handleSaved = () => {
    showToast(
      "success",
      departmentToEdit
        ? "Departamento actualizado satisfactoriamente."
        : "Departamento registrado con ?xito en ActivaCore."
    );
    fetchDepartments();
  };

  const handleDeleted = () => {
    showToast("success", "Operación sobre el departamento completada.");
    fetchDepartments();
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Principal con Identidad Institucional UNAPEC */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#003D9B] uppercase tracking-wider font-mono mb-1">
            <Building2 className="w-4 h-4" />
            <span>Gesti?n de Estructura Organizacional</span>
          </div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
            Catálogo de Departamentos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Definición de centros de costos, asignación de custodios institucionales y estructura orgánica para activos fijos.
          </p>
        </div>

        {/* Navegaci?n entre Pestañas de Catálogos */}
        <CatalogNav />

        {/* Notificación Toast Local */}
        {toast && (
          <div
            className={
              "p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-150 " +
              (toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800")
            }
          >
            <div className="flex items-center gap-2">
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {/* Tabla Reactiva con Buscador y Paginador */}
        <CatalogDataTable
          title="Listado de Departamentos"
          subtitle="Centros de costos registrados en UNAPEC con activos o personal a cargo."
          catalogoKey="departamentos"
          searchPlaceholder="Buscar por c?digo o descripci?n..."
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          addNewLabel="Nuevo Departamento"
          onAddNew={handleOpenCreate}
          isLoading={isLoading}
          totalCount={totalCount}
          page={page}
          limit={limit}
          totalPages={totalPages}
          onPageChange={(newPage) => setPage(newPage)}
          onRefresh={fetchDepartments}
          emptyTitle="No se encontraron departamentos"
          emptyDescription="No existen departamentos registrados o ning?n registro coincide con los criterios de búsqueda."
          filters={
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 font-mono">
                Estado:
              </label>
              <select
                value={estadoFilter}
                onChange={(e) => {
                  setEstadoFilter(e.target.value as "TODOS" | "ACTIVO" | "INACTIVO");
                  setPage(1);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="ACTIVO">Solo Activos</option>
                <option value="INACTIVO">Solo Inactivos</option>
              </select>
            </div>
          }
        >
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              <tr>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Descripción / Centro</th>
                <th className="px-5 py-3">Responsable Custodio</th>
                <th className="px-5 py-3 text-center">Colaboradores</th>
                <th className="px-5 py-3 text-center">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Código */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/60">
                      {dept.codigo}
                    </span>
                  </td>

                  {/* Descripción */}
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-900">{dept.descripcion}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Ref: {dept.id.slice(0, 8)}
                    </div>
                  </td>

                  {/* Responsable */}
                  <td className="px-5 py-3.5">
                    {dept.responsable ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-medium text-xs shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-800 leading-tight">
                            {dept.responsable.nombre} {dept.responsable.apellido}
                          </div>
                          <div className="text-[11px] text-slate-400 leading-tight">
                            {dept.responsable.cargo || "Custodio"} ? {dept.responsable.codigo}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic flex items-center gap-1.5">
                        <UserX className="w-3.5 h-3.5 text-slate-300" />
                        Sin custodio asignado
                      </span>
                    )}
                  </td>

                  {/* Total Colaboradores */}
                  <td className="px-5 py-3.5 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{dept.totalEmpleados}</span>
                    </span>
                  </td>

                  {/* Estado */}
                  <td className="px-5 py-3.5 text-center whitespace-nowrap">
                    {dept.estado === "ACTIVO" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Inactivo
                      </span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(dept)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#003D9B] hover:bg-slate-100 transition-colors"
                        title="Editar departamento"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(dept)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Eliminar o inactivar departamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CatalogDataTable>

        {/* Di?logo de Creaci?n / Edici?n */}
        <DepartmentDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSaved={handleSaved}
          departmentToEdit={departmentToEdit}
        />

        {/* Di?logo de Confirmaci?n de Borrado / Inactivaci?n */}
        <DepartmentDeleteDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          department={deleteTarget}
          onDeleted={handleDeleted}
        />
      </div>
    </div>
  );
}
