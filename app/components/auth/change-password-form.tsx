"use client";

import { useState, useMemo } from "react";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { ChangePasswordSchema } from "@/lib/validations/auth";

export function ChangePasswordForm() {
  const [passwordActual, setPasswordActual] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");

  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Verificación de requisitos individuales
  const criteria = useMemo(() => {
    return {
      length: nuevaPassword.length >= 8,
      uppercase: /[A-Z]/.test(nuevaPassword),
      lowercase: /[a-z]/.test(nuevaPassword),
      number: /[0-9]/.test(nuevaPassword),
      special: /[^A-Za-z0-9]/.test(nuevaPassword),
    };
  }, [nuevaPassword]);

  // Puntuación de 0 a 5
  const strengthScore = useMemo(() => {
    return Object.values(criteria).filter(Boolean).length;
  }, [criteria]);

  const strengthLabel = useMemo(() => {
    if (strengthScore <= 2) return { text: "Débil", color: "bg-[#FFDAD6] text-[#93000A]", bar: "bg-[#93000A]" };
    if (strengthScore <= 4) return { text: "Media", color: "bg-[#FEF3C7] text-[#92400E]", bar: "bg-[#D97706]" };
    return { text: "Fuerte", color: "bg-[#DCFCE7] text-[#166534]", bar: "bg-[#166534]" };
  }, [strengthScore]);

  const passwordsMatch = useMemo(() => {
    return confirmarPassword.length > 0 && nuevaPassword === confirmarPassword;
  }, [nuevaPassword, confirmarPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validation = ChangePasswordSchema.safeParse({
      passwordActual,
      nuevaPassword,
      confirmarPassword,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || "Datos de contraseña inválidos.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMessage(data?.message || "Ocurrió un error al actualizar la contraseña.");
        setIsLoading(false);
        return;
      }

      setSuccessMessage("Su contraseña institucional ha sido actualizada correctamente.");
      setPasswordActual("");
      setNuevaPassword("");
      setConfirmarPassword("");
      setIsLoading(false);
    } catch {
      setErrorMessage("No fue posible conectar con el servidor institucional.");
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EBF3FC] text-[#003D9B] flex items-center justify-center">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg text-[#1B2A4A] tracking-tight">
            Actualizar Contraseña
          </h2>
          <p className="text-xs text-[#505F76]">
            Reemplace su clave de acceso para garantizar la seguridad de su cuenta
          </p>
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-xl text-sm font-medium bg-[#DCFCE7] text-[#166534] flex items-center gap-2.5 animate-in fade-in"
        >
          <CheckCircle2 className="w-5 h-5 text-[#166534] shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl text-sm font-medium bg-[#FFDAD6] text-[#93000A] flex items-center gap-2.5 animate-in fade-in"
        >
          <AlertCircle className="w-5 h-5 text-[#93000A] shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Contraseña Actual */}
        <div>
          <label
            htmlFor="passwordActual"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-1.5"
          >
            Contraseña Actual
          </label>
          <div className="relative">
            <input
              id="passwordActual"
              type={showActual ? "text" : "password"}
              required
              disabled={isLoading}
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-11 pl-4 pr-11 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all placeholder:text-[#505F76]/40 focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowActual(!showActual)}
              tabIndex={-1}
              aria-label={showActual ? "Ocultar clave actual" : "Ver clave actual"}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#505F76] hover:text-[#1B2A4A] cursor-pointer"
            >
              {showActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Nueva Contraseña */}
        <div>
          <label
            htmlFor="nuevaPassword"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-1.5"
          >
            Nueva Contraseña
          </label>
          <div className="relative">
            <input
              id="nuevaPassword"
              type={showNueva ? "text" : "password"}
              required
              disabled={isLoading}
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-11 pl-4 pr-11 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all placeholder:text-[#505F76]/40 focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowNueva(!showNueva)}
              tabIndex={-1}
              aria-label={showNueva ? "Ocultar clave nueva" : "Ver clave nueva"}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#505F76] hover:text-[#1B2A4A] cursor-pointer"
            >
              {showNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Medidor Horizontal de Robustez */}
          {nuevaPassword.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#505F76]">Robustez:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${strengthLabel.color}`}>
                  {strengthLabel.text}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#F2F3FF] rounded-full overflow-hidden flex gap-1">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div
                    key={step}
                    className={`flex-1 h-full rounded-full transition-all duration-200 ${
                      step <= strengthScore ? strengthLabel.bar : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Confirmar Nueva Contraseña */}
        <div>
          <label
            htmlFor="confirmarPassword"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-1.5"
          >
            Confirmar Nueva Contraseña
          </label>
          <div className="relative">
            <input
              id="confirmarPassword"
              type={showConfirm ? "text" : "password"}
              required
              disabled={isLoading}
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-11 pl-4 pr-11 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all placeholder:text-[#505F76]/40 focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              tabIndex={-1}
              aria-label={showConfirm ? "Ocultar confirmación" : "Ver confirmación"}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#505F76] hover:text-[#1B2A4A] cursor-pointer"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmarPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-[#93000A] mt-1.5 font-medium">Las contraseñas no coinciden.</p>
          )}
        </div>

        {/* Checklist Requisitos */}
        <div className="p-4 rounded-xl bg-[#F2F3FF] text-xs space-y-1.5 text-[#505F76]">
          <p className="font-semibold text-[#1B2A4A] mb-1">Requisitos de Seguridad:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <span className={criteria.length ? "text-[#166534] font-medium" : ""}>
              • Mínimo 8 caracteres
            </span>
            <span className={criteria.uppercase ? "text-[#166534] font-medium" : ""}>
              • Al menos 1 mayúscula
            </span>
            <span className={criteria.lowercase ? "text-[#166534] font-medium" : ""}>
              • Al menos 1 minúscula
            </span>
            <span className={criteria.number ? "text-[#166534] font-medium" : ""}>
              • Al menos 1 número
            </span>
            <span className={criteria.special ? "text-[#166534] font-medium" : ""}>
              • Al menos 1 carácter especial
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || strengthScore < 5 || !passwordsMatch}
          className="h-11 px-6 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          style={{ background: "linear-gradient(135deg, #003D9B 0%, #0052CC 100%)" }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Actualizando clave...</span>
            </>
          ) : (
            <span>Guardar Nueva Contraseña</span>
          )}
        </button>
      </form>
    </div>
  );
}