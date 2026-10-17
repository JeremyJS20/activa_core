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
            // Default to OPERADOR if available, otherwise first role
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EBF3FC] text-[#003D9B] flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
                Registrar Nuevo Usuario
              </h2>
              <p className="text-xs text-[#505F76]">
                Creación de cuenta con rol relacional en UNAPEC
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl text-xs font-medium bg-[#FFDAD6] text-[#93000A] leading-snug"
            >
              {errorMessage}
            </div>
          )}

          <div>
            <label
              htmlFor="nombre"
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-1.5"
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
              className="w-full h-11 px-4 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all placeholder:text-[#505F76]/40 focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="correo"
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-1.5"
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
              className="w-full h-11 px-4 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all placeholder:text-[#505F76]/40 focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-1.5"
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
                className="w-full h-11 pl-4 pr-11 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all placeholder:text-[#505F76]/40 focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar clave" : "Ver clave"}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#505F76] hover:text-[#1B2A4A] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-[#505F76] mt-1">
              Debe cumplir: 8+ car., mayúscula, minúscula, número y símbolo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="rolId"
                className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-1.5"
              >
                Rol Asignado (RBAC)
              </label>
              <select
                id="rolId"
                required
                disabled={isSubmitting || isLoadingRoles}
                value={rolId}
                onChange={(e) => setRolId(e.target.value)}
                className="w-full h-11 px-3 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50 cursor-pointer"
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
                className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-1.5"
              >
                Estado Inicial
              </label>
              <select
                id="estado"
                required
                disabled={isSubmitting}
                value={estado}
                onChange={(e) => setEstado(e.target.value as "ACTIVO" | "INACTIVO")}
                className="w-full h-11 px-3 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50 cursor-pointer"
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
              className="px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-[#505F76] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingRoles}
              className="h-11 px-6 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              style={{ background: "linear-gradient(135deg, #003D9B 0%, #0052CC 100%)" }}
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