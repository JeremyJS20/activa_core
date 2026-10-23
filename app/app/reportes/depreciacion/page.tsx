import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { DepreciacionContent } from "@/components/reportes/depreciacion-content";

interface PeriodosDepreciacion {
  periodoInicial: string;
  periodosDisponibles: string[];
}

function DepreciacionFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-16 rounded-xl bg-white shadow-2xs animate-pulse" />
      <div className="h-[420px] rounded-xl bg-white shadow-2xs animate-pulse" />
    </div>
  );
}

/** Mes actual en la zona horaria institucional (America/Santo_Domingo). */
function periodoActual(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

/**
 * REQ-REP-004 — período predeterminado: mes actual si tiene cuotas;
 * en caso contrario, el último período con cuotas registradas.
 */
async function resolverPeriodos(): Promise<PeriodosDepreciacion> {
  const actual = periodoActual();

  try {
    const rows = await prisma.depreciacionMensual.groupBy({
      by: ["periodoFiscal"],
      orderBy: { periodoFiscal: "desc" },
    });

    const periodosDisponibles = rows.map((row) => row.periodoFiscal);
    const periodoInicial = periodosDisponibles.includes(actual)
      ? actual
      : (periodosDisponibles[0] ?? actual);

    return { periodoInicial, periodosDisponibles };
  } catch (error) {
    // La pantalla sigue siendo utilizable: el usuario puede elegir el período.
    console.error("[reportes/depreciacion/page] No se pudieron resolver los períodos:", error);
    return { periodoInicial: actual, periodosDisponibles: [] };
  }
}

export default async function ReportesDepreciacionPage() {
  const { periodoInicial, periodosDisponibles } = await resolverPeriodos();

  return (
    <Suspense fallback={<DepreciacionFallback />}>
      <DepreciacionContent
        periodoInicial={periodoInicial}
        periodosDisponibles={periodosDisponibles}
      />
    </Suspense>
  );
}
