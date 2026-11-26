/**
 * Errores de dominio del Sub-módulo 05 (Integración Contable).
 * Se traducen a RFC 7807 en `lib/integracion/http.ts` (Task 1.3).
 */

export type IntegrationErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "METHOD_NOT_ALLOWED"
  | "ASIENTO_NOT_FOUND"
  | "ASIENTO_ALREADY_SENT"
  | "ASIENTO_NOT_RETRYABLE"
  | "ASIENTO_SIN_LINEAS"
  | "ASIENTO_UNBALANCED"
  | "TIPO_INVENTARIO_UNRESOLVED"
  | "WS_TIMEOUT"
  | "WS_NETWORK_ERROR"
  | "WS_REJECTED"
  | "WS_SERVER_ERROR"
  | "WS_DUPLICATE_UNCONFIRMED"
  | "WS_INVALID_RESPONSE"
  | "WS_CONFIG_ERROR"
  | "AUDIT_LOG_FAILED"
  | "BATCH_START_FAILED"
  | "INVALID_MOCK_SCENARIO";

const STATUS_BY_CODE: Record<IntegrationErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  METHOD_NOT_ALLOWED: 405,
  ASIENTO_NOT_FOUND: 404,
  ASIENTO_ALREADY_SENT: 409,
  ASIENTO_NOT_RETRYABLE: 409,
  ASIENTO_SIN_LINEAS: 422,
  ASIENTO_UNBALANCED: 422,
  TIPO_INVENTARIO_UNRESOLVED: 422,
  WS_TIMEOUT: 504,
  WS_NETWORK_ERROR: 502,
  WS_REJECTED: 502,
  WS_SERVER_ERROR: 502,
  WS_DUPLICATE_UNCONFIRMED: 502,
  WS_INVALID_RESPONSE: 502,
  WS_CONFIG_ERROR: 500,
  AUDIT_LOG_FAILED: 500,
  BATCH_START_FAILED: 500,
  INVALID_MOCK_SCENARIO: 400,
};

const DEFAULT_MESSAGES: Record<IntegrationErrorCode, string> = {
  VALIDATION_ERROR: "La solicitud no cumple el contrato esperado.",
  UNAUTHORIZED: "Autenticación requerida para acceder a este recurso institucional.",
  FORBIDDEN: "No posee privilegios suficientes para esta operación.",
  METHOD_NOT_ALLOWED: "Método HTTP no permitido para esta ruta.",
  ASIENTO_NOT_FOUND: "El asiento contable no existe.",
  ASIENTO_ALREADY_SENT: "El asiento ya fue confirmado por Contabilidad y no puede reenviarse.",
  ASIENTO_NOT_RETRYABLE: "El asiento no se encuentra en un estado que permita reintento.",
  ASIENTO_SIN_LINEAS: "El asiento no posee líneas contables para despachar.",
  ASIENTO_UNBALANCED: "El asiento no está cuadrado: la suma de débitos y créditos no coincide.",
  TIPO_INVENTARIO_UNRESOLVED:
    "No fue posible resolver el tipo de inventario de una línea contable de forma determinista.",
  WS_TIMEOUT: "El Web Service de Contabilidad no respondió dentro del tiempo configurado.",
  WS_NETWORK_ERROR: "No fue posible establecer comunicación con el Web Service de Contabilidad.",
  WS_REJECTED: "El Web Service de Contabilidad rechazó el asiento (HTTP 400).",
  WS_SERVER_ERROR: "El Web Service de Contabilidad respondió con un error interno (HTTP 5xx).",
  WS_DUPLICATE_UNCONFIRMED:
    "El Web Service reportó un duplicado sin número de confirmación válido para reconciliar.",
  WS_INVALID_RESPONSE: "La respuesta del Web Service no cumple el contrato esperado.",
  WS_CONFIG_ERROR: "La configuración del Web Service de Contabilidad es inválida o está incompleta.",
  AUDIT_LOG_FAILED: "No fue posible registrar la bitácora del intento; la transición fue revertida.",
  BATCH_START_FAILED: "No fue posible iniciar el despacho en lote.",
  INVALID_MOCK_SCENARIO: "El escenario de simulación solicitado no es válido.",
};

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: IntegrationErrorCode, message?: string, details?: unknown) {
    super(message?.trim() || DEFAULT_MESSAGES[code]);
    this.name = "IntegrationError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function integrationStatusFor(code: IntegrationErrorCode): number {
  return STATUS_BY_CODE[code];
}
