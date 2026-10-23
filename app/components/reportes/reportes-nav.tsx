"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, TrendingDown } from "lucide-react";

export interface ReportTab {
  id: string;
  name: string;
  href: string;
  icon: typeof FileSpreadsheet;
  description: string;
}

const TABS: ReportTab[] = [
  {
    id: "inventario",
    name: "Inventario de Activos",
    href: "/reportes",
    icon: FileSpreadsheet,
    description: "Consultas multicriterio y KPIs del parque institucional",
  },
  {
    id: "depreciacion",
    name: "Depreciación Fiscal",
    href: "/reportes/depreciacion",
    icon: TrendingDown,
    description: "Cuotas del período, acumulados y valor en libros",
  },
];

export function ReportesNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200/90 w-full overflow-x-auto no-print">
      <nav className="flex gap-2 sm:gap-6 min-w-max" aria-label="Reportes">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.href === "/reportes" ? pathname === "/reportes" : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={
                "flex items-center gap-2.5 pb-3 px-2 sm:px-3 border-b-2 text-sm font-semibold transition-all whitespace-nowrap -mb-px " +
                (isActive
                  ? "border-[#003D9B] text-[#003D9B]"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300")
              }
              title={tab.description}
            >
              <span
                className={
                  "p-1 rounded-md transition-colors " +
                  (isActive ? "bg-[#003D9B]/10 text-[#003D9B]" : "text-slate-400")
                }
                aria-hidden="true"
              >
                <Icon className="w-4 h-4" />
              </span>
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
