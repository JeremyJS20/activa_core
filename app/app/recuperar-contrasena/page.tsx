import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperación de Contraseña | ActivaCore UNAPEC",
  description: "Solicite un enlace institucional para restablecer sus credenciales de acceso.",
};

export default function RecuperarContrasenaPage() {
  return (
    <AuthShell
      title="Recupere el acceso a su cuenta institucional."
      subtitle="Ingrese su correo electrónico registrado y le enviaremos un enlace seguro para restablecer su clave."
    >
      <Suspense fallback={<div className="text-xs text-slate-400 p-8">Cargando formulario...</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
