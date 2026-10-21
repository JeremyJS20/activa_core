import { NextRequest, NextResponse } from "next/server";
import { requireReportesPermission } from "@/lib/guards/reportes-guard";
import { consultarInventario } from "@/lib/services/report.service";
import { InventarioQuerySchema, parseEstadosParam } from "@/lib/schemas/report.schema";

/**
 * GET /api/reportes/inventario — Consulta multicriterio del parque de activos.
 *
 * Módulo SOLO LECTURA (NFR-REP-001): cualquier método distinto de GET debe ser
 * rechazado. El gate de métodos se consolida en Task 2.4 (guard compartido).
 *
 * Query params: fechaInicio, fechaFin, montoMin, montoMax, departamentoId,
 * tipoActivoId, custodio, estados (csv o repetido), search, sort, dir, page, pageSize.
 */
export async function GET(req: NextRequest) {
  const { authorized, response } = await requireReportesPermission(req);
  if (!authorized) return response;

  const { searchParams } = new URL(req.url);

  const rawEstados = searchParams.getAll("estados");
  const queryParams = {
    fechaInicio: searchParams.get("fechaInicio") ?? undefined,
    fechaFin: searchParams.get("fechaFin") ?? undefined,
    montoMin: searchParams.get("montoMin") ?? undefined,
    montoMax: searchParams.get("montoMax") ?? undefined,
    departamentoId: searchParams.get("departamentoId") ?? undefined,
    tipoActivoId: searchParams.get("tipoActivoId") ?? undefined,
    custodio: searchParams.get("custodio") ?? undefined,
    estados: rawEstados.length > 0 ? parseEstadosParam(rawEstados) : undefined,
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    dir: searchParams.get("dir") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  };

  const parsed = InventarioQuerySchema.safeParse(queryParams);
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
    let result = await consultarInventario(parsed.data);

    // Clamp de página: si el resultset se redujo, devuelve la última página válida.
    if (result.meta.totalPages > 0 && parsed.data.page > result.meta.totalPages) {
      result = await consultarInventario({
        ...parsed.data,
        page: result.meta.totalPages,
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[reportes/inventario] Error al consultar:", error);
    return NextResponse.json(
      {
        type: "https://activacore.unapec.edu.do/problems/internal",
        title: "INTERNAL_ERROR",
        status: 500,
        detail: "No fue posible completar la consulta del inventario.",
      },
      { status: 500, headers: { "Content-Type": "application/problem+json" } }
    );
  }
}
