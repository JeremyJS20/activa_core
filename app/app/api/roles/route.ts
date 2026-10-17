import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  const _ = req.nextUrl;
  try {
    const authCheck = await checkSessionPermission();
    if (!authCheck.authorized) return authCheck.response!;

    const roles = await prisma.rol.findMany({
      orderBy: { nombre: "asc" },
      include: {
        permisos: {
          include: {
            permiso: true,
          },
        },
        _count: {
          select: { usuarios: true },
        },
      },
    });

    const formatted = roles.map((rol) => ({
      id: rol.id,
      codigo: rol.codigo,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      esSistema: rol.esSistema,
      estado: rol.estado,
      totalUsuarios: rol._count.usuarios,
      totalPermisos: rol.permisos.length,
      permisos: rol.permisos.map((rp) => rp.permiso.codigo),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error en GET /api/roles:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al consultar los roles.",
      },
      { status: 500 }
    );
  }
}