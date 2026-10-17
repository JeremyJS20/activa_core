import type { Metadata } from "next";
import { auth } from "@/auth";
import { ConsoleShell } from "@/components/layout/console-shell";
import { ActivosContent } from "@/components/activos/activos-content";

export const metadata: Metadata = {
  title: "Inventario de Activos Fijos | ActivaCore UNAPEC",
  description:
    "Control de bienes institucionales, custodia departamental, clasificaciones fiscales DGII y actas de entrega.",
};

export default async function ActivosPage() {
  const session = await auth();

  return (
    <ConsoleShell>
      <ActivosContent
        initialRole={session?.user?.rol?.codigo}
        initialPermisos={session?.user?.permisos}
      />
    </ConsoleShell>
  );
}