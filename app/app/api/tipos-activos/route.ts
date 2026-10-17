import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import {
  AssetTypeCreateSchema,
  AssetTypeFilterSchema,
  DGII_PARAMETROS_POR_DEFECTO,
} from "@/lib/schemas/asset-type.schema";
import { Prisma } from "@prisma/client";

// Generador correlativo de código de tipo de activo (TPA-XXX)
async function generarSiguienteCodigoTipoActivo(): Promise<string> {
  const tipos = await prisma.tipoActivo.findMany({
    where: { codigo: { startsWith: "TPA-" } },
    select: { codigo: true },
  });

  let maxNum = 0;
  for (const t of tipos) {
    const match = t.codigo.match(/^TPA-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `TPA-${nextNum.toString().padStart(3, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const { authorized, response } = await checkSessionPermission("CAT_READ");
    if (!authorized) return response;

    const { searchParams } = new URL(req.url);
    const queryParams = {
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
      metodoDepreciacion:
        searchParams.get("metodoDepreciacion") ?? searchParams.get("metodo") ?? undefined,
    };

    const filterParsed = AssetTypeFilterSchema.safeParse(queryParams);
    if (!filterParsed.success) {
      return NextResponse.json(
        {
          error: "INVALID_QUERY_PARAMS",
          message: "Parámetros de consulta o paginación inválidos.",
          issues: filterParsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { page, limit, search, estado, metodoDepreciacion } = filterParsed.data;
    const skip = (page - 1) * limit;

    const where: Prisma.TipoActivoWhereInput = {};

    if (estado && estado !== "TODOS") {
      where.estado = estado;
    }

    if (metodoDepreciacion && metodoDepreciacion !== "TODOS") {
      where.metodoDepreciacion = metodoDepreciacion;
    }

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: "insensitive" } },
        { descripcion: { contains: search, mode: "insensitive" } },
        { cuentaContableCompra: { contains: search } },
        { cuentaContableDepreciacion: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.tipoActivo.count({ where }),
      prisma.tipoActivo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { codigo: "asc" },
      }),
    ]);

    const data = items.map((tipo) => ({
      id: tipo.id,
      codigo: tipo.codigo,
      descripcion: tipo.descripcion,
      cuentaContableCompra: tipo.cuentaContableCompra,
      cuentaContableDepreciacion: tipo.cuentaContableDepreciacion,
      metodoDepreciacion: tipo.metodoDepreciacion,
      porcentajeDepreciacionAnual: Number(tipo.porcentajeDepreciacionAnual),
      vidaUtilMeses: tipo.vidaUtilMeses,
      estado: tipo.estado,
      createdAt: tipo.createdAt,
      updatedAt: tipo.updatedAt,
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("[API_TIPOS_ACTIVOS_GET] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar los tipos de activos.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { authorized, response } = await checkSessionPermission("CAT_WRITE");
    if (!authorized) return response;

    const body = await req.json().catch(() => null);

    // Si el usuario seleccionó un método DGII y no proporcionó porcentaje/vidaUtil, auto-completar según normativa
    if (body && body.metodoDepreciacion && DGII_PARAMETROS_POR_DEFECTO[body.metodoDepreciacion]) {
      const def = DGII_PARAMETROS_POR_DEFECTO[body.metodoDepreciacion];
      if (body.porcentajeDepreciacionAnual === undefined || body.porcentajeDepreciacionAnual === null) {
        body.porcentajeDepreciacionAnual = def.porcentaje;
      }
      if (body.vidaUtilMeses === undefined || body.vidaUtilMeses === null) {
        body.vidaUtilMeses = def.vidaUtilMeses;
      }
    }

    const parsed = AssetTypeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: "Los datos del tipo de activo no cumplen con las validaciones requeridas.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const {
      descripcion,
      cuentaContableCompra,
      cuentaContableDepreciacion,
      metodoDepreciacion,
      porcentajeDepreciacionAnual,
      vidaUtilMeses,
      estado,
    } = parsed.data;

    let { codigo } = parsed.data;

    // 1. Verificación case-insensitive de unicidad en descripción
    const existingDesc = await prisma.tipoActivo.findFirst({
      where: {
        descripcion: {
          equals: descripcion.trim(),
          mode: "insensitive",
        },
      },
    });

    if (existingDesc) {
      return NextResponse.json(
        {
          error: "ASSET_TYPE_DUPLICATE_NAME",
          message: "Ya existe un tipo de activo registrado con esta descripción.",
        },
        { status: 409 }
      );
    }

    // 2. Si se suministró código explícito, validar unicidad; de lo contrario autogenerar
    if (codigo) {
      const existingCodigo = await prisma.tipoActivo.findUnique({
        where: { codigo: codigo.trim().toUpperCase() },
      });

      if (existingCodigo) {
        return NextResponse.json(
          {
            error: "ASSET_TYPE_DUPLICATE_CODE",
            message: "El código de tipo de activo ya se encuentra asignado.",
          },
          { status: 409 }
        );
      }
      codigo = codigo.trim().toUpperCase();
    } else {
      codigo = await generarSiguienteCodigoTipoActivo();
    }

    // 3. Crear el Tipo de Activo
    const nuevoTipoActivo = await prisma.tipoActivo.create({
      data: {
        codigo,
        descripcion: descripcion.trim(),
        cuentaContableCompra,
        cuentaContableDepreciacion,
        metodoDepreciacion,
        porcentajeDepreciacionAnual,
        vidaUtilMeses,
        estado: estado || "ACTIVO",
      },
    });

    return NextResponse.json(
      {
        id: nuevoTipoActivo.id,
        codigo: nuevoTipoActivo.codigo,
        descripcion: nuevoTipoActivo.descripcion,
        cuentaContableCompra: nuevoTipoActivo.cuentaContableCompra,
        cuentaContableDepreciacion: nuevoTipoActivo.cuentaContableDepreciacion,
        metodoDepreciacion: nuevoTipoActivo.metodoDepreciacion,
        porcentajeDepreciacionAnual: Number(nuevoTipoActivo.porcentajeDepreciacionAnual),
        vidaUtilMeses: nuevoTipoActivo.vidaUtilMeses,
        estado: nuevoTipoActivo.estado,
        createdAt: nuevoTipoActivo.createdAt,
        updatedAt: nuevoTipoActivo.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API_TIPOS_ACTIVOS_POST] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al registrar el tipo de activo.",
      },
      { status: 500 }
    );
  }
}
