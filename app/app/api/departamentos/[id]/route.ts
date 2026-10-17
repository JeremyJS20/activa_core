import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { DepartmentUpdateSchema } from "@/lib/schemas/department.schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { authorized, response } = await checkSessionPermission("CAT_READ");
    if (!authorized) return response;

    const { id } = await params;

    const depto = await prisma.departamento.findUnique({
      where: { id },
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
    });

    if (!depto) {
      return NextResponse.json(
        {
          error: "DEPT_NOT_FOUND",
          message: "El departamento solicitado no existe en el sistema.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: depto.id,
      codigo: depto.codigo,
      descripcion: depto.descripcion,
      responsable: depto.responsable,
      estado: depto.estado,
      totalEmpleados: depto._count.empleados,
      createdAt: depto.createdAt,
      updatedAt: depto.updatedAt,
    });
  } catch (error) {
    console.error("[API_DEPARTAMENTOS_ID_GET] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar el departamento.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { authorized, response } = await checkSessionPermission("CAT_WRITE");
    if (!authorized) return response;

    const { id } = await params;

    // Verificar existencia del departamento
    const existing = await prisma.departamento.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error: "DEPT_NOT_FOUND",
          message: "El departamento no existe.",
        },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = DepartmentUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: "Los datos de actualización no son válidos.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const { descripcion, codigo, responsableId, estado } = parsed.data;

    // 1. Validar duplicidad de descripción case-insensitive si se envía
    if (descripcion && descripcion.trim().toLowerCase() !== existing.descripcion.toLowerCase()) {
      const duplicateDesc = await prisma.departamento.findFirst({
        where: {
          descripcion: {
            equals: descripcion.trim(),
            mode: "insensitive",
          },
          NOT: { id },
        },
      });

      if (duplicateDesc) {
        return NextResponse.json(
          {
            error: "DEPT_DUPLICATE_NAME",
            message: "Ya existe otro departamento con esa descripción.",
          },
          { status: 409 }
        );
      }
    }

    // 2. Validar duplicidad de código si se envía
    if (codigo && codigo.trim().toUpperCase() !== existing.codigo) {
      const duplicateCodigo = await prisma.departamento.findFirst({
        where: {
          codigo: codigo.trim().toUpperCase(),
          NOT: { id },
        },
      });

      if (duplicateCodigo) {
        return NextResponse.json(
          {
            error: "DEPT_DUPLICATE_CODE",
            message: "El código departamental ya se encuentra asignado.",
          },
          { status: 409 }
        );
      }
    }

    // 3. Validar responsable si se especifica
    if (responsableId) {
      const empleado = await prisma.empleado.findUnique({
        where: { id: responsableId },
      });

      if (!empleado) {
        return NextResponse.json(
          {
            error: "RESPONSIBLE_NOT_FOUND",
            message: "El colaborador asignado como responsable no existe.",
          },
          { status: 404 }
        );
      }
    }

    // 4. Actualizar el departamento
    const updated = await prisma.departamento.update({
      where: { id },
      data: {
        ...(descripcion ? { descripcion: descripcion.trim() } : {}),
        ...(codigo ? { codigo: codigo.trim().toUpperCase() } : {}),
        ...(responsableId !== undefined ? { responsableId: responsableId || null } : {}),
        ...(estado ? { estado } : {}),
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
        _count: {
          select: {
            empleados: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      codigo: updated.codigo,
      descripcion: updated.descripcion,
      responsableId: updated.responsableId,
      responsable: updated.responsable,
      estado: updated.estado,
      totalEmpleados: updated._count.empleados,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[API_DEPARTAMENTOS_ID_PUT] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al actualizar el departamento.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { authorized, response } = await checkSessionPermission("CAT_WRITE");
    if (!authorized) return response;

    const { id } = await params;

    // Verificar si el departamento existe
    const depto = await prisma.departamento.findUnique({
      where: { id },
    });

    if (!depto) {
      return NextResponse.json(
        {
          error: "DEPT_NOT_FOUND",
          message: "El departamento no existe.",
        },
        { status: 404 }
      );
    }

    // Verificar si tiene dependencias foráneas (empleados asignados)
    const activeEmployees = await prisma.empleado.count({
      where: { departamentoId: id },
    });

    if (activeEmployees > 0) {
      return NextResponse.json(
        {
          error: "DEPT_HAS_ACTIVE_EMPLOYEES",
          message: "No se puede eliminar el departamento porque cuenta con empleados o activos asignados.",
          totalEmpleados: activeEmployees,
        },
        { status: 400 }
      );
    }

    // Eliminar registro
    await prisma.departamento.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Departamento eliminado exitosamente",
    });
  } catch (error) {
    console.error("[API_DEPARTAMENTOS_ID_DELETE] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al eliminar el departamento.",
      },
      { status: 500 }
    );
  }
}
