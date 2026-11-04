import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { AsientoFilterSchema } from "@/lib/schemas/depreciation";
import { listarAsientos } from "@/lib/services/asiento.service";
import { respuestaError, serializar } from "@/lib/depreciation/http";
import { DepreciationError } from "@/lib/depreciation/errors";

export async function GET(req: NextRequest) {
  try {
    // El AUDITOR consulta los asientos con ACC_LOG_READ sin permiso de ejecución.
    const { authorized, response } = await checkSessionPermission([
      "DEP_CALCULATE",
      "DEP_APPROVE",
      "ACC_LOG_READ",
    ]);
    if (!authorized) return response;

    const { searchParams } = new URL(req.url);
    const parsed = AsientoFilterSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? searchParams.get("limit") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
    });

    if (!parsed.success) {
      return respuestaError(
        new DepreciationError("VALIDATION_ERROR", parsed.error.issues[0]?.message),
        req
      );
    }

    const { page, pageSize, estado } = parsed.data;
    const { items, total } = await listarAsientos({ page, pageSize, estado });

    return NextResponse.json({
      data: serializar(items),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error) {
    return respuestaError(error, req);
  }
}
