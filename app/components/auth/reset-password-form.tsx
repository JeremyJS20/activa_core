"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import { ResetPasswordSchema } from "@/lib/validations/auth";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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

    if (!token) {
      setErrorMessage("No se proporcionó un token de recuperación válido. Solicite un nuevo enlace.");
      return;
    }

    const validation = ResetPasswordSchema.safeParse({
      token,
      nuevaPassword,
      confirmarPassword,
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || "La contraseña no satisface los requisitos de seguridad.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          nuevaPassword,
          confirmarPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMessage(data?.message || "El token es inválido o ha expirado.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setIsLoading(false);
    } catch {
      setErrorMessage("No fue posible conectar con el servidor para restablecer la contraseña.");
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-[450px] mx-auto text-left">
        <div className="mb-6 p-4 rounded-xl text-sm font-medium bg-[#FFDAD6] text-[#93000A] leading-snug">
          Enlace de recuperación incompleto o inválido. No se detectó el token de seguridad en la dirección web.
        </div>
        <Link
          href="/recuperar-contrasena"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003D9B] hover:text-[#0052CC] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Solicitar un nuevo enlace
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-[450px] mx-auto text-left">
        <div className="w-12 h-12 rounded-2xl bg-[#DCFCE7] text-[#166534] flex items-center justify-center mb-6">
          <CheckCircle2 className="w-6 h-6 text-[#166534]" />
        </div>

        <h2 className="font-display font-bold text-2xl text-[#1B2A4A] tracking-tight">
          Contraseña Actualizada
        </h2>
        <p className="text-[#505F76] text-sm mt-3 leading-relaxed">
          Su clave institucional ha sido restablecida exitosamente en la base de datos de UNAPEC. Ya puede iniciar sesión con sus nuevas credenciales.
        </p>

        <Link
          href="/login"
          className="w-full h-12 mt-8 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #003D9B 0%, #0052CC 100%)" }}
        >
          Iniciar Sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[450px] mx-auto text-left">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
          Nueva Contraseña
        </h1>
        <p className="text-[#505F76] text-sm mt-2 leading-relaxed">
          Defina una contraseña robusta para proteger el acceso al sistema de activos y registros contables.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl text-sm font-medium bg-[#FFDAD6] text-[#93000A] leading-snug"
        >
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="nuevaPassword"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-2"
          >
            Nueva Contraseña
          </label>
          <div className="relative">
            <input
              id="nuevaPassword"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              disabled={isLoading}
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-12 pl-4 pr-12 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all placeholder:text-[#505F76]/40 focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#505F76] hover:text-[#1B2A4A] transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

        <div>
          <label
            htmlFor="confirmarPassword"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-2"
          >
            Confirmar Nueva Contraseña
          </label>
          <div className="relative">
            <input
              id="confirmarPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              disabled={isLoading}
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-12 pl-4 pr-12 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all placeholder:text-[#505F76]/40 focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Ocultar confirmación" : "Ver confirmación"}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#505F76] hover:text-[#1B2A4A] transition-colors cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmarPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs text-[#93000A] mt-1.5 font-medium">Las contraseñas no coinciden.</p>
          )}
        </div>

        {/* Lista de Requisitos */}
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

        <button
          type="submit"
          disabled={isLoading || strengthScore < 5 || !passwordsMatch}
          className="w-full h-12 mt-3 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          style={{ background: "linear-gradient(135deg, #003D9B 0%, #0052CC 100%)" }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Restableciendo clave...</span>
            </>
          ) : (
            <span>Restablecer Contraseña</span>
          )}
        </button>
      </form>
    </div>
  );
}