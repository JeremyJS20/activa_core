import type { Metadata } from "next";
import { EmpleadosContent } from "@/components/catalogos/empleados-content";

export const metadata: Metadata = {
  title: "Directorio de Empleados y Custodios | ActivaCore UNAPEC",
  description: "Directorio institucional de colaboradores universitarios para asignación y custodia de activos fijos.",
};

export default function EmpleadosPage() {
  return <EmpleadosContent />;
}
