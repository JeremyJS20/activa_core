import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { ConsoleShell } from "@/components/layout/console-shell";
import { PerfilContent } from "@/components/auth/perfil-content";

export const metadata: Metadata = {
  title: "Mi Perfil & Seguridad | ActivaCore UNAPEC",
  description: "Información de cuenta institucional, rol relacional y cambio de contraseña.",
};

export default function PerfilPage() {
  return (
    <ConsoleShell>
      <Suspense
        fallback={
          <div className="p-16 flex flex-col items-center justify-center text-[#505F76]">
            <Loader2 className="w-8 h-8 animate-spin text-[#003D9B] mb-3" />
            <p className="text-xs font-medium">Cargando perfil institucional...</p>
          </div>
        }
      >
        <PerfilContent />
      </Suspense>
    </ConsoleShell>
  );
}