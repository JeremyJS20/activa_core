import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Restablecer Contraseña | ActivaCore UNAPEC",
  description: "Restablecimiento seguro de contraseña para usuarios de ActivaCore — Universidad APEC.",
};

export default function RestablecerContrasenaPage() {
  return (
    <AuthShell
      badge="Seguridad Institucional"
      title="Actualización de clave institucional."
      subtitle="Defina su nueva contraseña respetando los estándares de complejidad y robustez para la custodia de activos de UNAPEC."
    >
      <Suspense
        fallback={
          <div className="w-full max-w-[450px] p-8 flex flex-col items-center justify-center text-[#505F76]">
            <Loader2 className="w-8 h-8 animate-spin text-[#003D9B] mb-3" />
            <p className="text-sm font-medium">Validando token de seguridad...</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}