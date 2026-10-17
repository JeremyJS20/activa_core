import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSecureToken, hashToken } from "@/lib/auth/tokens";
import { authRateLimiter } from "@/lib/auth/rateLimiter";
import { ForgotPasswordSchema } from "@/lib/validations/auth";
import { emailService } from "@/lib/services/email.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = ForgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Formato de correo institucional inválido.",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { correo } = parsed.data;

    // Rate limiting para prevenir spam o ataques de fuerza bruta
    const rateCheck = authRateLimiter.isBlocked(`forgot:${correo}`);
    if (rateCheck.blocked) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: `Demasiadas solicitudes. Espere ${rateCheck.remainingSeconds} segundos antes de reintentar.`,
        },
        { status: 429 }
      );
    }

    const usuario = await prisma.usuario.findUnique({
      where: { correo },
    });

    if (usuario && usuario.estado === "ACTIVO") {
      // 1. Invalidar tokens anteriores no utilizados
      await prisma.passwordResetToken.updateMany({
        where: {
          usuarioId: usuario.id,
          utilizado: false,
        },
        data: { utilizado: true },
      });

      // 2. Generar nuevo token seguro y computar hash SHA-256
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiraAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

      // 3. Persistir en base de datos
      await prisma.passwordResetToken.create({
        data: {
          usuarioId: usuario.id,
          tokenHash,
          expiraAt,
          utilizado: false,
        },
      });

      // 4. Enviar notificación por correo institucional
      await emailService.sendPasswordResetEmail(usuario.correo, usuario.nombre, rawToken);
    } else {
      // Registrar intento para correo no existente o inactivo
      authRateLimiter.recordFailedAttempt(`forgot:${correo}`);
    }

    // Mensaje neutro para evitar enumeración de usuarios
    return NextResponse.json({
      message:
        "Si el correo ingresado coincide con una cuenta activa, recibirá un enlace para restablecer su contraseña en breve.",
    });
  } catch (error) {
    console.error("Error en forgot-password:", error);
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Ocurrió un error inesperado al procesar la solicitud de recuperación.",
      },
      { status: 500 }
    );
  }
}