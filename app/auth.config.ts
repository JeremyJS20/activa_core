import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nombre = user.nombre;
        token.correo = user.correo;
        token.rol = user.rol;
        token.permisos = user.permisos;
        token.empleadoId = user.empleadoId;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.nombre = token.nombre as string;
        session.user.correo = token.correo as string;
        session.user.rol = token.rol as { id: string; codigo: string; nombre: string };
        session.user.permisos = (token.permisos as string[]) || [];
        session.user.empleadoId = token.empleadoId as string | null | undefined;
      }
      return session;
    },
  },
  providers: [],
};