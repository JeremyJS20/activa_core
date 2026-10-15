import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { DepartmentCreateSchema, DepartmentFilterSchema } from "@/lib/schemas/department.schema";
import { Prisma } from "@prisma/client";

// Generador correlativo de código institucional (DEP-XXX)
async function generarSiguienteCodigoDepartamento(): Promise<string> {
  const deptos = await prisma.departamento.findMany({
    where: { codigo: { startsWith: "DEP-" } },
    select: { codigo: true },
  });

  let maxNum = 0;
  for (const d of deptos) {
    const match = d.codigo.match(/^DEP-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `DEP-${nextNum.toString().padStart(3, "0")}`;
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
    };

    const filterParsed = DepartmentFilterSchema.safeParse(queryParams);
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

    const { page, limit, search, estado } = filterParsed.data;
    const skip = (page - 1) * limit;

    const where: Prisma.DepartamentoWhereInput = {};

    if (estado && estado !== "TODOS") {
      where.estado = estado;
    }

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: "insensitive" } },
        { descripcion: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.departamento.count({ where }),
      prisma.departamento.findMany({
        where,
        skip,
        take: limit,
        orderBy: { codigo: "asc" },
        include: {
          responsable: {
            select: {
              id: true,
              codigo: true,
              nombre: true,
              apellido: true,
              correo: true,
              cargo: true,
            },
          },
          _count: {
            select: {
              empleados: true,
            },
          },
        },
      }),
    ]);

    const data = items.map((dept) => ({
      id: dept.id,
      codigo: dept.codigo,
      descripcion: dept.descripcion,
      responsable: dept.responsable
        ? {
            id: dept.responsable.id,
            codigo: dept.responsable.codigo,
            nombre: dept.responsable.nombre,
            apellido: dept.responsable.apellido,
            correo: dept.responsable.correo,
            cargo: dept.responsable.cargo,
          }
        : null,
      estado: dept.estado,
      totalEmpleados: dept._count.empleados,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
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
    console.error("[API_DEPARTAMENTOS_GET] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar los departamentos.",
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
    const parsed = DepartmentCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: "Los datos suministrados no cumplen con el esquema de validación.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const { descripcion, responsableId, estado } = parsed.data;
    let { codigo } = parsed.data;

    // 1. Verificación case-insensitive de unicidad en descripción
    const existingDesc = await prisma.departamento.findFirst({
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
          error: "DEPT_DUPLICATE_NAME",
          message: "Ya existe un departamento registrado con esta descripción.",
        },
        { status: 409 }
      );
    }

    // 2. Si se suministró código explícito, validar unicidad; de lo contrario autogenerar correlativo
    if (codigo) {
      const existingCodigo = await prisma.departamento.findUnique({
        where: { codigo: codigo.trim().toUpperCase() },
      });

      if (existingCodigo) {
        return NextResponse.json(
          {
            error: "DEPT_DUPLICATE_CODE",
            message: "El código departamental ya se encuentra asignado.",
          },
          { status: 409 }
        );
      }
      codigo = codigo.trim().toUpperCase();
    } else {
      codigo = await generarSiguienteCodigoDepartamento();
    }

    // 3. Si se suministró responsable, verificar existencia
    if (responsableId) {
      const empleado = await prisma.empleado.findUnique({
        where: { id: responsableId },
      });

      if (!empleado) {
        return NextResponse.json(
          {
            error: "RESPONSIBLE_NOT_FOUND",
            message: "El colaborador seleccionado como responsable no existe en el sistema.",
          },
          { status: 404 }
        );
      }
    }

    // 4. Crear el departamento
    const nuevoDepartamento = await prisma.departamento.create({
      data: {
        codigo,
        descripcion: descripcion.trim(),
        responsableId: responsableId || null,
        estado: estado || "ACTIVO",
      },
      include: {
        responsable: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            apellido: true,
            correo: true,
            cargo: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: nuevoDepartamento.id,
        codigo: nuevoDepartamento.codigo,
        descripcion: nuevoDepartamento.descripcion,
        responsableId: nuevoDepartamento.responsableId,
        responsable: nuevoDepartamento.responsable,
        estado: nuevoDepartamento.estado,
        createdAt: nuevoDepartamento.createdAt,
        updatedAt: nuevoDepartamento.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API_DEPARTAMENTOS_POST] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al registrar el departamento.",
      },
      { status: 500 }
    );
  }
}
