import { NextRequest, NextResponse } from "next/server";
import { requireContabilidadRead } from "@/lib/guards/contabilidad-guard";
import { IntegrationError } from "@/lib/integracion/errors";
import { respuestaIntegracionError, serializarIntegracion } from "@/lib/integracion/http";
import { ListAsientosQuerySchema } from "@/lib/schemas/integracion";
import { listarAsientos } from "@/lib/services/contabilidad-query.service";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireContabilidadRead(req);
    if (!guard.authorized) return guard.response;

    const { searchParams } = new URL(req.url);
    const parsed = ListAsientosQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
      periodo: searchParams.get("periodo") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      dir: searchParams.get("dir") ?? undefined,
    });

    if (!parsed.success) {
      throw new IntegrationError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Parámetros de consulta inválidos.",
        parsed.error.issues
      );
    }

    const { items, total, kpis } = await listarAsientos(parsed.data);
    return NextResponse.json({
      data: serializarIntegracion(items),
      kpis,
      meta: {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total,
        totalPages: Math.ceil(total / parsed.data.pageSize) || 1,
      },
    });
  } catch (error) {
    return respuestaIntegracionError(error, req);
  }
}
