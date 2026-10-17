import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { generarActaEntregaPdf, PdfReceiptError } from "@/lib/services/pdf-receipt.service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
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

    const { searchParams } = new URL(req.url);
    const movimientoId = searchParams.get("movimientoId") ?? undefined;
    if (movimientoId && !UUID_REGEX.test(movimientoId)) {
      return NextResponse.json(
        {
          error: "INVALID_MOVEMENT_ID",
          message: "El identificador del movimiento provisto no tiene formato UUID válido.",
        },
        { status: 400 }
      );
    }

    const { buffer, filename } = await generarActaEntregaPdf({
      activoId: id,
      movimientoId,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof PdfReceiptError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: error.status }
      );
    }

    console.error("Error al generar acta de entrega en PDF:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al emitir el acta de entrega en PDF.",
      },
      { status: 500 }
    );
  }
}