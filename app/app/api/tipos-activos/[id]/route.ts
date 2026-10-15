import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { AssetTypeUpdateSchema } from "@/lib/schemas/asset-type.schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { authorized, response } = await checkSessionPermission("CAT_READ");
    if (!authorized) return response;

    const { id } = await params;

    const tipo = await prisma.tipoActivo.findUnique({
      where: { id },
    });

    if (!tipo) {
      return NextResponse.json(
        {
          error: "ASSET_TYPE_NOT_FOUND",
          message: "El tipo de activo solicitado no existe en el sistema.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("[API_TIPOS_ACTIVOS_ID_GET] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar el tipo de activo.",
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

    const existing = await prisma.tipoActivo.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error: "ASSET_TYPE_NOT_FOUND",
          message: "El tipo de activo no existe.",
        },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = AssetTypeUpdateSchema.safeParse(body);

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
      descripcion,
      codigo,
      cuentaContableCompra,
      cuentaContableDepreciacion,
      metodoDepreciacion,
      porcentajeDepreciacionAnual,
      vidaUtilMeses,
      estado,
    } = parsed.data;

    // 1. Validar que las cuentas compra y depreciación resultantes no sean idénticas
    const finalCompra = cuentaContableCompra ?? existing.cuentaContableCompra;
    const finalDeprec = cuentaContableDepreciacion ?? existing.cuentaContableDepreciacion;
    if (finalCompra === finalDeprec) {
      return NextResponse.json(
        {
          error: "ACCOUNTS_CANNOT_BE_IDENTICAL",
          message: "La cuenta de compra y depreciación deben ser distintas.",
        },
        { status: 422 }
      );
    }

    // 2. Validar duplicidad de descripción case-insensitive
    if (descripcion && descripcion.trim().toLowerCase() !== existing.descripcion.toLowerCase()) {
      const duplicateDesc = await prisma.tipoActivo.findFirst({
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
            error: "ASSET_TYPE_DUPLICATE_NAME",
            message: "Ya existe otro tipo de activo con esa descripción.",
          },
          { status: 409 }
        );
      }
    }

    // 3. Validar duplicidad de código
    if (codigo && codigo.trim().toUpperCase() !== existing.codigo) {
      const duplicateCodigo = await prisma.tipoActivo.findFirst({
        where: {
          codigo: codigo.trim().toUpperCase(),
          NOT: { id },
        },
      });

      if (duplicateCodigo) {
        return NextResponse.json(
          {
            error: "ASSET_TYPE_DUPLICATE_CODE",
            message: "El código de tipo de activo ya se encuentra asignado.",
          },
          { status: 409 }
        );
      }
    }

    // 4. Actualizar el registro
    const updated = await prisma.tipoActivo.update({
      where: { id },
      data: {
        ...(descripcion ? { descripcion: descripcion.trim() } : {}),
        ...(codigo ? { codigo: codigo.trim().toUpperCase() } : {}),
        ...(cuentaContableCompra ? { cuentaContableCompra } : {}),
        ...(cuentaContableDepreciacion ? { cuentaContableDepreciacion } : {}),
        ...(metodoDepreciacion ? { metodoDepreciacion } : {}),
        ...(porcentajeDepreciacionAnual !== undefined ? { porcentajeDepreciacionAnual } : {}),
        ...(vidaUtilMeses !== undefined ? { vidaUtilMeses } : {}),
        ...(estado ? { estado } : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      codigo: updated.codigo,
      descripcion: updated.descripcion,
      cuentaContableCompra: updated.cuentaContableCompra,
      cuentaContableDepreciacion: updated.cuentaContableDepreciacion,
      metodoDepreciacion: updated.metodoDepreciacion,
      porcentajeDepreciacionAnual: Number(updated.porcentajeDepreciacionAnual),
      vidaUtilMeses: updated.vidaUtilMeses,
      estado: updated.estado,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[API_TIPOS_ACTIVOS_ID_PUT] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al actualizar el tipo de activo.",
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

    const existing = await prisma.tipoActivo.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error: "ASSET_TYPE_NOT_FOUND",
          message: "El tipo de activo no existe.",
        },
        { status: 404 }
      );
    }

    // Intentar borrado físico; si falla o si se requiere inactivación lógica:
    try {
      await prisma.tipoActivo.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: "Tipo de activo eliminado exitosamente",
      });
    } catch {
      // Inactivación lógica en caso de que existan restricciones foráneas
      const inactivated = await prisma.tipoActivo.update({
        where: { id },
        data: { estado: "INACTIVO" },
      });

      return NextResponse.json({
        success: true,
        message: "Tipo de activo inactivado lógicamente por contar con registros asociados.",
        estado: inactivated.estado,
      });
    }
  } catch (error) {
    console.error("[API_TIPOS_ACTIVOS_ID_DELETE] Error:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al eliminar o inactivar el tipo de activo.",
      },
      { status: 500 }
    );
  }
}
