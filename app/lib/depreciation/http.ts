import { NextRequest, NextResponse } from "next/server";
import { DepreciationError } from "./errors";

const BASE_URL = "https://activacore.unapex.edu.do/errors";

/** Respuesta de error conforme a RFC 7807. */
export function respuestaError(error: unknown, req?: NextRequest): NextResponse {
  if (error instanceof DepreciationError) {
    return NextResponse.json(
      {
        type: `${BASE_URL}/${error.code.toLowerCase().replace(/_/g, "-")}`,
        title: error.title,
        status: error.status,
        detail: error.message,
        instance: req ? new URL(req.url).pathname : undefined,
        code: error.code,
      },
      { status: error.status }
    );
  }

  console.error("[DEPRECIACION] Error inesperado:", error);
  return NextResponse.json(
    {
      type: `${BASE_URL}/depreciation-run-failed`,
      title: "Error interno",
      status: 500,
      detail: "Ocurrió un error inesperado al procesar la solicitud de depreciación.",
      instance: req ? new URL(req.url).pathname : undefined,
      code: "DEPRECIATION_RUN_FAILED",
    },
    { status: 500 }
  );
}

/** Convierte Decimal/Date a un objeto serializable en JSON. */
export function serializar<T>(valor: T): unknown {
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map((v) => serializar(v));
  if (valor instanceof Date) return valor.toISOString();

  if (typeof valor === "object") {
    const proto = Object.getPrototypeOf(valor);
    if (proto && proto.constructor && proto.constructor.name === "Decimal") {
      return (valor as unknown as { toFixed: (n: number) => string }).toFixed(2);
    }
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = serializar(v);
    }
    return salida;
  }

  return valor;
}

/** Extrae metadatos de red para la auditoría. */
export function metaSolicitud(req: NextRequest): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip");
  const userAgent = req.headers.get("user-agent");
  return {
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  };
}
