import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission, type CheckSessionResult } from "@/lib/auth/rbac";
import { IntegrationError } from "@/lib/integracion/errors";
import { respuestaIntegracionError } from "@/lib/integracion/http";

export type ContabilidadGuardResult =
  | { authorized: true; session: CheckSessionResult["session"]; response: null }
  | { authorized: false; session?: unknown; response: NextResponse };

async function requirePermisos(
  req: NextRequest,
  permisos: string[]
): Promise<ContabilidadGuardResult> {
  const result = await checkSessionPermission(permisos);
  if (result.authorized) {
    return { authorized: true, session: result.session, response: null };
  }

  const status = result.response.status;
  const error =
    status === 401
      ? new IntegrationError("UNAUTHORIZED")
      : new IntegrationError(
          "FORBIDDEN",
          `No posee privilegios suficientes. Requiere permiso: ${permisos.join(" o ")}.`
        );
  return { authorized: false, session: result.session, response: respuestaIntegracionError(error, req) };
}

/** Lectura de la consola/detalle: operadores (INT_MANAGE/ACC_POST_SEND) o auditores (ACC_LOG_READ). */
export function requireContabilidadRead(req: NextRequest): Promise<ContabilidadGuardResult> {
  return requirePermisos(req, ["INT_MANAGE", "ACC_POST_SEND", "ACC_LOG_READ"]);
}

/** Despacho, reintento y lote. */
export function requireContabilidadManage(req: NextRequest): Promise<ContabilidadGuardResult> {
  return requirePermisos(req, ["INT_MANAGE", "ACC_POST_SEND"]);
}

/** Historial completo de bitácora: solo auditores. */
export function requireContabilidadLog(req: NextRequest): Promise<ContabilidadGuardResult> {
  return requirePermisos(req, ["ACC_LOG_READ"]);
}

export interface UsuarioSesionIntegracion {
  id: string;
  correo: string;
}

/** Extrae el usuario responsable de la sesión ya validada por el guard. */
export function usuarioDesdeSesion(session: unknown): UsuarioSesionIntegracion {
  const user = (session as { user?: { id?: unknown; correo?: unknown } } | null)?.user;
  if (!user || typeof user.id !== "string" || typeof user.correo !== "string") {
    throw new IntegrationError("UNAUTHORIZED");
  }
  return { id: user.id, correo: user.correo };
}
