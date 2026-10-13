import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Acceso Institucional | ActivaCore UNAPEC",
  description: "Sistema Institucional de Gestión y Trazabilidad de Activos Fijos — Universidad APEC.",
};

export default function LoginPage() {
  return (
    <AuthShell
      badge="Gestión Institucional"
      title="Control de activos fijos y su contabilización."
      subtitle="Plataforma integral para el inventario, ciclo de vida, depreciación y cumplimiento normativo DGII de la Universidad APEC."
    >
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
    </AuthShell>
  );
}