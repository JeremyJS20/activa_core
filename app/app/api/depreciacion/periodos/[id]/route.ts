import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { obtenerPeriodo } from "@/lib/services/period.service";
import { respuestaError, serializar } from "@/lib/depreciation/http";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { authorized, response } = await checkSessionPermission("DEP_CALCULATE");
    if (!authorized) return response;

    const { id } = await params;
    const periodo = await obtenerPeriodo(id);

    return NextResponse.json({ data: serializar(periodo) });
  } catch (error) {
    return respuestaError(error, req);
  }
}
