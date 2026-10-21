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

  // 1. Eximir rutas internas de autenticacion de Auth.js
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // 2. Redirigir al dashboard si el usuario ya esta autenticado e intenta acceder a login
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // 3. Permitir rutas publicas para usuarios no autenticados
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // 4. Bloquear solicitudes no autenticadas hacia rutas protegidas
  if (!isLoggedIn) {
    if (nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Autenticacion requerida para acceder a este recurso institucional.",
        },
        { status: 401 }
      );
    }
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
  }

  // 5. Validacion RBAC para APIs de administracion de usuarios y roles
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

  // 6. Validacion RBAC para mutaciones en Catalogos Base
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
          message: "No posee privilegios de mutacion en catalogos (requiere permiso CAT_WRITE).",
        },
        { status: 403 }
      );
    }
  }

  // 7. Validacion RBAC para mutaciones en Activos Fijos
  if (
    nextUrl.pathname.startsWith("/api/activos") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(req.method)
  ) {
    const hasAssetPermission =
      userPermisos.includes("ACT_OPERATE") ||
      userPermisos.includes("ACT_CREATE") ||
      userPermisos.includes("ACT_UPDATE") ||
      userPermisos.includes("ACT_TRANSFER") ||
      userPermisos.includes("ACT_DISPOSE") ||
      userPermisos.includes("USER_ADMIN");

    if (!hasAssetPermission) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "No posee privilegios para registrar o alterar activos (requiere permiso ACT_OPERATE).",
        },
        { status: 403 }
      );
    }
  }

  // 8. Validacion RBAC para ejecucion contable o de depreciacion
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
          message: "No posee privilegios para calculo de depreciacion o asientos contables.",
        },
        { status: 403 }
      );
    }
  }

  // 9. Reportes (Sub-04): SOLO LECTURA con permiso REP_READ
  if (nextUrl.pathname.startsWith("/api/reportes")) {
    if (req.method !== "GET") {
      return NextResponse.json(
        {
          type: "https://activacore.unapec.edu.do/problems/method-not-allowed",
          title: "METHOD_NOT_ALLOWED",
          status: 405,
          detail: "El sub-modulo de reportes es de solo lectura: solo se permite GET.",
        },
        { status: 405, headers: { Allow: "GET", "Content-Type": "application/problem+json" } }
      );
    }

    const isSuperAdmin = req.auth?.user?.rol?.codigo === "ADMIN" || userPermisos.includes("USER_ADMIN");
    if (!isSuperAdmin && !userPermisos.includes("REP_READ")) {
      return NextResponse.json(
        {
          type: "https://activacore.unapec.edu.do/problems/forbidden",
          title: "FORBIDDEN",
          status: 403,
          detail: "Acceso denegado. Permisos insuficientes (requiere REP_READ).",
        },
        { status: 403, headers: { "Content-Type": "application/problem+json" } }
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};