import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { ejecutarCorrida } from "@/lib/services/depreciation.service";
import { metaSolicitud, respuestaError } from "@/lib/depreciation/http";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { authorized, response, session } = await checkSessionPermission("DEP_CALCULATE");
    if (!authorized) return response;

    const { id } = await params;
    const meta = metaSolicitud(req);

    const resumen = await ejecutarCorrida({
      periodoId: id,
      usuarioId: session.user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ data: resumen });
  } catch (error) {
    return respuestaError(error, req);
  }
}
