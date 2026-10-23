"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderTree,
  Layers,
  Calculator,
  FileSpreadsheet,
  Users,
  UserCircle,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: "PRINCIPAL",
    items: [
      { name: "Tablero", href: "/", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: "GESTIÓN DE ACTIVOS",
    items: [
      { name: "Catálogos Base", href: "/catalogos", icon: FolderTree },
      { name: "Inventario de Activos", href: "/activos", icon: Layers },
      { name: "Depreciación", href: "/depreciacion", icon: Calculator },
      { name: "Reportes DGII", href: "/reportes", icon: FileSpreadsheet },
    ],
  },
  {
    title: "SEGURIDAD & CONTROL",
    items: [
      { name: "Usuarios & RBAC", href: "/admin/usuarios", icon: Users },
      { name: "Mi Perfil & Seguridad", href: "/perfil", icon: UserCircle },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="no-print w-64 bg-[#0F172A] text-slate-300 flex-shrink-0 flex flex-col justify-between border-r border-slate-800/80 min-h-screen sticky top-0 z-30 select-none hidden md:flex">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 flex items-center border-b border-slate-800/60">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-[#003D9B] text-white flex items-center justify-center font-display font-black text-sm tracking-wider shadow-sm group-hover:bg-[#0052CC] transition-colors">
              AC
            </div>
            <div>
              <span className="font-display font-extrabold text-base text-white tracking-tight block leading-none">
                ActivaCore
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block leading-none mt-1">
                UNAPEC · Activos Fijos
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Sections */}
        <nav className="p-4 space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <span className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-widest block font-mono">
                {section.title}
              </span>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[#003D9B] text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Institutional Minimal Footer */}
      <div className="p-4 border-t border-slate-800/60">
        <p className="text-[11px] font-semibold text-slate-400">Universidad APEC</p>
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Gestión de Activos Fijos</p>
      </div>
    </aside>
  );
}
