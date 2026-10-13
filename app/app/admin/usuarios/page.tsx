import type { Metadata } from "next";
import { Users, ShieldAlert } from "lucide-react";
import { UserTable } from "@/components/auth/user-table";

export const metadata: Metadata = {
  title: "Directorio de Usuarios | ActivaCore UNAPEC",
  description: "Administración institucional de usuarios, asignación de roles RBAC y desbloqueo de credenciales.",
};

export default function AdminUsuariosPage() {
  return (
    <div className="min-h-screen bg-[#F9F9FF] text-[#1B2A4A] p-6 sm:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Cabecera de Página & Breadcrumbs */}
        <div className="space-y-2">
          <nav className="flex items-center gap-2 text-xs text-[#505F76] font-mono">
            <span>ActivaCore</span>
            <span>/</span>
            <span>Seguridad & Control</span>
            <span>/</span>
            <span className="text-[#003D9B] font-semibold">Usuarios</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl lg:text-4xl text-[#1B2A4A] tracking-tight">
                Directorio de Usuarios & RBAC
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Control de identidades docentes y administrativas, auditoría de roles y desbloqueo de accesos.
              </p>
            </div>

            {/* Institutional Badge */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs self-start sm:self-auto">
              <Users className="w-4 h-4 text-[#003D9B]" />
              <span className="text-xs font-semibold text-[#1B2A4A]">
                UNAPEC · Seguridad Institucional
              </span>
            </div>
          </div>
        </div>

        {/* Tabla & Operaciones */}
        <UserTable />
      </div>
    </div>
  );
}