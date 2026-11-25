import { NextRequest, NextResponse } from "next/server";
import { requireContabilidadLog } from "@/lib/guards/contabilidad-guard";
import { IntegrationError } from "@/lib/integracion/errors";
import { respuestaIntegracionError, serializarIntegracion } from "@/lib/integracion/http";
import { BitacoraQuerySchema } from "@/lib/schemas/integracion";
import { listarBitacora } from "@/lib/services/contabilidad-query.service";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireContabilidadLog(req);
    if (!guard.authorized) return guard.response;

    const { searchParams } = new URL(req.url);
    const parsed = BitacoraQuerySchema.safeParse({
      asientoId: searchParams.get("asientoId") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      throw new IntegrationError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Parámetros de bitácora inválidos.",
        parsed.error.issues
      );
    }

    const { items, total } = await listarBitacora(
      parsed.data.asientoId,
      parsed.data.page,
      parsed.data.pageSize
    );

    return NextResponse.json({
      data: serializarIntegracion(items),
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
