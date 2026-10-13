import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const userPermisos = req.auth?.user?.permisos || [];

  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isPublicRoute =
    nextUrl.pathname === "/login" ||
    nextUrl.pathname.startsWith("/recuperar-contrasena") ||
    nextUrl.pathname.startsWith("/recuperar-clave") ||
    nextUrl.pathname.startsWith("/restablecer-contrasena") ||
    nextUrl.pathname.startsWith("/restablecer-clave");

  // 1. Eximir rutas internas de autenticación de Auth.js
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // 2. Redirigir al dashboard si el usuario ya está autenticado e intenta acceder a login
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // 3. Permitir rutas públicas para usuarios no autenticados
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // 4. Bloquear solicitudes no autenticadas hacia rutas protegidas
  if (!isLoggedIn) {
    if (nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Autenticación requerida para acceder a este recurso institucional.",
        },
        { status: 401 }
      );
    }
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
  }

  // 5. Validación RBAC para APIs de administración de usuarios y roles
  if (
    nextUrl.pathname.startsWith("/api/usuarios") ||
    nextUrl.pathname.startsWith("/admin/usuarios")
  ) {
    if (!userPermisos.includes("USER_ADMIN")) {
      if (nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: "FORBIDDEN",
            message: "No posee privilegios suficientes (requiere permiso USER_ADMIN).",
          },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/?error=forbidden", nextUrl));
    }
  }

  // 6. Validación RBAC para mutaciones en Catálogos Base
  if (
    (nextUrl.pathname.startsWith("/api/departamentos") ||
      nextUrl.pathname.startsWith("/api/empleados") ||
      nextUrl.pathname.startsWith("/api/tipos-activos")) &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(req.method)
  ) {
    if (!userPermisos.includes("CAT_WRITE") && !userPermisos.includes("USER_ADMIN")) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "No posee privilegios de mutación en catálogos (requiere permiso CAT_WRITE).",
        },
        { status: 403 }
      );
    }
  }

  // 7. Validación RBAC para mutaciones en Activos Fijos
  if (
    nextUrl.pathname.startsWith("/api/activos") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(req.method)
  ) {
    if (!userPermisos.includes("ACT_OPERATE") && !userPermisos.includes("USER_ADMIN")) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "No posee privilegios para registrar o alterar activos (requiere permiso ACT_OPERATE).",
        },
        { status: 403 }
      );
    }
  }

  // 8. Validación RBAC para ejecución contable o de depreciación
  if (
    (nextUrl.pathname.startsWith("/api/depreciaciones") ||
      nextUrl.pathname.startsWith("/api/contabilidad")) &&
    ["POST", "PUT", "DELETE"].includes(req.method)
  ) {
    if (
      !userPermisos.includes("DEP_EXECUTE") &&
      !userPermisos.includes("ACC_DISPATCH") &&
      !userPermisos.includes("USER_ADMIN")
    ) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "No posee privilegios para cálculo de depreciación o asientos contables.",
        },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};