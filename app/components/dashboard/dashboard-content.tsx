import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Users,
  Building2,
  Lock,
  ArrowRight,
  FolderTree,
} from "lucide-react";

export async function DashboardContent() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;
  const isAdmin = user.rol?.codigo === "ADMIN" || user.permisos?.includes("USER_ADMIN");

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Banner de Bienvenida Institucional (Limpio, sin badges decorativos de IA) */}
        <div className="bg-[#0F172A] text-white rounded-2xl p-8 sm:p-10 relative overflow-hidden shadow-sm">
          <div className="relative z-10 max-w-2xl space-y-2">
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              Bienvenido, {user.nombre}
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Sistema para la administración de activos fijos, control de inventario, cálculo de depreciaciones y cumplimiento normativo DGII de la Universidad APEC.
            </p>
          </div>
          <div className="absolute right-6 -bottom-8 opacity-10 text-white font-display font-black text-[140px] select-none pointer-events-none">
            AC
          </div>
        </div>

        {/* Resumen Operativo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Rol Asignado
            </span>
            <p className="font-display font-bold text-lg text-[#1B2A4A] truncate">
              {user.rol?.nombre || "Colaborador"}
            </p>
            <p className="text-xs text-slate-400 font-mono">Código: {user.rol?.codigo || "OPERADOR"}</p>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Permisos RBAC
            </span>
            <p className="font-display font-extrabold text-2xl text-[#003D9B]">
              {user.permisos?.length || 0}
            </p>
            <p className="text-xs text-slate-500">Capacidades de acceso activas</p>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Cuenta Institucional
            </span>
            <p className="font-display font-bold text-sm text-[#1B2A4A] truncate mt-1">
              {user.correo}
            </p>
            <p className="text-xs text-slate-400">Sesión iniciada</p>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Organización
            </span>
            <p className="font-display font-bold text-lg text-[#1B2A4A] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#003D9B]" />
              Universidad APEC
            </p>
            <p className="text-xs text-slate-400">Finanzas & Contabilidad</p>
          </div>
        </div>

        {/* Módulos del Sistema */}
        <div className="space-y-4">
          <h2 className="font-display font-bold text-base text-[#1B2A4A] tracking-tight">
            Módulos del Sistema
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {isAdmin && (
              <Link
                href="/admin/usuarios"
                className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs hover:border-[#003D9B]/50 transition-all group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EBF3FC] text-[#003D9B] flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-[#1B2A4A] group-hover:text-[#003D9B] transition-colors">
                      Directorio de Usuarios & RBAC
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Gestión de colaboradores, asignación de roles relacionales y desbloqueo de cuentas.
                    </p>
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#003D9B]">
                  <span>Acceder al directorio</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            )}

            <Link
              href="/perfil"
              className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs hover:border-[#003D9B]/50 transition-all group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-[#EBF3FC] text-[#003D9B] flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-[#1B2A4A] group-hover:text-[#003D9B] transition-colors">
                    Mi Perfil & Seguridad
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Actualización de contraseña institucional y verificación de privilegios asignados.
                  </p>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#003D9B]">
                <span>Configurar cuenta</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <div className="bg-white/60 rounded-xl p-6 border border-slate-200/80 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-700">
                    Gestión de Activos
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Catálogos de activos, tipos de bienes, departamentos y ubicaciones institucionales.
                  </p>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 text-xs font-medium text-slate-400">
                <span>Sub-módulo 01 en proceso</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
