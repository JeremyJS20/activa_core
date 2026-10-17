import { auth } from "@/auth";
import { NextResponse } from "next/server";

export type CheckSessionResult =
  | { authorized: false; response: NextResponse; session: any }
  | { authorized: true; response: null; session: any };

export async function checkSessionPermission(
  requiredPermission?: string | string[]
): Promise<CheckSessionResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Autenticacion requerida para acceder a este recurso institucional.",
        },
        { status: 401 }
      ),
      session: null,
    };
  }

  if (requiredPermission) {
    const userPermisos = session.user.permisos || [];
    const isSuperAdmin = session.user.rol?.codigo === "ADMIN" || userPermisos.includes("USER_ADMIN");

    const requiredList = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission = isSuperAdmin || requiredList.some((p) => userPermisos.includes(p));

    if (!hasPermission) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            error: "FORBIDDEN",
            message: `No posee privilegios suficientes. Requiere permiso: ${requiredList.join(" o ")}.`,
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