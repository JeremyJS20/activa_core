import { NextRequest, NextResponse } from "next/server";
import { checkSessionPermission, type CheckSessionResult } from "@/lib/auth/rbac";

export type ReportesGuardResult =
  | { authorized: true; session: CheckSessionResult["session"]; response: null }
  | { authorized: false; session?: unknown; response: NextResponse };

function methodNotAllowed(): NextResponse {
  return NextResponse.json(
    {
      type: "https://activacore.unapec.edu.do/problems/method-not-allowed",
      title: "METHOD_NOT_ALLOWED",
      status: 405,
      detail: "El sub-módulo de reportes es de solo lectura: solo se permite GET.",
    },
    { status: 405, headers: { Allow: "GET", "Content-Type": "application/problem+json" } }
  );
}

/**
 * Guard único de los endpoints del Sub-módulo 04 (NFR-REP-001).
 *
 * Orden de verificación:
 *   1. Método distinto de GET → 405 Method Not Allowed (Allow: GET).
 *   2. Sin sesión válida → 401.
 *   3. Sesión sin permiso REP_READ → 403.
 *
 * Es un dual-check: el proxy/middleware hace el gate de borde y cada handler
 * vuelve a validar aquí (nunca se confía en una única capa).
 */
export async function requireReportesPermission(req: NextRequest): Promise<ReportesGuardResult> {
  if (req.method !== "GET") {
    return { authorized: false, response: methodNotAllowed() };
  }

  const result = await checkSessionPermission("REP_READ");
  if (!result.authorized) {
    return { authorized: false, session: result.session, response: result.response };
  }

  return { authorized: true, session: result.session, response: null };
}
