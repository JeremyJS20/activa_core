import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { IntegrationError } from "./errors";

const BASE_URL = "https://activacore.unapec.edu.do/problems";

/** Identificador de correlación por solicitud/intento. */
export function nuevaCorrelationId(): string {
  return randomUUID();
}

/** Respuesta de error conforme a RFC 7807 (`application/problem+json`). */
export function respuestaIntegracionError(error: unknown, req?: NextRequest): NextResponse {
  if (error instanceof IntegrationError) {
    const body: Record<string, unknown> = {
      type: `${BASE_URL}/${error.code.toLowerCase().replace(/_/g, "-")}`,
      title: error.code,
      status: error.status,
      detail: error.message,
      instance: req ? new URL(req.url).pathname : undefined,
      code: error.code,
    };
    if (error.details !== undefined) body.errors = error.details;

    return NextResponse.json(body, {
      status: error.status,
      headers: { "Content-Type": "application/problem+json" },
    });
  }

  console.error("[INTEGRACION-WS] Error inesperado:", error);
  return NextResponse.json(
    {
      type: `${BASE_URL}/integration-internal-error`,
      title: "INTEGRATION_INTERNAL_ERROR",
      status: 500,
      detail: "Ocurrió un error inesperado al procesar la solicitud de integración contable.",
      instance: req ? new URL(req.url).pathname : undefined,
      code: "INTEGRATION_INTERNAL_ERROR",
    },
    { status: 500, headers: { "Content-Type": "application/problem+json" } }
  );
}

/** Convierte Decimal/Date a un objeto serializable en JSON (importes string 2 decimales). */
export function serializarIntegracion<T>(valor: T): unknown {
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map((item) => serializarIntegracion(item));
  if (valor instanceof Date) return valor.toISOString();
  if (Prisma.Decimal.isDecimal(valor)) return (valor as Prisma.Decimal).toFixed(2);
  if (typeof valor === "object") {
    const salida: Record<string, unknown> = {};
    for (const [clave, item] of Object.entries(valor as Record<string, unknown>)) {
      salida[clave] = serializarIntegracion(item);
    }
    return salida;
  }
  return valor;
}

/** Metadatos de red para auditoría (IP/User-Agent). */
export function metaSolicitud(req: NextRequest): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip");
  const userAgent = req.headers.get("user-agent");
  return {
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  };
}
