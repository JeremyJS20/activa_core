import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { ConsoleShell } from "@/components/layout/console-shell";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const metadata: Metadata = {
  title: "Tablero Principal | ActivaCore UNAPEC",
  description: "Sistema Institucional de Gestión y Trazabilidad de Activos Fijos — Universidad APEC.",
};

export default function HomePage() {
  return (
    <ConsoleShell>
      <Suspense
        fallback={
          <div className="p-16 flex flex-col items-center justify-center text-[#505F76]">
            <Loader2 className="w-8 h-8 animate-spin text-[#003D9B] mb-3" />
            <p className="text-xs font-medium">Cargando tablero institucional...</p>
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </ConsoleShell>
  );
}