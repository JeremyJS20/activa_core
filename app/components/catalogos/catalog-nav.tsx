"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Tag, Users } from "lucide-react";

export interface CatalogTab {
  id: string;
  name: string;
  href: string;
  icon: typeof Building2;
  description: string;
}

const TABS: CatalogTab[] = [
  {
    id: "departamentos",
    name: "Departamentos",
    href: "/catalogos/departamentos",
    icon: Building2,
    description: "Estructura organizacional y directores de área",
  },
  {
    id: "tipos-activos",
    name: "Tipos de Activos",
    href: "/catalogos/tipos-activos",
    icon: Tag,
    description: "Categorías DGII, cuentas contables y vidas útiles",
  },
  {
    id: "empleados",
    name: "Empleados Custodios",
    href: "/catalogos/empleados",
    icon: Users,
    description: "Directorio de colaboradores y responsables de bienes",
  },
];

export function CatalogNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200/80 bg-white">
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto py-2.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-[#003D9B]/10 text-[#003D9B] font-semibold shadow-xs ring-1 ring-[#003D9B]/20"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div
                  className={`p-1.5 rounded-md transition-colors ${
                    isActive ? "bg-[#003D9B] text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <span className="block leading-tight text-xs font-semibold sm:text-sm">
                    {tab.name}
                  </span>
                  <span className="hidden md:block text-[11px] font-normal text-slate-400 leading-tight mt-0.5">
                    {tab.description}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
