import { NextRequest, NextResponse } from "next/server";
import { requireReportesPermission } from "@/lib/guards/reportes-guard";
import { consultarKardex } from "@/lib/services/report.service";
import { KardexParamsSchema } from "@/lib/schemas/report.schema";

/**
 * GET /api/reportes/activos/[id]/kardex — Ficha histórica inmutable del activo.
 * Solo lectura: alta inicial, movimientos de custodia y cuotas de depreciación
 * (REQ-REP-005). No expone ninguna acción de mutación.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { authorized, response } = await requireReportesPermission(req);
  if (!authorized) return response;

  const { id } = await context.params;

  const parsed = KardexParamsSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json(
      {
        type: "https://activacore.unapec.edu.do/problems/validation",
        title: "VALIDATION_ERROR",
        status: 400,
        detail: "El identificador del activo no es válido",
        errors: { id: parsed.error.issues[0]?.message ?? "UUID inválido" },
      },
      { status: 400, headers: { "Content-Type": "application/problem+json" } }
    );
  }

  try {
    const result = await consultarKardex(parsed.data.id);

    if (!result) {
      return NextResponse.json(
        {
          type: "https://activacore.unapec.edu.do/problems/not-found",
          title: "ASSET_NOT_FOUND",
          status: 404,
          detail: "El activo solicitado no existe o fue eliminado.",
        },
        { status: 404, headers: { "Content-Type": "application/problem+json" } }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[reportes/kardex] Error al consultar:", error);
    return NextResponse.json(
      {
        type: "https://activacore.unapec.edu.do/problems/internal",
        title: "INTERNAL_ERROR",
        status: 500,
        detail: "No fue posible completar la consulta del kardex.",
      },
      { status: 500, headers: { "Content-Type": "application/problem+json" } }
    );
  }
}
