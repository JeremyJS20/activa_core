import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { EmployeeUpdateSchema } from "@/lib/schemas/employee.schema";
import { normalizarDocumento, validarIdentidadDominicana } from "@/lib/validators/identity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { authorized, response } = await checkSessionPermission("CAT_READ");
    if (!authorized) return response;

    const { id } = await params;

    const emp = await prisma.empleado.findUnique({
      where: { id },
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
    });

    if (!emp) {
      return NextResponse.json(
        {
          error: "EMPLOYEE_NOT_FOUND",
          message: "El colaborador solicitado no existe en el sistema.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("[API_EMPLEADOS_ID_GET] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar el colaborador.",
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

    const existing = await prisma.empleado.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error: "EMPLOYEE_NOT_FOUND",
          message: "El colaborador no existe.",
        },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);

    // Validación directa de cédula si se intenta actualizar
    if (body?.cedula) {
      const tipo = body.tipoPersona || existing.tipoPersona || "FISICA";
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

    const parsed = EmployeeUpdateSchema.safeParse(body);
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

    let cedulaNormalizada: string | undefined = undefined;

    // 1. Validar unicidad de cédula si se modifica
    if (cedula) {
      cedulaNormalizada = normalizarDocumento(cedula);
      if (cedulaNormalizada !== existing.cedula) {
        const duplicateCedula = await prisma.empleado.findFirst({
          where: {
            cedula: cedulaNormalizada,
            NOT: { id },
          },
        });

        if (duplicateCedula) {
          return NextResponse.json(
            {
              error: "CEDULA_DUPLICATE",
              message: "Ya existe otro colaborador con este documento de identidad.",
            },
            { status: 409 }
          );
        }
      }
    }

    // 2. Validar departamento si se modifica
    if (departamentoId && departamentoId !== existing.departamentoId) {
      const depto = await prisma.departamento.findUnique({
        where: { id: departamentoId },
      });

      if (!depto) {
        return NextResponse.json(
          {
            error: "DEPARTMENT_NOT_FOUND",
            message: "El departamento asignado no existe.",
          },
          { status: 404 }
        );
      }
    }

    // 3. Advertencia si se inactiva a un colaborador que es responsable departamental
    let warning: { code: string; message: string; departamentos: any[] } | null = null;
    if (estado === "INACTIVO" && existing.estado !== "INACTIVO") {
      const deptosResponsable = await prisma.departamento.findMany({
        where: { responsableId: id },
        select: { id: true, codigo: true, descripcion: true },
      });

      if (deptosResponsable.length > 0) {
        warning = {
          code: "EMPLOYEE_IS_DEPARTMENT_HEAD",
          message: `Atención: El colaborador figura como responsable de: ${deptosResponsable
            .map((d) => `${d.codigo} - ${d.descripcion}`)
            .join(", ")}. Se sugiere reasignar el directivo responsable.`,
          departamentos: deptosResponsable,
        };
      }
    }

    // 4. Actualizar en base de datos
    const updated = await prisma.empleado.update({
      where: { id },
      data: {
        ...(nombre ? { nombre: nombre.trim() } : {}),
        ...(apellido ? { apellido: apellido.trim() } : {}),
        ...(tipoPersona ? { tipoPersona } : {}),
        ...(cedulaNormalizada ? { cedula: cedulaNormalizada } : {}),
        ...(departamentoId ? { departamentoId } : {}),
        ...(cargo ? { cargo: cargo.trim() } : {}),
        ...(correo !== undefined ? { correo: correo ? correo.trim().toLowerCase() : null } : {}),
        ...(telefono !== undefined ? { telefono: telefono ? telefono.trim() : null } : {}),
        ...(fechaIngreso ? { fechaIngreso } : {}),
        ...(estado ? { estado } : {}),
      },
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
    });

    return NextResponse.json({
      id: updated.id,
      codigo: updated.codigo,
      nombre: updated.nombre,
      apellido: updated.apellido,
      tipoPersona: updated.tipoPersona,
      cedula: updated.cedula,
      departamentoId: updated.departamentoId,
      departamento: updated.departamento,
      cargo: updated.cargo,
      correo: updated.correo,
      telefono: updated.telefono,
      fechaIngreso: updated.fechaIngreso,
      estado: updated.estado,
      esResponsableDe: updated.departamentosResponsable,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    console.error("[API_EMPLEADOS_ID_PUT] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al actualizar el colaborador.",
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

    const existing = await prisma.empleado.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error: "EMPLOYEE_NOT_FOUND",
          message: "El colaborador no existe.",
        },
        { status: 404 }
      );
    }

    // 1. Restringir borrado si es responsable activo de algún departamento
    const deptosCount = await prisma.departamento.count({
      where: { responsableId: id },
    });

    if (deptosCount > 0) {
      return NextResponse.json(
        {
          error: "EMPLOYEE_IS_ACTIVE_RESPONSIBLE",
          message: "No se puede eliminar el colaborador porque figura como responsable de uno o más departamentos universitarios.",
          totalDepartamentos: deptosCount,
        },
        { status: 400 }
      );
    }

    // 2. Intentar borrado físico o inactivación lógica ante claves foráneas
    try {
      await prisma.empleado.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: "Colaborador eliminado exitosamente",
      });
    } catch {
      const inactivated = await prisma.empleado.update({
        where: { id },
        data: { estado: "INACTIVO" },
      });

      return NextResponse.json({
        success: true,
        message: "Colaborador inactivado lógicamente por contar con registros asociados.",
        estado: inactivated.estado,
      });
    }
  } catch (error) {
    console.error("[API_EMPLEADOS_ID_DELETE] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al eliminar o inactivar el colaborador.",
      },
      { status: 500 }
    );
  }
}
