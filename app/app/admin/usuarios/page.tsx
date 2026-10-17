import type { Metadata } from "next";
import { ConsoleShell } from "@/components/layout/console-shell";
import { UserTable } from "@/components/auth/user-table";
import { ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Directorio de Usuarios — ActivaCore UNAPEC",
  description: "Administración institucional de usuarios, asignación de roles RBAC y desbloqueo de credenciales.",
};

export default function AdminUsuariosPage() {
  return (
    <ConsoleShell>
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#003D9B] uppercase tracking-wider font-mono mb-1">
                <ShieldAlert className="w-4 h-4" />
                <span>Seguridad & Control de Acceso</span>
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
                Directorio de Usuarios & RBAC
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Control de identidades docentes y administrativas, auditoría de roles y desbloqueo de accesos.
              </p>
            </div>
          </div>

          <UserTable />
        </div>
      </div>
    </ConsoleShell>
  );
}
