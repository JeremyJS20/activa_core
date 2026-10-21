"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface RouteInfo {
  section?: string;
  page: string;
}

const ROUTE_MAP: Record<string, RouteInfo> = {
  "/": { page: "Tablero" },
  "/admin/usuarios": { section: "Seguridad & Control", page: "Usuarios" },
  "/perfil": { section: "Mi Cuenta", page: "Perfil & Seguridad" },
  "/catalogos": { section: "Gestión de Activos", page: "Catálogos Base" },
  "/catalogos/departamentos": { section: "Catálogos Base", page: "Departamentos" },
  "/catalogos/tipos-activos": { section: "Catálogos Base", page: "Tipos de Activos" },
  "/catalogos/empleados": { section: "Catálogos Base", page: "Empleados Custodios" },
  "/activos": { section: "Gestión de Activos", page: "Activos Fijos" },
  "/depreciacion": { section: "Gestión de Activos", page: "Depreciación" },
  "/reportes": { section: "Gestión de Activos", page: "Reportes DGII" },
  "/reportes/depreciacion": { section: "Reportes DGII", page: "Depreciación Fiscal" },
};

export function ConsoleBreadcrumb() {
  const pathname = usePathname();
  const route = ROUTE_MAP[pathname] || {
    page: pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Inicio",
  };

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono">
      <Link
        href="/"
        className="font-medium text-slate-400 hover:text-[#003D9B] transition-colors"
      >
        ActivaCore
      </Link>

      {route.section && (
        <>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">{route.section}</span>
        </>
      )}

      <span className="text-slate-300">/</span>
      <span className="font-semibold text-[#1B2A4A]">{route.page}</span>
    </nav>
  );
}
