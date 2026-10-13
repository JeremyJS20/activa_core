"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { ForgotPasswordSchema } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const [correo, setCorreo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = ForgotPasswordSchema.safeParse({ correo });
    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message || "Ingrese un correo institucional válido.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: validation.data.correo }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErrorMessage(data?.message || "Ocurrió un error al procesar la solicitud.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setIsLoading(false);
    } catch {
      setErrorMessage("No fue posible conectar con el servidor institucional.");
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-[450px] mx-auto text-left">
        <div className="w-12 h-12 rounded-2xl bg-[#DCFCE7] text-[#166534] flex items-center justify-center mb-6">
          <CheckCircle2 className="w-6 h-6 text-[#166534]" />
        </div>

        <h2 className="font-display font-bold text-2xl text-[#1B2A4A] tracking-tight">
          Solicitud Procesada
        </h2>
        <p className="text-[#505F76] text-sm mt-3 leading-relaxed">
          Si el correo <strong className="text-[#1B2A4A]">{correo}</strong> corresponde a una cuenta activa de UNAPEC, hemos emitido un enlace de un solo uso para restablecer su contraseña.
        </p>

        <div className="my-6 p-4 rounded-xl bg-[#F2F3FF] text-xs text-[#505F76] leading-relaxed">
          <p className="font-semibold text-[#1B2A4A] mb-1">Validez de Seguridad:</p>
          El enlace expirará automáticamente en <strong>15 minutos</strong>. Si no lo encuentra en su bandeja de entrada, revise la carpeta de spam o correo no deseado.
        </div>

        <Link
          href="/login"
          className="w-full h-12 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #003D9B 0%, #0052CC 100%)" }}
        >
          Volver al Inicio de Sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[450px] mx-auto text-left">
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#003D9B] hover:text-[#0052CC] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio de sesión
      </Link>

      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
          Recuperar Contraseña
        </h1>
        <p className="text-[#505F76] text-sm mt-2 leading-relaxed">
          Ingrese el correo institucional asociado a su cuenta. Le enviaremos un enlace seguro para restablecer su acceso.
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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 mt-3 text-white font-semibold text-xs tracking-wider uppercase rounded-xl shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
          style={{ background: "linear-gradient(135deg, #003D9B 0%, #0052CC 100%)" }}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Enviando enlace...</span>
            </>
          ) : (
            <span>Enviar Enlace de Recuperación</span>
          )}
        </button>
      </form>
    </div>
  );
}