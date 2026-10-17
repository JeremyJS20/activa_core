import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { TransferCustodySchema } from "@/lib/schemas/asset.schema";
import { transferirCustodia, CustodyTransferError } from "@/lib/services/custody-transfer.service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await checkSessionPermission(["ACT_TRANSFER", "ACT_OPERATE"]);
    if (!authCheck.authorized) return authCheck.response;
    const { session } = authCheck;

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

    const parsed = TransferCustodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos de transferencia de custodia no son válidos.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const resultado = await transferirCustodia({
      activoId: id,
      empleadoNuevoId: parsed.data.empleadoNuevoId,
      departamentoNuevoId: parsed.data.departamentoNuevoId,
      motivo: parsed.data.motivo,
      justificacion: parsed.data.justificacion,
      autorizadoPorId: session.user.id,
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    if (error instanceof CustodyTransferError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: error.status }
      );
    }

    console.error("Error al procesar transferencia de custodia:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al procesar el traslado del activo.",
      },
      { status: 500 }
    );
  }
}

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
      select: { id: true, codigo: true, descripcion: true },
    });

    if (!activo) {
      return NextResponse.json(
        {
          error: "ASSET_NOT_FOUND",
          message: "No se encontró el activo fijo institucional especificado.",
        },
        { status: 404 }
      );
    }

    const movimientos = await prisma.historialCustodia.findMany({
      where: { activoId: id },
      orderBy: { createdAt: "desc" },
      include: {
        empleadoAnterior: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            apellido: true,
            cargo: true,
          },
        },
        empleadoNuevo: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            apellido: true,
            cargo: true,
          },
        },
        departamentoAnterior: {
          select: {
            id: true,
            codigo: true,
            descripcion: true,
          },
        },
        departamentoNuevo: {
          select: {
            id: true,
            codigo: true,
            descripcion: true,
          },
        },
        autorizadoPor: {
          select: {
            id: true,
            nombre: true,
            correo: true,
          },
        },
      },
    });

    const historial = movimientos.map((mov) => ({
      id: mov.id,
      motivo: mov.motivo,
      justificacion: mov.justificacion,
      empleadoAnterior: mov.empleadoAnterior,
      empleadoNuevo: mov.empleadoNuevo,
      departamentoAnterior: mov.departamentoAnterior,
      departamentoNuevo: mov.departamentoNuevo,
      autorizadoPor: mov.autorizadoPor,
      createdAt: mov.createdAt.toISOString(),
    }));

    return NextResponse.json({
      activoId: id,
      activo,
      historial,
    });
  } catch (error) {
    console.error("Error al consultar historial de custodia:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar el historial de custodia.",
      },
      { status: 500 }
    );
  }
}
