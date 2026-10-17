import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { EmployeeCreateSchema, EmployeeFilterSchema } from "@/lib/schemas/employee.schema";
import { normalizarDocumento, validarIdentidadDominicana } from "@/lib/validators/identity";
import { Prisma } from "@prisma/client";

// Generador correlativo de código de empleado institucional (EMP-XXXX)
async function generarSiguienteCodigoEmpleado(): Promise<string> {
  const empleados = await prisma.empleado.findMany({
    where: { codigo: { startsWith: "EMP-" } },
    select: { codigo: true },
  });

  let maxNum = 0;
  for (const e of empleados) {
    const match = e.codigo.match(/^EMP-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `EMP-${nextNum.toString().padStart(4, "0")}`;
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
      departamentoId: searchParams.get("departamentoId") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
    };

    const filterParsed = EmployeeFilterSchema.safeParse(queryParams);
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

    const { page, limit, search, departamentoId, estado } = filterParsed.data;
    const skip = (page - 1) * limit;

    const where: Prisma.EmpleadoWhereInput = {};

    if (estado && estado !== "TODOS") {
      where.estado = estado;
    }

    if (departamentoId) {
      where.departamentoId = departamentoId;
    }

    if (search) {
      const docLimpio = normalizarDocumento(search);
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { apellido: { contains: search, mode: "insensitive" } },
        { codigo: { contains: search, mode: "insensitive" } },
        { cargo: { contains: search, mode: "insensitive" } },
        { correo: { contains: search, mode: "insensitive" } },
        { cedula: { contains: docLimpio || search } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.empleado.count({ where }),
      prisma.empleado.findMany({
        where,
        skip,
        take: limit,
        orderBy: { codigo: "asc" },
        include: {
          departamento: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
            },
          },
          departamentosResponsable: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
            },
          },
        },
      }),
    ]);

    const data = items.map((emp) => ({
      id: emp.id,
      codigo: emp.codigo,
      nombre: emp.nombre,
      apellido: emp.apellido,
      tipoPersona: emp.tipoPersona,
      cedula: emp.cedula,
      departamentoId: emp.departamentoId,
      departamento: emp.departamento,
      cargo: emp.cargo,
      correo: emp.correo,
      telefono: emp.telefono,
      fechaIngreso: emp.fechaIngreso,
      estado: emp.estado,
      esResponsableDe: emp.departamentosResponsable,
      createdAt: emp.createdAt,
      updatedAt: emp.updatedAt,
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
    console.error("[API_EMPLEADOS_GET] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar los colaboradores.",
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

    // Validación inicial de cédula directa para código de error específico según criterio de aceptación
    if (body?.cedula) {
      const tipo = body.tipoPersona || "FISICA";
      const isValid = validarIdentidadDominicana(body.cedula, tipo);
      if (!isValid) {
        return NextResponse.json(
          {
            error: "CEDULA_INVALID_CHECKSUM",
            message: "La cédula ingresada no es válida según el algoritmo oficial de la JCE.",
          },
          { status: 422 }
        );
      }
    }

    const parsed = EmployeeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: "Los datos del colaborador no cumplen con el esquema de validación.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const {
      nombre,
      apellido,
      tipoPersona,
      cedula,
      departamentoId,
      cargo,
      correo,
      telefono,
      fechaIngreso,
      estado,
    } = parsed.data;

    let { codigo } = parsed.data;

    const cedulaNormalizada = normalizarDocumento(cedula);

    // 1. Verificar existencia del departamento
    const departamento = await prisma.departamento.findUnique({
      where: { id: departamentoId },
    });

    if (!departamento) {
      return NextResponse.json(
        {
          error: "DEPARTMENT_NOT_FOUND",
          message: "El departamento especificado no existe en el sistema.",
        },
        { status: 404 }
      );
    }

    // 2. Verificar duplicidad de cédula/documento de identidad
    const existingCedula = await prisma.empleado.findUnique({
      where: { cedula: cedulaNormalizada },
    });

    if (existingCedula) {
      return NextResponse.json(
        {
          error: "CEDULA_DUPLICATE",
          message: "Ya existe un colaborador registrado con este documento de identidad.",
        },
        { status: 409 }
      );
    }

    // 3. Si se suministró código explícito, verificar unicidad; de lo contrario autogenerar
    if (codigo) {
      const existingCodigo = await prisma.empleado.findUnique({
        where: { codigo: codigo.trim().toUpperCase() },
      });

      if (existingCodigo) {
        return NextResponse.json(
          {
            error: "EMPLOYEE_DUPLICATE_CODE",
            message: "El código de colaborador ya se encuentra asignado.",
          },
          { status: 409 }
        );
      }
      codigo = codigo.trim().toUpperCase();
    } else {
      codigo = await generarSiguienteCodigoEmpleado();
    }

    // 4. Crear empleado en la base de datos
    const nuevoEmpleado = await prisma.empleado.create({
      data: {
        codigo,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        tipoPersona,
        cedula: cedulaNormalizada,
        departamentoId,
        cargo: cargo.trim(),
        correo: correo ? correo.trim().toLowerCase() : null,
        telefono: telefono ? telefono.trim() : null,
        fechaIngreso,
        estado: estado || "ACTIVO",
      },
      include: {
        departamento: {
          select: {
            id: true,
            codigo: true,
            descripcion: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        id: nuevoEmpleado.id,
        codigo: nuevoEmpleado.codigo,
        nombre: nuevoEmpleado.nombre,
        apellido: nuevoEmpleado.apellido,
        tipoPersona: nuevoEmpleado.tipoPersona,
        cedula: nuevoEmpleado.cedula,
        departamentoId: nuevoEmpleado.departamentoId,
        departamento: nuevoEmpleado.departamento,
        cargo: nuevoEmpleado.cargo,
        correo: nuevoEmpleado.correo,
        telefono: nuevoEmpleado.telefono,
        fechaIngreso: nuevoEmpleado.fechaIngreso,
        estado: nuevoEmpleado.estado,
        createdAt: nuevoEmpleado.createdAt,
        updatedAt: nuevoEmpleado.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API_EMPLEADOS_POST] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al registrar el colaborador.",
      },
      { status: 500 }
    );
  }
}
