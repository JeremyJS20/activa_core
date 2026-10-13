import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/crypto";
import { authRateLimiter } from "@/lib/auth/rateLimiter";
import { ResetPasswordSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "PASSWORD_POLICY_VIOLATION",
          message: "La contraseña no satisface las políticas de seguridad o las contraseñas no coinciden.",
          issues: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const { token, nuevaPassword } = parsed.data;
    const tokenHash = hashToken(token);

    // Buscar token en base de datos con usuario relacionado
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { usuario: true },
    });

    const now = new Date();
    if (!resetRecord || resetRecord.utilizado || resetRecord.expiraAt < now) {
      return NextResponse.json(
        {
          error: "INVALID_OR_EXPIRED_RESET_TOKEN",
          message: "El enlace de recuperación es inválido o ha expirado.",
        },
        { status: 400 }
      );
    }

    if (resetRecord.usuario.estado !== "ACTIVO") {
      return NextResponse.json(
        {
          error: "USER_ACCOUNT_INACTIVE",
          message: "Su cuenta institucional se encuentra inactiva. Contacte al administrador.",
        },
        { status: 403 }
      );
    }

    // Hashear nueva contraseña con bcrypt (cost factor 10)
    const newHash = await hashPassword(nuevaPassword);

    // Transacción atómica: actualizar contraseña y marcar token como consumido
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: resetRecord.usuarioId },
        data: { passwordHash: newHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { utilizado: true },
      }),
    ]);

    // Limpiar bloqueo y conteo de intentos fallidos
    authRateLimiter.reset(resetRecord.usuario.correo);

    return NextResponse.json({
      success: true,
      message: "Contraseña restablecida exitosamente. Inicie sesión con su nueva clave.",
    });
  } catch (error) {
    console.error("Error en reset-password:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al restablecer la contraseña.",
      },
      { status: 500 }
    );
  }
}