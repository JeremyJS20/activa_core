import { ReactNode } from "react";
import { ConsoleShell } from "@/components/layout/console-shell";
import { ReportesNav } from "@/components/reportes/reportes-nav";
import { BarChart3 } from "lucide-react";

export default function ReportesLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleShell>
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header unificado de la consola de reportes (No-Line rule) */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#003D9B] uppercase tracking-wider font-mono mb-1">
                <BarChart3 className="w-4 h-4" aria-hidden="true" />
                <span>Gestión de Activos · Consulta y Auditoría</span>
              </div>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#1B2A4A] tracking-tight">
                Reportes DGII
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Consultas multicriterio del inventario, depreciación fiscal por período y
                trazabilidad histórica de custodios con exportaciones auditadas.
              </p>
            </div>

            <ReportesNav />
          </div>

          <div>{children}</div>
        </div>
      </div>
    </ConsoleShell>
  );
}
