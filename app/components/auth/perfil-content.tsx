import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { ShieldCheck, KeyRound } from "lucide-react";

export async function PerfilContent() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/perfil");
  }

  const user = session.user;
  const initials = user.nombre
    ? user.nombre
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AC";

  const roleName = user.rol?.nombre || "Colaborador Institucional";

  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Cabecera */}
        <div>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
            Perfil & Seguridad Institucional
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Consulte su asignación de rol relacional y gestione sus credenciales de acceso a ActivaCore.
          </p>
        </div>

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: User Card & Role Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
              {/* User Identity (Sin status pills decorativos) */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center font-display font-extrabold text-xl tracking-wider shadow-xs">
                  {initials}
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg text-[#1B2A4A] leading-tight">
                    {user.nombre}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{user.correo}</p>
                  <p className="text-xs text-slate-600 mt-1.5 font-medium">
                    {roleName} · Cuenta institucional activa
                  </p>
                </div>
              </div>

              {/* Metadata Details */}
              <div className="border-t border-slate-100 pt-5 space-y-3 text-xs text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-mono">Institución:</span>
                  <span className="font-medium text-[#1B2A4A]">Universidad APEC</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-mono">Perfil Asignado:</span>
                  <span className="font-medium text-[#1B2A4A]">{roleName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400 font-mono">Autenticación:</span>
                  <span className="font-medium text-[#1B2A4A]">JWT Session (NextAuth)</span>
                </div>
              </div>

              {/* Permissions List */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1B2A4A] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#003D9B]" />
                    Capacidades del Rol ({user.permisos?.length || 0})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {user.permisos && user.permisos.length > 0 ? (
                    user.permisos.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-medium"
                      >
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">Sin permisos adicionales asignados.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Change Password Card */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <div className="w-10 h-10 rounded-xl bg-[#EBF3FC] text-[#003D9B] flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg text-[#1B2A4A]">
                    Actualizar Contraseña
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Reemplace su clave de acceso para garantizar la seguridad de su cuenta
                  </p>
                </div>
              </div>

              <ChangePasswordForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
