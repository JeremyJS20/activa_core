"use client";

import { useState, useEffect } from "react";
import { X, UserPlus, Eye, EyeOff, Loader2 } from "lucide-react";
import { UserCreateSchema } from "@/lib/validations/users";

interface RoleOption {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

interface UserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

export function UserDialog({ isOpen, onClose, onUserCreated }: UserDialogProps) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rolId, setRolId] = useState("");
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">("ACTIVO");

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset form state
    setNombre("");
    setCorreo("");
    setPassword("");
    setShowPassword(false);
    setEstado("ACTIVO");
    setErrorMessage(null);

    let isMounted = true;
    setIsLoadingRoles(true);

    fetch("/api/roles")
      .then(async (res) => {
        if (!res.ok) throw new Error("No fue posible cargar el catálogo de roles.");
        return res.json();
      })
      .then((data: any[]) => {
        if (isMounted) {
          const mapped = data.map((r) => ({
            id: r.id,
            codigo: r.codigo,
            nombre: r.nombre,
            descripcion: r.descripcion,
          }));
          setRoles(mapped);
          if (mapped.length > 0) {
            const defaultRole = mapped.find((r) => r.codigo === "OPERADOR") || mapped[0];
            setRolId(defaultRole.id);
          }
          setIsLoadingRoles(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMessage(err.message || "Error al cargar catálogo de roles.");
          setIsLoadingRoles(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = UserCreateSchema.safeParse({
      nombre,
      correo,
      password,
      rolId,
      estado,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || "Datos del usuario inválidos.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMessage(data?.message || "Ocurrió un error al registrar el usuario.");
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onUserCreated();
      onClose();
    } catch {
      setErrorMessage("No fue posible conectar con el servidor institucional.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#002D62] text-white flex items-center justify-center shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                Registrar Nuevo Usuario
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Creación de cuenta institucional con rol relacional en UNAPEC.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200 leading-snug"
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="nombre"
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1.5 font-mono"
            >
              Nombre Completo
            </label>
            <input
              id="nombre"
              type="text"
              required
              disabled={isSubmitting}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej. Lic. Pedro Martínez"
              className="w-full px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="correo"
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1.5 font-mono"
            >
              Correo Institucional
            </label>
            <input
              id="correo"
              type="email"
              required
              disabled={isSubmitting}
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="pmartinez@unapec.edu.do"
              className="w-full px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1.5 font-mono"
            >
              Contraseña Inicial
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                disabled={isSubmitting}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres, mayús, núm, símbolo"
                className="w-full px-3.5 py-2 pr-10 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all disabled:opacity-50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar clave" : "Ver clave"}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Debe cumplir: 8+ car., mayúscula, minúscula, número y símbolo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="rolId"
                className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1.5 font-mono"
              >
                Rol Asignado (RBAC)
              </label>
              <select
                id="rolId"
                required
                disabled={isSubmitting || isLoadingRoles}
                value={rolId}
                onChange={(e) => setRolId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all disabled:opacity-50 cursor-pointer"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} ({r.codigo})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="estado"
                className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1.5 font-mono"
              >
                Estado Inicial
              </label>
              <select
                id="estado"
                required
                disabled={isSubmitting}
                value={estado}
                onChange={(e) => setEstado(e.target.value as "ACTIVO" | "INACTIVO")}
                className="w-full px-3.5 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all disabled:opacity-50 cursor-pointer"
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingRoles}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Crear Usuario</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
