import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSessionPermission } from "@/lib/auth/rbac";
import { authRateLimiter } from "@/lib/auth/rateLimiter";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCheck = await checkSessionPermission("USER_ADMIN");
    if (!authCheck.authorized) return authCheck.response!;

    const usuario = await prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "Usuario a desbloquear no encontrado." },
        { status: 404 }
      );
    }

    // Limpiar bloqueo en el rate limiter de memoria
    authRateLimiter.reset(usuario.correo);
    authRateLimiter.reset(`forgot:${usuario.correo}`);

    return NextResponse.json({
      success: true,
      message: "Cuenta desbloqueada exitosamente",
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/usuarios/[id]/unlock:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al desbloquear la cuenta.",
      },
      { status: 500 }
    );
  }
}