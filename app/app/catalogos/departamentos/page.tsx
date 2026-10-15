import type { Metadata } from "next";
import { ConsoleShell } from "@/components/layout/console-shell";
import { DepartamentosContent } from "@/components/catalogos/departamentos-content";

export const metadata: Metadata = {
  title: "Catálogo de Departamentos | ActivaCore UNAPEC",
  description: "Estructura orgánica y centros de costos institucionales para la asignación y custodia de activos fijos.",
};

export default function DepartamentosPage() {
  return (
    <ConsoleShell>
      <DepartamentosContent />
    </ConsoleShell>
  );
}
