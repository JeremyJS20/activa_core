import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Acceso Institucional | ActivaCore UNAPEC",
  description: "Sistema Institucional de Gestión y Trazabilidad de Activos Fijos — Universidad APEC.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F9F9FF]">
      {/* Panel Izquierdo: Institucional (Azul Marino Profundo) */}
      <div className="w-full lg:w-[50%] xl:w-[52%] bg-[#0F172A] text-white flex flex-col justify-between p-8 sm:p-12 lg:p-16 relative">
        {/* Monograma / Cabecera */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-display font-extrabold text-lg tracking-wider text-white">
            AC
          </div>
          <div>
            <span className="font-display font-bold text-lg tracking-tight block leading-tight text-white">
              ActivaCore
            </span>
            <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase block">
              UNAPEC · Activos Fijos
            </span>
          </div>
        </div>

        {/* Declaración de Misión Central */}
        <div className="my-12 lg:my-0 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0052CC] mb-4">
            Gestión Institucional
          </p>
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-[1.15]">
            Control de activos fijos y su contabilización.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base mt-4 leading-relaxed font-sans">
            Plataforma integral para el inventario, ciclo de vida, depreciación y cumplimiento normativo DGII de la Universidad APEC.
          </p>
        </div>

        {/* Metadatos Académicos de Pie */}
        <div className="text-xs text-slate-400 font-mono space-y-1">
          <p>UNAPEC · Asignatura: Integraciones I</p>
          <p className="text-slate-400">Prof. Juan P. Valdez · República Dominicana</p>
        </div>
      </div>

      {/* Panel Derecho: Formulario de Acceso */}
      <div className="w-full lg:w-[50%] xl:w-[48%] flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <Suspense
          fallback={
            <div className="w-full max-w-[420px] p-8 flex flex-col items-center justify-center text-[#505F76]">
              <Loader2 className="w-8 h-8 animate-spin text-[#003D9B] mb-3" />
              <p className="text-sm font-medium">Cargando acceso institucional...</p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}