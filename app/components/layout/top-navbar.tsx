import Link from "next/link";
import { auth } from "@/auth";
import { UserNavMenu } from "@/components/auth/user-nav-menu";
import { ConsoleBreadcrumb } from "./console-breadcrumb";

export async function TopNavbar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="no-print h-16 w-full bg-white border-b border-slate-200/80 sticky top-0 z-20 px-6 sm:px-8 flex items-center justify-between shadow-xs">
      {/* Rutas Breadcrumb a la izquierda */}
      <ConsoleBreadcrumb />

      {/* Al fondo: Dropdown del Usuario */}
      <div className="flex items-center gap-4">
        {user ? (
          <UserNavMenu
            user={{
              id: user.id,
              nombre: user.nombre || user.name || "Usuario",
              correo: user.correo || user.email || "",
              rol: user.rol,
            }}
          />
        ) : (
          <Link
            href="/login"
            className="h-9 px-4 text-xs font-semibold uppercase tracking-wider text-white rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center bg-[#003D9B] hover:bg-[#002D72]"
          >
            Iniciar Sesión
          </Link>
        )}
      </div>
    </header>
  );
}
