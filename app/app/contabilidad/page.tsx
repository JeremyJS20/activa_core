import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ConsoleShell } from "@/components/layout/console-shell";
import { ContabilidadContent } from "@/components/contabilidad/contabilidad-content";

export const metadata: Metadata = {
  title: "Integración Contable - ActivaCore UNAPEC",
  description:
    "Monitoreo y despacho de asientos contables de depreciación hacia el Web Service de Contabilidad institucional.",
};

const PERMISOS_CONTABILIDAD = ["INT_MANAGE", "ACC_POST_SEND", "ACC_LOG_READ"];

function ContabilidadSkeleton() {
  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto space-y-6" aria-busy="true">
        <div className="space-y-2">
          <div className="h-3 w-56 rounded bg-[#F2F3FF] animate-pulse" />
          <div className="h-8 w-72 rounded bg-[#F2F3FF] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-xl bg-white border border-slate-200/90 shadow-2xs animate-pulse"
            />
          ))}
        </div>
        <div className="h-[420px] rounded-xl bg-white border border-slate-200/90 shadow-2xs animate-pulse" />
      </div>
    </div>
  );
}

async function ContabilidadGate() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const permisos = session.user.permisos ?? [];
  const isSuperAdmin =
    session.user.rol?.codigo === "ADMIN" || permisos.includes("USER_ADMIN");
  const autorizado =
    isSuperAdmin || PERMISOS_CONTABILIDAD.some((permiso) => permisos.includes(permiso));

  if (!autorizado) {
    redirect("/?error=forbidden");
  }

  return <ContabilidadContent />;
}

export default function ContabilidadPage() {
  return (
    <ConsoleShell>
      <Suspense fallback={<ContabilidadSkeleton />}>
        <ContabilidadGate />
      </Suspense>
    </ConsoleShell>
  );
}
