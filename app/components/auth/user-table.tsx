"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  UserPlus,
  ShieldCheck,
  Unlock,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { UserDialog } from "./user-dialog";
import { RoleMatrixDialog } from "./role-matrix-dialog";

interface UserItem {
  id: string;
  nombre: string;
  correo: string;
  rolId: string;
  rol: {
    id: string;
    codigo: string;
    nombre: string;
  };
  empleadoId: string | null;
  estado: "ACTIVO" | "INACTIVO" | "BLOQUEADO";
  ultimoLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RoleOption {
  id: string;
  codigo: string;
  nombre: string;
}

export function UserTable() {
  const [usuarios, setUsuarios] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Pagination & Filter States
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState("");
  const [selectedRol, setSelectedRol] = useState("");
  const [selectedEstado, setSelectedEstado] = useState("");

  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  // Load Roles Catalog
  useEffect(() => {
    fetch("/api/roles")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        setRoles(
          data.map((r) => ({
            id: r.id,
            codigo: r.codigo,
            nombre: r.nombre,
          }))
        );
      })
      .catch(() => {});
  }, []);

  // Fetch Users
  const fetchUsuarios = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    if (search.trim()) params.set("search", search.trim());
    if (selectedRol) params.set("rolId", selectedRol);
    if (selectedEstado) params.set("estado", selectedEstado);

    try {
      const res = await fetch(`/api/usuarios?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Acceso denegado: Se requiere permiso USER_ADMIN para consultar usuarios.");
        }
        throw new Error("No fue posible cargar el directorio de usuarios.");
      }

      const json = await res.json();
      setUsuarios(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalCount(json.pagination?.total || 0);
      setIsLoading(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al consultar usuarios.");
      setIsLoading(false);
    }
  }, [page, limit, search, selectedRol, selectedEstado]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  // Handle Account Unlock
  const handleUnlock = async (id: string, nombre: string) => {
    setUnlockingId(id);
    setSuccessToast(null);

    try {
      const res = await fetch(`/api/usuarios/${id}/unlock`, {
        method: "POST",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMessage(data?.message || "No se pudo desbloquear la cuenta.");
        setUnlockingId(null);
        return;
      }

      setSuccessToast(`Cuenta de "${nombre}" desbloqueada exitosamente.`);
      setTimeout(() => setSuccessToast(null), 4000);
      setUnlockingId(null);
      fetchUsuarios();
    } catch {
      setErrorMessage("Error de conexión al intentar desbloquear la cuenta.");
      setUnlockingId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Sin registros";
    const d = new Date(dateStr);
    return d.toLocaleString("es-DO", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {successToast && (
        <div
          role="status"
          className="p-4 rounded-xl text-sm font-medium bg-[#DCFCE7] text-[#166534] flex items-center justify-between shadow-sm animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#166534]" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-xs uppercase font-bold text-[#166534] hover:underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl text-sm font-medium bg-[#FFDAD6] text-[#93000A] flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-[#93000A]" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs uppercase font-bold text-[#93000A] hover:underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Toolbar Superior */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        {/* Filtros Izquierda */}
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Input Busqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por nombre o correo..."
              className="w-full h-10 pl-10 pr-4 bg-[#F2F3FF] text-[#1B2A4A] text-xs rounded-xl outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#0052CC] transition-all"
            />
          </div>

          {/* Filtro Rol */}
          <select
            value={selectedRol}
            onChange={(e) => {
              setSelectedRol(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 bg-[#F2F3FF] text-[#1B2A4A] text-xs rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#0052CC] transition-all cursor-pointer font-medium"
          >
            <option value="">Todos los Roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>

          {/* Filtro Estado */}
          <select
            value={selectedEstado}
            onChange={(e) => {
              setSelectedEstado(e.target.value);
              setPage(1);
            }}
            className="h-10 px-3 bg-[#F2F3FF] text-[#1B2A4A] text-xs rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#0052CC] transition-all cursor-pointer font-medium"
          >
            <option value="">Todos los Estados</option>
            <option value="ACTIVO">ACTIVO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>
        </div>

        {/* Acciones Derecha */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchUsuarios()}
            disabled={isLoading}
            title="Refrescar catálogo"
            className="w-10 h-10 rounded-xl bg-slate-100 text-[#505F76] hover:bg-slate-200 hover:text-[#1B2A4A] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setIsMatrixModalOpen(true)}
            className="h-10 px-4 rounded-xl text-xs font-semibold text-[#003D9B] bg-[#EBF3FC] hover:bg-[#D9EAFB] transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Matriz de Roles</span>
          </button>

          <button
            onClick={() => setIsUserModalOpen(true)}
            className="h-10 px-4 rounded-xl text-xs font-semibold text-white tracking-wider uppercase flex items-center gap-2 shadow-sm hover:shadow transition-all cursor-pointer"
            style={{ background: "linear-gradient(135deg, #003D9B 0%, #0052CC 100%)" }}
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F2F3FF] text-[#505F76] border-b border-slate-200">
                <th className="py-3 px-5 font-semibold uppercase tracking-[0.08em]">
                  Colaborador / Cuenta
                </th>
                <th className="py-3 px-4 font-semibold uppercase tracking-[0.08em]">
                  Rol Institucional
                </th>
                <th className="py-3 px-4 font-semibold uppercase tracking-[0.08em]">
                  Estado
                </th>
                <th className="py-3 px-4 font-semibold uppercase tracking-[0.08em]">
                  Último Acceso
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-[0.08em] text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#505F76]">
                    <Loader2 className="w-7 h-7 animate-spin text-[#003D9B] mx-auto mb-3" />
                    <p className="text-xs font-medium">Consultando directorio de usuarios...</p>
                  </td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#505F76]">
                    <p className="text-sm font-semibold text-[#1B2A4A] mb-1">
                      No se encontraron usuarios
                    </p>
                    <p className="text-xs text-slate-500">
                      No existen colaboradores registrados que coincidan con los filtros aplicados.
                    </p>
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F2F3FF]/40 transition-colors h-[54px]">
                    {/* Usuario */}
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-display font-bold text-xs uppercase">
                          {u.nombre.slice(0, 2)}
                        </div>
                        <div>
                          <span className="font-display font-bold text-sm text-[#1B2A4A] block leading-snug">
                            {u.nombre}
                          </span>
                          <span className="text-[11px] text-[#505F76] font-mono block">
                            {u.correo}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Rol */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-[#EBF3FC] text-[#003D9B]">
                        {u.rol?.nombre || "Sin Rol"}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="py-3 px-4">
                      {u.estado === "ACTIVO" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#DCFCE7] text-[#166534]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                          Activo
                        </span>
                      ) : u.estado === "BLOQUEADO" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFDAD6] text-[#93000A]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#93000A]" />
                          Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Inactivo
                        </span>
                      )}
                    </td>

                    {/* Ultimo Acceso */}
                    <td className="py-3 px-4 text-[#505F76] font-mono text-[11px]">
                      {formatDate(u.ultimoLoginAt)}
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => handleUnlock(u.id, u.nombre)}
                        disabled={unlockingId === u.id}
                        title="Desbloquear intentos de acceso o bloqueo temporal"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#003D9B] bg-[#EBF3FC] hover:bg-[#D9EAFB] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {unlockingId === u.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                        <span>Desbloquear</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginador */}
        <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <p className="text-xs text-[#505F76]">
            Mostrando <strong className="text-[#1B2A4A]">{usuarios.length}</strong> de{" "}
            <strong className="text-[#1B2A4A]">{totalCount}</strong> colaboradores registrados
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#1B2A4A] hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <span className="text-xs text-[#505F76] px-2 font-mono">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#1B2A4A] hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <UserDialog
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onUserCreated={() => {
          setSuccessToast("Usuario registrado exitosamente en UNAPEC.");
          setTimeout(() => setSuccessToast(null), 4000);
          fetchUsuarios();
        }}
      />

      <RoleMatrixDialog
        isOpen={isMatrixModalOpen}
        onClose={() => setIsMatrixModalOpen(false)}
      />
    </div>
  );
}