import { NextRequest, NextResponse } from "next/server";
import { requireContabilidadRead } from "@/lib/guards/contabilidad-guard";
import { respuestaIntegracionError, serializarIntegracion } from "@/lib/integracion/http";
import { obtenerAsiento } from "@/lib/services/contabilidad-query.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireContabilidadRead(req);
    if (!guard.authorized) return guard.response;

    const { id } = await params;
    const asiento = await obtenerAsiento(id);
    return NextResponse.json({ data: serializarIntegracion(asiento) });
  } catch (error) {
    return respuestaIntegracionError(error, req);
  }
}
