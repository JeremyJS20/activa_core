import { ReactNode } from "react";
import { ConsoleShell } from "@/components/layout/console-shell";
import { CatalogNav } from "@/components/catalogos/catalog-nav";
import { FolderTree } from "lucide-react";

export default function CatalogosLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleShell>
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Unificado de Catálogos Base */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#003D9B] uppercase tracking-wider font-mono mb-1">
                <FolderTree className="w-4 h-4" />
                <span>Gestión de Maestros Organizacionales</span>
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
                Catálogos Base
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Estructura orgánica, clasificación fiscal DGII y directorio de custodios institucionales para activos fijos.
              </p>
            </div>

            {/* Pestañas de Navegación Fijas y Estables */}
            <CatalogNav />
          </div>

          {/* Vista del Catálogo Activo */}
          <div>{children}</div>
        </div>
      </div>
    </ConsoleShell>
  );
}
