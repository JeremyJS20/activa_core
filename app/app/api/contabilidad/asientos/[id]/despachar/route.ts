import { NextRequest, NextResponse } from "next/server";
import {
  requireContabilidadManage,
  usuarioDesdeSesion,
} from "@/lib/guards/contabilidad-guard";
import { respuestaIntegracionError } from "@/lib/integracion/http";
import { despacharAsiento } from "@/lib/services/integracion-contable.service";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireContabilidadManage(req);
    if (!guard.authorized) return guard.response;

    const { id } = await params;
    const resultado = await despacharAsiento(id, usuarioDesdeSesion(guard.session));
    return NextResponse.json({ data: resultado });
  } catch (error) {
    return respuestaIntegracionError(error, req);
  }
}
