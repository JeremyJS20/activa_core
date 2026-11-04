import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission } from "@/lib/auth/rbac";
import {
  CreatePeriodSchema,
  PeriodFilterSchema,
} from "@/lib/schemas/depreciation";
import { crearPeriodo, listarPeriodos } from "@/lib/services/period.service";
import { respuestaError, serializar } from "@/lib/depreciation/http";
import { DepreciationError } from "@/lib/depreciation/errors";

export async function GET(req: NextRequest) {
  try {
    const { authorized, response } = await checkSessionPermission("DEP_CALCULATE");
    if (!authorized) return response;

    const { searchParams } = new URL(req.url);
    const parsed = PeriodFilterSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? searchParams.get("limit") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
      anio: searchParams.get("anio") ?? undefined,
    });

    if (!parsed.success) {
      return respuestaError(
        new DepreciationError("VALIDATION_ERROR", parsed.error.issues[0]?.message),
        req
      );
    }

    const { page, pageSize, estado, anio } = parsed.data;
    const { items, total } = await listarPeriodos({ page, pageSize, estado, anio });

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

export async function POST(req: NextRequest) {
  try {
    const { authorized, response } = await checkSessionPermission("DEP_CALCULATE");
    if (!authorized) return response;

    const body = await req.json().catch(() => null);
    const parsed = CreatePeriodSchema.safeParse(body);

    if (!parsed.success) {
      return respuestaError(
        new DepreciationError("VALIDATION_ERROR", parsed.error.issues[0]?.message),
        req
      );
    }

    const periodo = await crearPeriodo(parsed.data);
    return NextResponse.json({ data: serializar(periodo) }, { status: 201 });
  } catch (error) {
    return respuestaError(error, req);
  }
}
