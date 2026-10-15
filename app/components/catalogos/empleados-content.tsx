"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CatalogDataTable } from "@/components/catalogos/catalog-data-table";
import {
  EmployeeDialog,
  EmployeeRow,
  DepartmentOption,
} from "@/components/catalogos/employee-dialog";
import { EmployeeDeleteDialog } from "@/components/catalogos/employee-delete-dialog";
import { formatearCedula, formatearRnc } from "@/lib/validators/identity";
import {
  Users,
  Building2,
  Calendar,
  CreditCard,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
} from "lucide-react";

export function EmpleadosContent() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [departamentoFilter, setDepartamentoFilter] = useState<string>("TODOS");
  const [estadoFilter, setEstadoFilter] = useState<"TODOS" | "ACTIVO" | "INACTIVO">("TODOS");

  // Modales
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<EmployeeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null);

  // Toast Notificación
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // Cargar departamentos para filtro
  useEffect(() => {
    fetch("/api/departamentos?estado=ACTIVO&limit=100")
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json?.data)) {
          setDepartments(
            json.data.map((d: any) => ({
              id: d.id,
              codigo: d.codigo,
              descripcion: d.descripcion,
            }))
          );
        }
      })
      .catch((err) => console.error("Error al cargar departamentos para filtro:", err));
  }, []);

  // Cargar colaboradores desde API
  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search.trim()) params.set("search", search.trim());
      if (departamentoFilter !== "TODOS") params.set("departamentoId", departamentoFilter);
      if (estadoFilter !== "TODOS") params.set("estado", estadoFilter);

      const res = await fetch("/api/empleados?" + params.toString());
      if (!res.ok) throw new Error("No fue posible cargar el directorio de colaboradores.");

      const json = await res.json();
      setEmployees(json.data || []);
      setTotalCount(json.pagination?.total || 0);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error("[EMPLEADOS_FETCH] Error:", err);
      showToast("error", err.message || "Error al cargar colaboradores.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, departamentoFilter, estadoFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleOpenCreate = () => {
    setEmployeeToEdit(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: EmployeeRow) => {
    setEmployeeToEdit(item);
    setIsDialogOpen(true);
  };

  // Alternar estado con optimistic UI
  const handleToggleEstado = async (item: EmployeeRow) => {
    const nuevoEstado = item.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";

    // Optimistic UI
    setEmployees((prev) =>
      prev.map((e) => (e.id === item.id ? { ...e, estado: nuevoEstado } : e))
    );

    try {
      const res = await fetch("/api/empleados/" + item.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "No fue posible actualizar el estado del empleado.");
      }

      showToast(
        "success",
        "Colaborador " + item.codigo + " marcado como " + nuevoEstado.toLowerCase() + "."
      );
    } catch (err: any) {
      // Revert optimistic
      setEmployees((prev) =>
        prev.map((e) => (e.id === item.id ? { ...e, estado: item.estado } : e))
      );
      showToast("error", err.message || "Error al alternar estado.");
    }
  };

  const handleSaved = () => {
    showToast(
      "success",
      employeeToEdit
        ? "Datos del colaborador actualizados satisfactoriamente."
        : "Colaborador registrado exitosamente en ActivaCore."
    );
    fetchEmployees();
  };

  const handleDeleted = () => {
    showToast("success", "Operación sobre el registro del empleado completada.");
    fetchEmployees();
  };

  const getInitials = (nombre: string, apellido: string) => {
    const n = nombre ? nombre[0] : "";
    const a = apellido ? apellido[0] : "";
    return (n + a).toUpperCase() || "EM";
  };

  return (
    <div className="space-y-6">
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
        title="Directorio de Custodios & Colaboradores"
        subtitle="Personal docente y administrativo autorizado para la custodia institucional de activos fijos."
        catalogoKey="empleados"
        searchPlaceholder="Buscar por nombre, código, cargo, correo o cédula..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        addNewLabel="Nuevo Colaborador"
        onAddNew={handleOpenCreate}
        isLoading={isLoading}
        totalCount={totalCount}
        page={page}
        limit={limit}
        totalPages={totalPages}
        onPageChange={(newPage) => setPage(newPage)}
        onRefresh={fetchEmployees}
        emptyTitle="No se encontraron colaboradores"
        emptyDescription="No existen colaboradores registrados o ningún registro coincide con los criterios de búsqueda."
        filters={
          <div className="flex items-center gap-3 flex-wrap">
            {/* Filtro Departamento */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-500 font-mono">
                Depto:
              </label>
              <select
                value={departamentoFilter}
                onChange={(e) => {
                  setDepartamentoFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors max-w-xs truncate"
              >
                <option value="TODOS">Todos los Departamentos</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.codigo} · {d.descripcion}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Estado */}
            <div className="flex items-center gap-1.5">
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
          </div>
        }
      >
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
            <tr>
              <th className="px-5 py-3">Código</th>
              <th className="px-5 py-3">Colaborador / Custodio</th>
              <th className="px-5 py-3">Documento (JCE / DGII)</th>
              <th className="px-5 py-3">Departamento Asignado</th>
              <th className="px-5 py-3 text-center">Fecha Ingreso</th>
              <th className="px-5 py-3 text-center">Estado</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                {/* Código */}
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/60">
                    {emp.codigo}
                  </span>
                </td>

                {/* Colaborador & Cargo */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#002D62] text-white flex items-center justify-center font-display font-bold text-xs shrink-0 shadow-2xs">
                      {getInitials(emp.nombre, emp.apellido)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 leading-tight">
                        {emp.nombre} {emp.apellido}
                      </div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        {emp.cargo}
                      </div>
                      {emp.correo && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{emp.correo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Documento de Identidad */}
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="font-mono text-xs text-slate-800 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60 inline-flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {emp.tipoPersona === "JURIDICA"
                        ? formatearRnc(emp.cedula)
                        : formatearCedula(emp.cedula)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {emp.tipoPersona === "JURIDICA" ? "RNC DGII" : "Cédula JCE"}
                  </div>
                </td>

                {/* Departamento Asignado */}
                <td className="px-5 py-3.5">
                  {emp.departamento ? (
                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{emp.departamento.descripcion}</span>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 rounded">
                        {emp.departamento.codigo}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sin departamento</span>
                  )}
                </td>

                {/* Fecha Ingreso */}
                <td className="px-5 py-3.5 text-center whitespace-nowrap font-mono text-xs text-slate-600">
                  {emp.fechaIngreso
                    ? new Date(emp.fechaIngreso).toLocaleDateString("es-DO", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    : "?"}
                </td>

                {/* Estado con Toggle Rápido */}
                <td className="px-5 py-3.5 text-center whitespace-nowrap">
                  <button
                    onClick={() => handleToggleEstado(emp)}
                    title="Haga clic para alternar estado"
                    className="cursor-pointer group inline-flex items-center"
                  >
                    {emp.estado === "ACTIVO" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 group-hover:bg-emerald-100 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 group-hover:bg-slate-200 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Inactivo
                      </span>
                    )}
                  </button>
                </td>

                {/* Acciones */}
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleOpenEdit(emp)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#003D9B] hover:bg-slate-100 transition-colors"
                      title="Editar datos del colaborador"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(emp)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Eliminar o inactivar colaborador"
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

      {/* Diálogo de Creación / Edición */}
      <EmployeeDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSaved={handleSaved}
        employeeToEdit={employeeToEdit}
      />

      {/* Diálogo de Confirmación de Borrado */}
      <EmployeeDeleteDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        employee={deleteTarget}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
