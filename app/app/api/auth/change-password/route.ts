import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { comparePassword, hashPassword } from "@/lib/auth/crypto";
import { ChangePasswordSchema } from "@/lib/validations/auth";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Debe iniciar sesión para cambiar su contraseña.",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = ChangePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "NEW_PASSWORD_INVALID",
          message: "La nueva contraseña no satisface las políticas de seguridad o no coincide.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const { passwordActual, nuevaPassword } = parsed.data;

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id },
    });

    if (!usuario) {
      return NextResponse.json(
        {
          error: "USER_NOT_FOUND",
          message: "El usuario autenticado no existe en la base de datos.",
        },
        { status: 404 }
      );
    }

    // Verificar si la contraseña actual proporcionada es correcta
    const isCurrentValid = await comparePassword(passwordActual, usuario.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        {
          error: "CURRENT_PASSWORD_INCORRECT",
          message: "La contraseña actual no es correcta.",
        },
        { status: 400 }
      );
    }

    // Hashear y actualizar contraseña
    const newHash = await hashPassword(nuevaPassword);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada exitosamente",
    });
  } catch (error) {
    console.error("Error en change-password:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al actualizar la contraseña.",
      },
      { status: 500 }
    );
  }
}