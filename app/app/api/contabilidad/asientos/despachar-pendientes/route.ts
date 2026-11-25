import { NextRequest, NextResponse } from "next/server";
import {
  requireContabilidadManage,
  usuarioDesdeSesion,
} from "@/lib/guards/contabilidad-guard";
import { IntegrationError } from "@/lib/integracion/errors";
import { respuestaIntegracionError } from "@/lib/integracion/http";
import { BatchDispatchSchema } from "@/lib/schemas/integracion";
import { despacharPendientes } from "@/lib/services/integracion-contable.service";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const guard = await requireContabilidadManage(req);
    if (!guard.authorized) return guard.response;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = BatchDispatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new IntegrationError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Solicitud de lote inválida.",
        parsed.error.issues
      );
    }

    const resultado = await despacharPendientes(
      parsed.data.periodo,
      usuarioDesdeSesion(guard.session)
    );
    return NextResponse.json({ data: resultado });
  } catch (error) {
    return respuestaIntegracionError(error, req);
  }
}
