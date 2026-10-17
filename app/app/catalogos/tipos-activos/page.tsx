import type { Metadata } from "next";
import { TiposActivosContent } from "@/components/catalogos/tipos-activos-content";

export const metadata: Metadata = {
  title: "Catálogo de Tipos de Activos | ActivaCore UNAPEC",
  description: "Configuración de categorías fiscales DGII, tasas de amortización anual y asignación de cuentas contables.",
};

export default function TiposActivosPage() {
  return <TiposActivosContent />;
}
