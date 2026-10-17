import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { UpdateAssetSchema } from "@/lib/schemas/asset.schema";
import { assertFinanciallyEditable, FinancialLockError, validarBloqueoFinanciero } from "@/lib/validators/asset-lock";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await checkSessionPermission(["ACT_READ", "ACT_OPERATE"]);
    if (!authCheck.authorized) return authCheck.response;

    const { id } = await params;
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        {
          error: "INVALID_ASSET_ID",
          message: "El identificador del activo provisto no tiene formato UUID válido.",
        },
        { status: 400 }
      );
    }

    const activo = await prisma.activoFijo.findUnique({
      where: { id },
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
            cuentaContableCompra: true,
            cuentaContableDepreciacion: true,
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
        historialBaja: {
          select: {
            id: true,
            motivoBaja: true,
            justificacion: true,
            numeroActa: true,
            fechaBaja: true,
            valorEnLibrosAlBaja: true,
            createdAt: true,
          },
        },
      },
    });

    if (!activo) {
      return NextResponse.json(
        {
          error: "ASSET_NOT_FOUND",
          message: "No se encontró ningún activo fijo institucional con el identificador especificado.",
        },
        { status: 404 }
      );
    }

    const poseeHistorialDepreciacion = await validarBloqueoFinanciero(id);

    return NextResponse.json({
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
      historialBaja: activo.historialBaja
        ? {
            ...activo.historialBaja,
            valorEnLibrosAlBaja: Number(activo.historialBaja.valorEnLibrosAlBaja),
            fechaBaja: activo.historialBaja.fechaBaja.toISOString().split("T")[0],
            createdAt: activo.historialBaja.createdAt.toISOString(),
          }
        : null,
      poseeHistorialDepreciacion,
    });
  } catch (error) {
    console.error("Error al consultar ficha técnica de activo fijo:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar el activo fijo.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await checkSessionPermission(["ACT_UPDATE", "ACT_OPERATE"]);
    if (!authCheck.authorized) return authCheck.response;

    const { id } = await params;
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        {
          error: "INVALID_ASSET_ID",
          message: "El identificador del activo provisto no tiene formato UUID válido.",
        },
        { status: 400 }
      );
    }

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

    const existing = await prisma.activoFijo.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        {
          error: "ASSET_NOT_FOUND",
          message: "No se encontró ningún activo fijo institucional con el identificador especificado.",
        },
        { status: 404 }
      );
    }

    if (existing.estado === "DADO_DE_BAJA" || existing.estado === "VENDIDO") {
      return NextResponse.json(
        {
          error: "ASSET_DISPOSED_CANNOT_EDIT",
          message: "No se pueden actualizar los datos de un activo que ha sido formalmente dado de baja o vendido.",
        },
        { status: 400 }
      );
    }

    // Verificación de bloqueo de campos financieros
    try {
      await assertFinanciallyEditable(id, body);
    } catch (err) {
      if (err instanceof FinancialLockError) {
        return NextResponse.json(
          {
            error: err.code,
            message: err.message,
            camposBloqueados: err.camposBloqueados,
          },
          { status: err.status }
        );
      }
      throw err;
    }

    const parsed = UpdateAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos de actualización física provistos no son válidos.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const data = parsed.data;

    const activoActualizado = await prisma.activoFijo.update({
      where: { id },
      data: {
        descripcion: data.descripcion,
        marca: data.marca !== undefined ? data.marca : undefined,
        modelo: data.modelo !== undefined ? data.modelo : undefined,
        numeroSerie: data.numeroSerie !== undefined ? data.numeroSerie : undefined,
        ubicacionFisica: data.ubicacionFisica !== undefined ? data.ubicacionFisica : undefined,
        color: data.color !== undefined ? data.color : undefined,
        estado: data.estado !== undefined ? data.estado : undefined,
      },
    });

    return NextResponse.json({
      id: activoActualizado.id,
      codigo: activoActualizado.codigo,
      descripcion: activoActualizado.descripcion,
      updatedAt: activoActualizado.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error al actualizar activo fijo:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al actualizar el activo fijo.",
      },
      { status: 500 }
    );
  }
}