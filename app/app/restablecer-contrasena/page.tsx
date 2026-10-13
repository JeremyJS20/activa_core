import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Restablecer Contraseña | ActivaCore UNAPEC",
  description: "Defina una nueva contraseña para su cuenta institucional.",
};

export default function RestablecerContrasenaPage() {
  return (
    <AuthShell
      title="Defina su nueva contraseña institucional."
      subtitle="Ingrese una clave segura que cumpla con los lineamientos de longitud y complejidad requeridos por UNAPEC."
    >
      <Suspense fallback={<div className="text-xs text-slate-400 p-8">Cargando formulario...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
