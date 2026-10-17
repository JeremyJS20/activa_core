import NextAuth, { CredentialsSignin } from "next-auth";

export class AccountLockedError extends CredentialsSignin {
  code = "bloqueada";
}

export class AccountInactiveError extends CredentialsSignin {
  code = "inactiva";
}
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth/crypto";
import { authRateLimiter } from "@/lib/auth/rateLimiter";
import { LoginSchema } from "@/lib/validations/auth";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credenciales",
      credentials: {
        correo: { label: "Correo Institucional", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const { correo, password } = parsed.data;

        // 1. Validar si la cuenta está bloqueada temporalmente por fuerza bruta
        const rateCheck = authRateLimiter.isBlocked(correo);
        if (rateCheck.blocked) {
          throw new AccountLockedError();
        }

        // 2. Buscar usuario en PostgreSQL vía Prisma con roles y permisos
        const usuario = await prisma.usuario.findUnique({
          where: { correo },
          include: {
            rol: {
              include: {
                permisos: {
                  include: {
                    permiso: true,
                  },
                },
              },
            },
          },
        });

        if (!usuario) {
          const attempt = authRateLimiter.recordFailedAttempt(correo);
          if (attempt.blocked) {
            throw new AccountLockedError();
          }
          return null;
        }

        // 3. Verificar estado de la cuenta
        if (usuario.estado !== "ACTIVO") {
          throw new AccountInactiveError();
        }

        // 4. Comparar hash de contraseña
        const passwordMatches = await comparePassword(password, usuario.passwordHash);
        if (!passwordMatches) {
          const attempt = authRateLimiter.recordFailedAttempt(correo);
          if (attempt.blocked) {
            throw new AccountLockedError();
          }
          return null;
        }

        // 5. Restablecer contador de intentos en caso de éxito
        authRateLimiter.reset(correo);

        // 6. Actualizar timestamp de último login de forma asíncrona
        await prisma.usuario.update({
          where: { id: usuario.id },
          data: { ultimoLoginAt: new Date() },
        });

        // 7. Retornar payload enriquecido con RBAC
        const codigosPermisos = usuario.rol.permisos.map((rp) => rp.permiso.codigo);

        return {
          id: usuario.id,
          nombre: usuario.nombre,
          correo: usuario.correo,
          email: usuario.correo,
          name: usuario.nombre,
          rol: {
            id: usuario.rol.id,
            codigo: usuario.rol.codigo,
            nombre: usuario.rol.nombre,
          },
          permisos: codigosPermisos,
          empleadoId: usuario.empleadoId,
        };
      },
    }),
  ],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "activa-core-secret-key-development-unape-2026",
});