import type { Metadata } from "next";
import { ConsoleShell } from "@/components/layout/console-shell";
import { UserTable } from "@/components/auth/user-table";

export const metadata: Metadata = {
  title: "Directorio de Usuarios | ActivaCore UNAPEC",
  description: "Administración institucional de usuarios, asignación de roles RBAC y desbloqueo de credenciales.",
};

export default function AdminUsuariosPage() {
  return (
    <ConsoleShell>
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Cabecera de Página (Limpia, sin badges falsos de IA) */}
          <div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
              Directorio de Usuarios & RBAC
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Control de identidades docentes y administrativas, auditoría de roles y desbloqueo de accesos.
            </p>
          </div>

          {/* Tabla & Operaciones */}
          <UserTable />
        </div>
      </div>
    </ConsoleShell>
  );
}
