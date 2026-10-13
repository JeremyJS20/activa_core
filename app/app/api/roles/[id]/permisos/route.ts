import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCheck = await checkSessionPermission();
    if (!authCheck.authorized) return authCheck.response!;

    const rol = await prisma.rol.findUnique({
      where: { id },
      include: {
        permisos: {
          include: {
            permiso: true,
          },
        },
      },
    });

    if (!rol) {
      return NextResponse.json(
        { error: "ROLE_NOT_FOUND", message: "Rol no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      rol: {
        id: rol.id,
        codigo: rol.codigo,
        nombre: rol.nombre,
      },
      permisos: rol.permisos.map((rp) => rp.permiso),
    });
  } catch (error) {
    console.error("Error en GET /api/roles/[id]/permisos:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar los permisos del rol.",
      },
      { status: 500 }
    );
  }
}