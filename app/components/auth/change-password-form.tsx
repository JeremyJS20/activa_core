"use client";

import { useState, useMemo } from "react";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
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
    if (strengthScore <= 2) return { text: "Débil", color: "bg-rose-50 text-rose-700 border border-rose-200", bar: "bg-rose-500" };
    if (strengthScore <= 4) return { text: "Media", color: "bg-amber-50 text-amber-700 border border-amber-200", bar: "bg-amber-500" };
    return { text: "Fuerte", color: "bg-emerald-50 text-emerald-700 border border-emerald-200", bar: "bg-emerald-500" };
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
    <div className="space-y-5">
      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2.5 animate-in fade-in shadow-2xs"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl text-sm font-medium bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2.5 animate-in fade-in shadow-2xs"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contraseña Actual */}
        <div>
          <label
            htmlFor="passwordActual"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1.5 font-mono"
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
              className="w-full h-10 px-3.5 pr-10 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowActual(!showActual)}
              tabIndex={-1}
              aria-label={showActual ? "Ocultar clave actual" : "Ver clave actual"}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Nueva Contraseña */}
        <div>
          <label
            htmlFor="nuevaPassword"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1.5 font-mono"
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
              className="w-full h-10 px-3.5 pr-10 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowNueva(!showNueva)}
              tabIndex={-1}
              aria-label={showNueva ? "Ocultar clave nueva" : "Ver clave nueva"}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Medidor Horizontal de Robustez */}
          {nuevaPassword.length > 0 && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 font-mono text-[11px]">Nivel de Seguridad:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold font-mono ${strengthLabel.color}`}>
                  {strengthLabel.text}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-1">
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
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 mb-1.5 font-mono"
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
              className="w-full h-10 px-3.5 pr-10 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003D9B]/30 focus:border-[#003D9B] focus:bg-white transition-all font-mono"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              tabIndex={-1}
              aria-label={showConfirm ? "Ocultar confirmación" : "Ver confirmación"}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmarPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-rose-600 mt-1.5 font-medium">Las contraseñas no coinciden.</p>
          )}
        </div>

        {/* Checklist Requisitos */}
        <div className="p-3.5 rounded-lg bg-slate-50/80 border border-slate-200/80 text-xs space-y-1.5 text-slate-600">
          <p className="font-semibold text-slate-800 mb-1 font-mono text-[11px] uppercase tracking-wider">
            Requisitos de Seguridad de Contraseña:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
            <span className={criteria.length ? "text-emerald-700 font-semibold" : "text-slate-500"}>
              • Mínimo 8 caracteres
            </span>
            <span className={criteria.uppercase ? "text-emerald-700 font-semibold" : "text-slate-500"}>
              • Al menos 1 mayúscula
            </span>
            <span className={criteria.lowercase ? "text-emerald-700 font-semibold" : "text-slate-500"}>
              • Al menos 1 minúscula
            </span>
            <span className={criteria.number ? "text-emerald-700 font-semibold" : "text-slate-500"}>
              • Al menos 1 número
            </span>
            <span className={criteria.special ? "text-emerald-700 font-semibold" : "text-slate-500"}>
              • Al menos 1 símbolo especial
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading || strengthScore < 5 || !passwordsMatch}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#003D9B] hover:bg-[#0052CC] active:bg-[#002D62] rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
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
        </div>
      </form>
    </div>
  );
}
