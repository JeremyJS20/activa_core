import { IntegrationError } from "@/lib/integracion/errors";
import { nuevaCorrelationId } from "@/lib/integracion/http";
import {
  AsientoPayloadSchema,
  WsErrorResponseSchema,
  WsSuccessResponseSchema,
  type AsientoPayload,
} from "@/lib/schemas/integracion";

/**
 * Cliente HTTP del Web Service de Contabilidad.
 *
 * No lanza por respuestas HTTP del WS: retorna un `WsDispatchResult` para que el
 * servicio de integración persista el estado y la bitácora. Solo lanza
 * `IntegrationError` por configuración inválida o payload saliente inválido
 * (antes de emitir la petición).
 */

export type WsResultado = "EXITOSO" | "RECHAZADO" | "ERROR_RED" | "TIMEOUT" | "RECONCILIADO";

export interface WsDispatchResult {
  ok: boolean;
  httpStatus: number | null;
  codigo: string;
  mensaje: string;
  transaccionWsId?: string;
  respuesta?: unknown;
  resultado: WsResultado;
  duracionMs: number;
  /** URL efectiva invocada (sin credenciales), para la bitácora. */
  endpoint: string;
  /** Correlation-id enviado en el header `x-correlation-id`. */
  correlationId: string;
}

export interface WsClientOptions {
  /** Permite inyectar un fetch en pruebas. */
  fetchImpl?: typeof fetch;
  /** Override del timeout (ms); default `WS_CONTABILIDAD_TIMEOUT_MS` o 10 000. */
  timeoutMs?: number;
  /** Override de la URL del WS. */
  url?: string;
  /** Override de la API key (nunca se serializa). */
  apiKey?: string;
  /** Override del header de autenticación (default `Authorization`). */
  authHeader?: string;
  /** Permite fijar el correlation-id en pruebas. */
  correlationId?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;

function urlMockPorDefecto(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/mock/contabilidad/asientos`;
}

function resolverUrl(options: WsClientOptions): string {
  const configurada = (options.url ?? process.env.WS_CONTABILIDAD_URL)?.trim();
  const url = configurada && configurada !== "" ? configurada : urlMockPorDefecto();
  if (!url) {
    throw new IntegrationError(
      "WS_CONFIG_ERROR",
      "Falta configurar WS_CONTABILIDAD_URL para el entorno actual."
    );
  }
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
    throw new IntegrationError(
      "WS_CONFIG_ERROR",
      "En producción el Web Service de Contabilidad debe usar HTTPS."
    );
  }
  return url;
}

function resolverTimeout(options: WsClientOptions): number {
  const raw = options.timeoutMs ?? Number(process.env.WS_CONTABILIDAD_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isInteger(raw) || raw < MIN_TIMEOUT_MS || raw > MAX_TIMEOUT_MS) {
    throw new IntegrationError(
      "WS_CONFIG_ERROR",
      `WS_CONTABILIDAD_TIMEOUT_MS debe ser un entero entre ${MIN_TIMEOUT_MS} y ${MAX_TIMEOUT_MS} ms.`
    );
  }
  return raw;
}

function resolverAuth(options: WsClientOptions): Record<string, string> {
  const apiKey = options.apiKey ?? process.env.WS_CONTABILIDAD_API_KEY;
  if (!apiKey || apiKey.trim() === "") return {};

  const header = (options.authHeader ?? process.env.WS_CONTABILIDAD_AUTH_HEADER ?? "Authorization").trim();
  const valor = header.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey;
  return { [header]: valor };
}

function parseJson(texto: string): { ok: true; value: unknown } | { ok: false } {
  if (!texto.trim()) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(texto) as unknown };
  } catch {
    return { ok: false };
  }
}

function extraerConfirmacion(json: unknown): string | undefined {
  if (!json || typeof json !== "object" || !("numeroConfirmacion" in json)) return undefined;
  const valor = (json as { numeroConfirmacion?: unknown }).numeroConfirmacion;
  return typeof valor === "string" && valor.trim() !== "" ? valor : undefined;
}

function mensajeDeRespuesta(json: unknown, texto: string, fallback: string): string {
  const parsed = WsErrorResponseSchema.safeParse(json);
  if (parsed.success) {
    return parsed.data.mensaje ?? parsed.data.errores?.[0]?.message ?? fallback;
  }
  const limpio = texto.trim();
  return limpio !== "" ? limpio.slice(0, 500) : fallback;
}

function esAbort(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: unknown }).name === "AbortError")
  );
}

export async function dispatchAsiento(
  payload: AsientoPayload,
  options: WsClientOptions = {}
): Promise<WsDispatchResult> {
  const validacion = AsientoPayloadSchema.safeParse(payload);
  if (!validacion.success) {
    throw new IntegrationError(
      "VALIDATION_ERROR",
      "El payload del asiento no cumple el contrato del Web Service.",
      validacion.error.issues
    );
  }

  const url = resolverUrl(options);
  const timeoutMs = resolverTimeout(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const correlationId = options.correlationId ?? nuevaCorrelationId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const inicio = Date.now();

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-correlation-id": correlationId,
        ...resolverAuth(options),
      },
      body: JSON.stringify(validacion.data),
      signal: controller.signal,
      cache: "no-store",
    });

    const duracionMs = Date.now() - inicio;
    const texto = await response.text();
    const parsed = parseJson(texto);
    const json = parsed.ok ? parsed.value : null;

    if (response.status === 200 || response.status === 201) {
      const exitoso = WsSuccessResponseSchema.safeParse(json);
      if (!exitoso.success) {
        return {
          ok: false,
          httpStatus: response.status,
          codigo: "WS_INVALID_RESPONSE",
          mensaje: "La respuesta del Web Service no cumple el contrato esperado.",
          respuesta: json ?? texto,
          resultado: "RECHAZADO",
          duracionMs,
          endpoint: url,
          correlationId,
        };
      }
      return {
        ok: true,
        httpStatus: response.status,
        codigo: exitoso.data.codigoRespuesta ?? String(response.status),
        mensaje: exitoso.data.mensaje ?? "Asiento registrado en Contabilidad General.",
        transaccionWsId: exitoso.data.numeroConfirmacion,
        respuesta: exitoso.data,
        resultado: "EXITOSO",
        duracionMs,
        endpoint: url,
        correlationId,
      };
    }

    if (response.status === 409) {
      const confirmacion = extraerConfirmacion(json);
      if (confirmacion) {
        return {
          ok: true,
          httpStatus: 409,
          codigo: "409",
          mensaje: mensajeDeRespuesta(json, texto, "Asiento ya registrado; confirmación reconciliada."),
          transaccionWsId: confirmacion,
          respuesta: json ?? texto,
          resultado: "RECONCILIADO",
          duracionMs,
          endpoint: url,
          correlationId,
        };
      }
      return {
        ok: false,
        httpStatus: 409,
        codigo: "WS_DUPLICATE_UNCONFIRMED",
        mensaje: mensajeDeRespuesta(
          json,
          texto,
          "El Web Service reportó un duplicado sin número de confirmación."
        ),
        respuesta: json ?? texto,
        resultado: "RECHAZADO",
        duracionMs,
        endpoint: url,
        correlationId,
      };
    }

    if (response.status === 400) {
      return {
        ok: false,
        httpStatus: 400,
        codigo: "WS_REJECTED",
        mensaje: mensajeDeRespuesta(json, texto, "El Web Service rechazó el asiento (HTTP 400)."),
        respuesta: json ?? texto,
        resultado: "RECHAZADO",
        duracionMs,
        endpoint: url,
        correlationId,
      };
    }

    if (response.status >= 500) {
      return {
        ok: false,
        httpStatus: response.status,
        codigo: "WS_SERVER_ERROR",
        mensaje: mensajeDeRespuesta(json, texto, "El Web Service respondió con un error interno."),
        respuesta: json ?? texto,
        resultado: "RECHAZADO",
        duracionMs,
        endpoint: url,
        correlationId,
      };
    }

    return {
      ok: false,
      httpStatus: response.status,
      codigo: "WS_REJECTED",
      mensaje: mensajeDeRespuesta(json, texto, `Respuesta HTTP no esperada: ${response.status}.`),
      respuesta: json ?? texto,
      resultado: "RECHAZADO",
      duracionMs,
      endpoint: url,
      correlationId,
    };
  } catch (error) {
    const duracionMs = Date.now() - inicio;

    if (esAbort(error)) {
      return {
        ok: false,
        httpStatus: null,
        codigo: "WS_TIMEOUT",
        mensaje: `El Web Service no respondió dentro de ${timeoutMs} ms.`,
        resultado: "TIMEOUT",
        duracionMs,
        endpoint: url,
        correlationId,
      };
    }

    if (error instanceof IntegrationError) throw error;

    return {
      ok: false,
      httpStatus: null,
      codigo: "WS_NETWORK_ERROR",
      mensaje: "No fue posible establecer comunicación con el Web Service de Contabilidad.",
      respuesta: error instanceof Error ? error.message : undefined,
      resultado: "ERROR_RED",
      duracionMs,
      endpoint: url,
      correlationId,
    };
  } finally {
    clearTimeout(timer);
  }
}
