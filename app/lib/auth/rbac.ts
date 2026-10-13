import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function checkSessionPermission(requiredPermission?: string) {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Autenticación requerida para acceder a este recurso institucional.",
        },
        { status: 401 }
      ),
      session: null,
    };
  }

  if (requiredPermission) {
    const userPermisos = session.user.permisos || [];
    const isSuperAdmin = session.user.rol?.codigo === "ADMIN" || userPermisos.includes("USER_ADMIN");

    if (!isSuperAdmin && !userPermisos.includes(requiredPermission)) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: "FORBIDDEN",
            message: `No posee privilegios suficientes. Requiere permiso: ${requiredPermission}.`,
          },
          { status: 403 }
        ),
        session,
      };
    }
  }

  return {
    authorized: true,
    response: null,
    session,
  };
}