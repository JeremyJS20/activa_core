import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar Contraseña | ActivaCore UNAPEC",
  description: "Solicitud de recuperación de contraseña institucional — Universidad APEC.",
};

export default function RecuperarContrasenaPage() {
  return (
    <AuthShell
      badge="Seguridad Institucional"
      title="Restablecimiento y recuperación de acceso."
      subtitle="Verificación de identidad y emisión de credenciales temporales cifradas para el personal docente y administrativo de UNAPEC."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}