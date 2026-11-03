import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { ClosePeriodSchema } from "@/lib/schemas/depreciation";
import { cerrarPeriodo } from "@/lib/services/period.service";
import { metaSolicitud, respuestaError, serializar } from "@/lib/depreciation/http";
import { DepreciationError } from "@/lib/depreciation/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { authorized, response, session } = await checkSessionPermission("DEP_CALCULATE");
    if (!authorized) return response;

    const body = await req.json().catch(() => null);
    const parsed = ClosePeriodSchema.safeParse(body);

    if (!parsed.success) {
      return respuestaError(
        new DepreciationError("VALIDATION_ERROR", parsed.error.issues[0]?.message),
        req
      );
    }

    const { id } = await params;
    const meta = metaSolicitud(req);

    const periodo = await cerrarPeriodo(id, session.user.id, meta);

    return NextResponse.json({ data: serializar(periodo) });
  } catch (error) {
    return respuestaError(error, req);
  }
}
