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
  X,
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

  const startRecord = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {successToast && (
        <div
          role="status"
          className="p-4 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-between shadow-2xs animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-xs uppercase font-bold text-emerald-700 hover:underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl text-sm font-medium bg-rose-50 text-rose-800 border border-rose-200 flex items-center justify-between shadow-2xs animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs uppercase font-bold text-rose-700 hover:underline cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 font-display">
              Directorio de Colaboradores
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono border border-slate-200">
              {totalCount} {totalCount === 1 ? "usuario" : "usuarios"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestión institucional de credenciales, roles asignados y estado operativo.
          </p>
        </div>

        {/* Action Buttons: Refresh, Matriz de Roles & Add New */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => fetchUsuarios()}
            disabled={isLoading}
            title="Refrescar catálogo"
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-[#003D9B]" : ""}`} />
          </button>

          <button
            onClick={() => setIsMatrixModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-[#003D9B] bg-blue-50/80 hover:bg-blue-100 border border-blue-200/60 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Matriz de Roles</span>
          </button>

          <button
            onClick={() => setIsUserModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Buscador reactivo */}
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre o correo institucional..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Rol */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 font-mono">
              Rol:
            </label>
            <select
              value={selectedRol}
              onChange={(e) => {
                setSelectedRol(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 max-w-[200px] truncate focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors cursor-pointer"
            >
              <option value="">Todos los Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
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
              value={selectedEstado}
              onChange={(e) => {
                setSelectedEstado(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 max-w-[200px] truncate focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] transition-colors cursor-pointer"
            >
              <option value="">Todos los Estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono select-none">
              <tr>
                <th className="py-3 px-4 sm:px-6">Colaborador / Cuenta</th>
                <th className="py-3 px-4 sm:px-6">Rol Institucional</th>
                <th className="py-3 px-4 sm:px-6 text-center">Estado</th>
                <th className="py-3 px-4 sm:px-6">Último Acceso</th>
                <th className="py-3 px-4 sm:px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500">
                    <Loader2 className="w-7 h-7 animate-spin text-[#003D9B] mx-auto mb-3" />
                    <p className="text-xs font-medium">Consultando directorio de usuarios...</p>
                  </td>
                </tr>
              ) : usuarios.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <p className="text-sm font-semibold text-slate-800 mb-1">
                      No se encontraron usuarios
                    </p>
                    <p className="text-xs text-slate-500">
                      No existen colaboradores registrados que coincidan con los filtros aplicados.
                    </p>
                  </td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Usuario */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#002D62] text-white flex items-center justify-center font-display font-bold text-xs uppercase shadow-2xs shrink-0">
                          {u.nombre.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-display font-bold text-sm text-slate-900 block truncate">
                            {u.nombre}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono block truncate">
                            {u.correo}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Rol */}
                    <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide bg-blue-50 text-[#003D9B] border border-blue-200/60 font-mono">
                        {u.rol?.nombre || "Sin Rol"}
                      </span>
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                      {u.estado === "ACTIVO" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      ) : u.estado === "BLOQUEADO" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Inactivo
                        </span>
                      )}
                    </td>

                    {/* Ultimo Acceso */}
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {formatDate(u.ultimoLoginAt)}
                    </td>

                    {/* Acciones */}
                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleUnlock(u.id, u.nombre)}
                        disabled={unlockingId === u.id}
                        title="Desbloquear intentos de acceso o bloqueo temporal"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#003D9B] bg-blue-50/80 hover:bg-blue-100 border border-blue-200/60 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
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
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <p className="text-xs text-slate-500">
            Mostrando <strong className="text-slate-800 font-semibold">{startRecord}</strong> a{" "}
            <strong className="text-slate-800 font-semibold">{endRecord}</strong> de{" "}
            <strong className="text-slate-800 font-semibold">{totalCount}</strong> colaboradores registrados
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <span className="text-xs text-slate-500 px-2 font-mono">
              Página {page} de {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
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
