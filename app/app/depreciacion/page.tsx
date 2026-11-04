import type { Metadata } from "next";
import { ConsoleShell } from "@/components/layout/console-shell";
import { DepreciacionContent } from "@/components/depreciacion/depreciacion-content";

export const metadata: Metadata = {
  title: "Depreciación DGII - ActivaCore UNAPEC",
  description:
    "Cálculo mensual de depreciación por línea recta, actualización de valores en libros y asientos contables consolidados.",
};

export default function DepreciacionPage() {
  return (
    <ConsoleShell>
      <DepreciacionContent />
    </ConsoleShell>
  );
}
