import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { DisposeAssetSchema } from "@/lib/schemas/asset.schema";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCheck = await checkSessionPermission();
    if (!authCheck.authorized) return authCheck.response;
    const { session } = authCheck;

    // Restricción exclusiva para rol ADMIN o permiso USER_ADMIN
    const isAdmin =
      session.user?.rol?.codigo === "ADMIN" ||
      session.user?.permisos?.includes("USER_ADMIN");

    if (!isAdmin) {
      return NextResponse.json(
        {
          error: "FORBIDDEN_ADMIN_REQUIRED",
          message:
            "La desincorporación formal de activos fijos es una acción reservada exclusivamente para el Administrador del sistema.",
        },
        { status: 403 }
      );
    }

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

    const parsed = DisposeAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Los datos para la desincorporación del activo no son válidos.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const activo = await prisma.activoFijo.findUnique({
      where: { id },
      select: { id: true, estado: true, valorEnLibros: true },
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

    if (activo.estado === "DADO_DE_BAJA" || activo.estado === "VENDIDO") {
      return NextResponse.json(
        {
          error: "ASSET_ALREADY_DISPOSED",
          message: "El activo fijo ya ha sido formalmente desincorporado o dado de baja previamente.",
        },
        { status: 409 }
      );
    }

    const data = parsed.data;
    const fechaBajaFinal = data.fechaBaja ?? new Date();

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.activoFijo.update({
        where: { id: activo.id },
        data: {
          estado: "DADO_DE_BAJA",
        },
      });

      const baja = await tx.historialBaja.create({
        data: {
          activoId: activo.id,
          motivoBaja: data.motivoBaja,
          justificacion: data.justificacion,
          numeroActa: data.numeroActa,
          fechaBaja: fechaBajaFinal,
          valorEnLibrosAlBaja: activo.valorEnLibros,
          autorizadoPorId: session.user.id,
        },
      });

      return {
        activoId: activo.id,
        estado: "DADO_DE_BAJA",
        motivoBaja: baja.motivoBaja,
        valorEnLibrosAlBaja: Number(baja.valorEnLibrosAlBaja),
        fechaBaja: baja.fechaBaja.toISOString().split("T")[0],
        numeroActa: baja.numeroActa,
      };
    });

    return NextResponse.json(resultado, { status: 200 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          error: "ASSET_ALREADY_DISPOSED",
          message: "Ya existe un registro de baja formal para este activo fijo.",
        },
        { status: 409 }
      );
    }

    console.error("Error al procesar baja de activo fijo:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al procesar la desincorporación del activo.",
      },
      { status: 500 }
    );
  }
}