"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Tag, Users } from "lucide-react";

export interface CatalogTab {
  id: string;
  name: string;
  href: string;
  icon: typeof Building2;
}

const TABS: CatalogTab[] = [
  {
    id: "departamentos",
    name: "Departamentos",
    href: "/catalogos/departamentos",
    icon: Building2,
  },
  {
    id: "tipos-activos",
    name: "Tipos de Activos",
    href: "/catalogos/tipos-activos",
    icon: Tag,
  },
  {
    id: "empleados",
    name: "Empleados Custodios",
    href: "/catalogos/empleados",
    icon: Users,
  },
];

export function CatalogNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200/90 w-full overflow-x-auto">
      <nav className="flex gap-2 sm:gap-6 min-w-max" aria-label="Cat?logos">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={
                "flex items-center gap-2.5 pb-3 px-2 sm:px-3 border-b-2 text-sm font-semibold transition-all whitespace-nowrap -mb-px " +
                (isActive
                  ? "border-[#003D9B] text-[#003D9B]"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300")
              }
            >
              <div
                className={
                  "p-1 rounded-md transition-colors " +
                  (isActive ? "bg-[#003D9B]/10 text-[#003D9B]" : "text-slate-400")
                }
              >
                <Icon className="w-4 h-4" />
              </div>
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
