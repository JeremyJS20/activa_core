import { NextRequest, NextResponse } from "next/server";
import { requireReportesPermission } from "@/lib/guards/reportes-guard";
import { consultarDepreciacion } from "@/lib/services/report.service";
import { DepreciacionQuerySchema } from "@/lib/schemas/report.schema";

/**
 * GET /api/reportes/depreciacion — Reporte de depreciación periódica y fiscal.
 * SOLO LECTURA sobre `depreciaciones_mensual` (contrato provisional de Sub-03):
 * NO recalcula cuotas, solo las consulta (REQ-REP-004).
 */
export async function GET(req: NextRequest) {
  const { authorized, response } = await requireReportesPermission(req);
  if (!authorized) return response;

  const { searchParams } = new URL(req.url);
  const queryParams = {
    periodo: searchParams.get("periodo") ?? undefined,
    cuentaCompra: searchParams.get("cuentaCompra") ?? undefined,
    cuentaDepreciacion: searchParams.get("cuentaDepreciacion") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  };

  const parsed = DepreciacionQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "query");
      if (!errors[field]) errors[field] = issue.message;
    }

    return NextResponse.json(
      {
        type: "https://activacore.unapec.edu.do/problems/validation",
        title: "VALIDATION_ERROR",
        status: 400,
        detail: "Parámetros de consulta inválidos",
        errors,
      },
      { status: 400, headers: { "Content-Type": "application/problem+json" } }
    );
  }

  try {
    let result = await consultarDepreciacion(parsed.data);

    // Clamp de página sobre resultsets que se reducen entre consultas.
    if (result.meta.totalPages > 0 && parsed.data.page > result.meta.totalPages) {
      result = await consultarDepreciacion({ ...parsed.data, page: result.meta.totalPages });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[reportes/depreciacion] Error al consultar:", error);
    return NextResponse.json(
      {
        type: "https://activacore.unapec.edu.do/problems/internal",
        title: "INTERNAL_ERROR",
        status: 500,
        detail: "No fue posible completar la consulta de depreciación.",
      },
      { status: 500, headers: { "Content-Type": "application/problem+json" } }
    );
  }
}
