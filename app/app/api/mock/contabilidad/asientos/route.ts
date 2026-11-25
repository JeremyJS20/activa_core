import { NextRequest, NextResponse } from "next/server";
import { AsientoPayloadSchema } from "@/lib/schemas/integracion";
import {
  obtenerConfirmacion,
  registrarConfirmacion,
} from "@/lib/integracion/mock-store";

/**
 * Simulador interno del Web Service de Contabilidad (solo dev/demo/E2E).
 * Contrato: 201 confirmación institucional; 400/409/500 simulables por header.
 * No escribe en `asientos_contables` ni en `bitacora_envio_ws`.
 */

const MENSAJE_500 = "Falla simulada del servidor contable";

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function mockHabilitado(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_WS_MOCK === "true";
}

export async function POST(req: NextRequest) {
  if (!mockHabilitado()) {
    return json({ codigo: "NOT_FOUND", mensaje: "Mock deshabilitado en producción." }, 404);
  }

  const escenario = req.headers.get("x-mock-scenario");
  if (escenario && !["400", "409", "500"].includes(escenario)) {
    return json(
      {
        codigo: "INVALID_MOCK_SCENARIO",
        mensaje: "x-mock-scenario debe ser 400, 409 o 500.",
      },
      400
    );
  }

  const delayRaw = req.headers.get("x-mock-delay-ms");
  const delay = delayRaw === null ? 0 : Number(delayRaw);
  if (delayRaw !== null && (!Number.isInteger(delay) || delay < 0 || delay > 30000)) {
    return json(
      {
        codigo: "INVALID_MOCK_SCENARIO",
        mensaje: "x-mock-delay-ms debe ser un entero entre 0 y 30000.",
      },
      400
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(
      {
        codigo: "VALIDATION_ERROR",
        errores: [{ path: "body", message: "El cuerpo debe ser JSON válido." }],
      },
      400
    );
  }

  const parsed = AsientoPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        codigo: "VALIDATION_ERROR",
        errores: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      400
    );
  }

  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (escenario === "400") {
    return json(
      {
        codigo: "VALIDATION_ERROR",
        errores: [
          {
            path: "lineas.0.cuentaContable",
            message: "Escenario 400 simulado: cuenta contable rechazada.",
          },
        ],
      },
      400
    );
  }

  if (escenario === "500") {
    return json({ codigo: "WS_SERVER_ERROR", mensaje: MENSAJE_500 }, 500);
  }

  const numeroAsiento = parsed.data.numeroAsiento;
  const existente = obtenerConfirmacion(numeroAsiento);

  if (escenario === "409") {
    const confirmacion = existente ?? registrarConfirmacion(numeroAsiento);
    return json(
      {
        codigo: "ASIENTO_ALREADY_SENT",
        numeroAsiento,
        numeroConfirmacion: confirmacion.numeroConfirmacion,
        mensaje: "El asiento ya fue registrado en Contabilidad General.",
      },
      409
    );
  }

  if (existente) {
    return json(
      {
        codigo: "ASIENTO_ALREADY_SENT",
        numeroAsiento,
        numeroConfirmacion: existente.numeroConfirmacion,
        mensaje: "El asiento ya fue registrado en Contabilidad General.",
      },
      409
    );
  }

  const confirmacion = registrarConfirmacion(numeroAsiento);
  return json(
    {
      numeroAsiento,
      numeroConfirmacion: confirmacion.numeroConfirmacion,
      codigoRespuesta: "201",
      mensaje: "Asiento registrado en Contabilidad General",
      fechaRecepcion: confirmacion.fechaRecepcion,
    },
    201
  );
}
