"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { LoginSchema } from "@/lib/validations/auth";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = LoginSchema.safeParse({ correo, password });
    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || "Por favor complete todos los campos requeridos.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await signIn("credentials", {
        correo: validation.data.correo,
        password: validation.data.password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        if (res.error.includes("bloqueada") || res.error.includes("fuerza bruta")) {
          setErrorMessage(
            "Cuenta bloqueada temporalmente por 15 minutos debido a 5 intentos fallidos consecutivos."
          );
        } else if (res.error.includes("inactiva")) {
          setErrorMessage(
            "Su cuenta institucional se encuentra inactiva. Contacte al departamento de TI de UNAPEC."
          );
        } else {
          setErrorMessage("Correo institucional o contraseña incorrectos.");
        }
        setIsLoading(false);
      } else {
        window.location.href = callbackUrl;
      }
    } catch (err: any) {
      if (err?.message?.includes("NEXT_REDIRECT")) {
        window.location.href = callbackUrl;
        return;
      }
      setErrorMessage("No fue posible conectar con el servicio de autenticación.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto px-6 py-8 sm:px-0">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
          Acceder al Sistema
        </h1>
        <p className="text-[#505F76] text-sm mt-2 leading-relaxed">
          Ingrese sus credenciales institucionales para gestionar los activos y la contabilidad.
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
            htmlFor="correo"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-2"
          >
            Correo Institucional
          </label>
          <input
            id="correo"
            type="email"
            required
            autoComplete="email"
            disabled={isLoading}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="usuario@unapec.edu.do"
            className="w-full h-12 px-4 bg-[#F2F3FF] text-[#1B2A4A] text-sm rounded-xl outline-none transition-all placeholder:text-[#505F76]/40 focus:bg-white focus:ring-2 focus:ring-[#0052CC] disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#505F76] mb-2"
          >
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[#505F76]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#003D9B] focus:ring-[#0052CC]"
            />
            <span>Recordarme</span>
          </label>

          <Link
            href="/recuperar-contrasena"
            className="text-xs font-medium text-[#003D9B] hover:text-[#0052CC] transition-colors"
          >
            ¿Olvidó su contraseña?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 mt-3 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
          style={{ background: "linear-gradient(135deg, #003D9B 0%, #0052CC 100%)" }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Verificando...</span>
            </>
          ) : (
            <span>Iniciar Sesión</span>
          )}
        </button>
      </form>
    </div>
  );
}