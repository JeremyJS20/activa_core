import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { CreateAssetSchema, AssetFilterSchema } from "@/lib/schemas/asset.schema";
import { generarCodigoActivo } from "@/lib/services/asset-code.service";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const authCheck = await checkSessionPermission(["ACT_READ", "ACT_OPERATE"]);
    if (!authCheck.authorized) return authCheck.response;

    const { searchParams } = new URL(req.url);
    const queryParams = {
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? searchParams.get("limit") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      departamentoId: searchParams.get("departamentoId") ?? undefined,
      tipoActivoId: searchParams.get("tipoActivoId") ?? undefined,
      empleadoId: searchParams.get("empleadoId") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortOrder: searchParams.get("sortOrder") ?? undefined,
    };

    const filterParsed = AssetFilterSchema.safeParse(queryParams);
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

    const { page, pageSize, search, departamentoId, tipoActivoId, empleadoId, estado, sortBy, sortOrder } =
      filterParsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ActivoFijoWhereInput = {};

    if (estado && estado !== "TODOS") {
      where.estado = estado;
    }

    if (departamentoId) {
      where.departamentoId = departamentoId;
    }

    if (tipoActivoId) {
      where.tipoActivoId = tipoActivoId;
    }

    if (empleadoId) {
      where.empleadoId = empleadoId;
    }

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: "insensitive" } },
        { descripcion: { contains: search, mode: "insensitive" } },
        { numeroSerie: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.activoFijo.count({ where }),
      prisma.activoFijo.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          departamento: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
            },
          },
          tipoActivo: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
              porcentajeDepreciacionAnual: true,
            },
          },
          empleado: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              apellido: true,
              cedula: true,
              cargo: true,
            },
          },
        },
      }),
    ]);

    const data = items.map((activo) => ({
      id: activo.id,
      codigo: activo.codigo,
      descripcion: activo.descripcion,
      costoAdquisicion: Number(activo.costoAdquisicion),
      valorResidual: Number(activo.valorResidual),
      depreciacionAcumulada: Number(activo.depreciacionAcumulada),
      valorEnLibros: Number(activo.valorEnLibros),
      estado: activo.estado,
      marca: activo.marca,
      modelo: activo.modelo,
      numeroSerie: activo.numeroSerie,
      ubicacionFisica: activo.ubicacionFisica,
      color: activo.color,
      fechaAdquisicion: activo.fechaAdquisicion.toISOString().split("T")[0],
      createdAt: activo.createdAt.toISOString(),
      updatedAt: activo.updatedAt.toISOString(),
      departamento: activo.departamento,
      tipoActivo: {
        ...activo.tipoActivo,
        porcentajeDepreciacionAnual: Number(activo.tipoActivo.porcentajeDepreciacionAnual),
      },
      empleado: activo.empleado,
    }));

    return NextResponse.json({
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (error) {
    console.error("Error al obtener inventario de activos fijos:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar los activos fijos.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCheck = await checkSessionPermission(["ACT_CREATE", "ACT_OPERATE"]);
    if (!authCheck.authorized) return authCheck.response;
    const { session } = authCheck;

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: "INVALID_JSON",
          message: "El cuerpo de la solicitud no contiene un JSON válido.",
        },
        { status: 400 }
      );
    }

    const parsed = CreateAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos provistos para el registro del activo no son válidos.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const data = parsed.data;

    // 1. Validar departamento
    const departamento = await prisma.departamento.findUnique({
      where: { id: data.departamentoId },
      select: { id: true, estado: true },
    });
    if (!departamento) {
      return NextResponse.json(
        {
          error: "DEPARTMENT_NOT_FOUND",
          message: "El departamento universitario especificado no existe.",
        },
        { status: 400 }
      );
    }
    if (departamento.estado !== "ACTIVO") {
      return NextResponse.json(
        {
          error: "DEPARTMENT_INACTIVE",
          message: "No se puede radicar un activo en un departamento inactivo.",
        },
        { status: 400 }
      );
    }

    // 2. Validar tipo de activo
    const tipoActivo = await prisma.tipoActivo.findUnique({
      where: { id: data.tipoActivoId },
      select: { id: true, estado: true },
    });
    if (!tipoActivo) {
      return NextResponse.json(
        {
          error: "ASSET_TYPE_NOT_FOUND",
          message: "El tipo de activo especificado no existe.",
        },
        { status: 400 }
      );
    }
    if (tipoActivo.estado !== "ACTIVO") {
      return NextResponse.json(
        {
          error: "ASSET_TYPE_INACTIVE",
          message: "No se puede categorizar un activo bajo un tipo de activo inactivo.",
        },
        { status: 400 }
      );
    }

    // 3. Validar empleado custodio
    const empleado = await prisma.empleado.findUnique({
      where: { id: data.empleadoId },
      select: { id: true, estado: true },
    });
    if (!empleado) {
      return NextResponse.json(
        {
          error: "EMPLOYEE_NOT_FOUND",
          message: "El empleado custodio especificado no existe.",
        },
        { status: 400 }
      );
    }
    if (empleado.estado !== "ACTIVO") {
      return NextResponse.json(
        {
          error: "EMPLOYEE_NOT_ELIGIBLE",
          message: "El empleado seleccionado como custodio no está activo en la institución.",
        },
        { status: 400 }
      );
    }

    // 4. Transacción atómica: Generación de código correlativo + Activo + Custodia inicial
    const anioAdquisicion = new Date(data.fechaAdquisicion).getFullYear();

    const nuevoActivo = await prisma.$transaction(async (tx) => {
      const codigo = data.codigo || (await generarCodigoActivo(tx, anioAdquisicion));

      const activo = await tx.activoFijo.create({
        data: {
          codigo,
          descripcion: data.descripcion,
          tipoActivoId: data.tipoActivoId,
          departamentoId: data.departamentoId,
          empleadoId: data.empleadoId,
          fechaAdquisicion: data.fechaAdquisicion,
          costoAdquisicion: new Prisma.Decimal(data.costoAdquisicion),
          valorResidual: new Prisma.Decimal(data.valorResidual),
          depreciacionAcumulada: new Prisma.Decimal(0.0),
          valorEnLibros: new Prisma.Decimal(data.costoAdquisicion),
          estado: data.estado || "ACTIVO",
          marca: data.marca || null,
          modelo: data.modelo || null,
          numeroSerie: data.numeroSerie || null,
          ubicacionFisica: data.ubicacionFisica || null,
          color: data.color || null,
        },
        include: {
          departamento: {
            select: { id: true, codigo: true, descripcion: true },
          },
          tipoActivo: {
            select: { id: true, codigo: true, descripcion: true, porcentajeDepreciacionAnual: true },
          },
          empleado: {
            select: { id: true, codigo: true, nombre: true, apellido: true, cedula: true, cargo: true },
          },
        },
      });

      await tx.historialCustodia.create({
        data: {
          activoId: activo.id,
          empleadoAnteriorId: null,
          empleadoNuevoId: data.empleadoId,
          departamentoAnteriorId: null,
          departamentoNuevoId: data.departamentoId,
          motivo: "ALTA_INICIAL",
          justificacion: "Asignación inicial de custodia por adquisición e ingreso de activo fijo.",
          autorizadoPorId: session.user.id,
        },
      });

      return activo;
    });

    return NextResponse.json(
      {
        id: nuevoActivo.id,
        codigo: nuevoActivo.codigo,
        descripcion: nuevoActivo.descripcion,
        costoAdquisicion: Number(nuevoActivo.costoAdquisicion),
        valorResidual: Number(nuevoActivo.valorResidual),
        depreciacionAcumulada: Number(nuevoActivo.depreciacionAcumulada),
        valorEnLibros: Number(nuevoActivo.valorEnLibros),
        estado: nuevoActivo.estado,
        marca: nuevoActivo.marca,
        modelo: nuevoActivo.modelo,
        numeroSerie: nuevoActivo.numeroSerie,
        ubicacionFisica: nuevoActivo.ubicacionFisica,
        color: nuevoActivo.color,
        fechaAdquisicion: nuevoActivo.fechaAdquisicion.toISOString().split("T")[0],
        createdAt: nuevoActivo.createdAt.toISOString(),
        departamento: nuevoActivo.departamento,
        tipoActivo: {
          ...nuevoActivo.tipoActivo,
          porcentajeDepreciacionAnual: Number(nuevoActivo.tipoActivo.porcentajeDepreciacionAnual),
        },
        empleado: nuevoActivo.empleado,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          error: "ASSET_CODE_DUPLICATE",
          message: "Ya existe un activo registrado con el código generado.",
        },
        { status: 409 }
      );
    }

    console.error("Error al registrar activo fijo:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al registrar el activo fijo.",
      },
      { status: 500 }
    );
  }
}