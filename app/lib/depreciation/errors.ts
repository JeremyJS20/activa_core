export type CodigoError =
  | "VALIDATION_ERROR"
  | "INVALID_PERIOD_FORMAT"
  | "PERIOD_ALREADY_EXISTS"
  | "PERIOD_NOT_FOUND"
  | "PERIOD_NOT_CLOSABLE"
  | "PERIOD_HAS_NO_DETAIL"
  | "PERIOD_ALREADY_CLOSED"
  | "PERIOD_IMMUTABLE"
  | "DEPRECIATION_RUN_IN_PROGRESS"
  | "NO_DEPRECIABLE_ASSETS"
  | "ASSET_TYPE_INVALID_LIFE"
  | "ASSET_TYPE_METHOD_UNSUPPORTED"
  | "ASSET_TYPE_INACTIVE"
  | "RESIDUAL_EXCEEDS_COST"
  | "DEPRECIATION_OVERFLOW"
  | "DEPRECIATION_DETAIL_DUPLICATE"
  | "DEPRECIATION_EXPENSE_ACCOUNT_MISSING"
  | "ASIENTO_UNBALANCED"
  | "ASIENTO_ALREADY_EXISTS"
  | "ASSET_FINANCIALS_LOCKED"
  | "AUDIT_LOG_FAILED"
  | "DEPRECIATION_RUN_FAILED"
  | "FORBIDDEN";

const TITULOS: Record<CodigoError, string> = {
  VALIDATION_ERROR: "Datos inválidos",
  INVALID_PERIOD_FORMAT: "Período inválido",
  PERIOD_ALREADY_EXISTS: "El período ya existe",
  PERIOD_NOT_FOUND: "Período no encontrado",
  PERIOD_NOT_CLOSABLE: "El período no puede cerrarse",
  PERIOD_HAS_NO_DETAIL: "El período no tiene detalle calculado",
  PERIOD_ALREADY_CLOSED: "El período ya está cerrado",
  PERIOD_IMMUTABLE: "El período es inmutable",
  DEPRECIATION_RUN_IN_PROGRESS: "Corrida en progreso",
  NO_DEPRECIABLE_ASSETS: "Sin activos depreciables",
  ASSET_TYPE_INVALID_LIFE: "Vida útil inválida",
  ASSET_TYPE_METHOD_UNSUPPORTED: "Método de depreciación no soportado",
  ASSET_TYPE_INACTIVE: "Tipo de activo inactivo",
  RESIDUAL_EXCEEDS_COST: "Valor residual mayor al costo",
  DEPRECIATION_OVERFLOW: "Depreciación acumulada excedida",
  DEPRECIATION_DETAIL_DUPLICATE: "Detalle de depreciación duplicado",
  DEPRECIATION_EXPENSE_ACCOUNT_MISSING: "Cuenta de gasto no configurada",
  ASIENTO_UNBALANCED: "Asiento descuadrado",
  ASIENTO_ALREADY_EXISTS: "El asiento ya existe",
  ASSET_FINANCIALS_LOCKED: "Campos financieros bloqueados",
  AUDIT_LOG_FAILED: "No se pudo registrar la auditoría",
  DEPRECIATION_RUN_FAILED: "Falló la corrida de depreciación",
  FORBIDDEN: "Acceso denegado",
};

const ESTADOS_HTTP: Record<CodigoError, number> = {
  VALIDATION_ERROR: 400,
  INVALID_PERIOD_FORMAT: 422,
  PERIOD_ALREADY_EXISTS: 409,
  PERIOD_NOT_FOUND: 404,
  PERIOD_NOT_CLOSABLE: 409,
  PERIOD_HAS_NO_DETAIL: 422,
  PERIOD_ALREADY_CLOSED: 409,
  PERIOD_IMMUTABLE: 409,
  DEPRECIATION_RUN_IN_PROGRESS: 409,
  NO_DEPRECIABLE_ASSETS: 422,
  ASSET_TYPE_INVALID_LIFE: 422,
  ASSET_TYPE_METHOD_UNSUPPORTED: 422,
  ASSET_TYPE_INACTIVE: 422,
  RESIDUAL_EXCEEDS_COST: 422,
  DEPRECIATION_OVERFLOW: 422,
  DEPRECIATION_DETAIL_DUPLICATE: 409,
  DEPRECIATION_EXPENSE_ACCOUNT_MISSING: 422,
  ASIENTO_UNBALANCED: 500,
  ASIENTO_ALREADY_EXISTS: 409,
  ASSET_FINANCIALS_LOCKED: 409,
  AUDIT_LOG_FAILED: 500,
  DEPRECIATION_RUN_FAILED: 500,
  FORBIDDEN: 403,
};

export class DepreciationError extends Error {
  readonly code: CodigoError;
  readonly status: number;
  readonly title: string;

  constructor(code: CodigoError, detail?: string) {
    super(detail ?? TITULOS[code]);
    this.name = "DepreciationError";
    this.code = code;
    this.status = ESTADOS_HTTP[code];
    this.title = TITULOS[code];
  }
}

const MENSAJES_CONOCIDOS: Record<string, CodigoError> = {
  RESIDUAL_EXCEEDS_COST: "RESIDUAL_EXCEEDS_COST",
  ASSET_TYPE_INVALID_LIFE: "ASSET_TYPE_INVALID_LIFE",
  DEPRECIATION_OVERFLOW: "DEPRECIATION_OVERFLOW",
};

/** Traduce errores del motor de cálculo a errores de dominio. */
export function normalizarErrorMotor(error: unknown): DepreciationError {
  const mensaje = error instanceof Error ? error.message : "";
  const codigo = MENSAJES_CONOCIDOS[mensaje];
  if (codigo) return new DepreciationError(codigo);
  return new DepreciationError("DEPRECIATION_RUN_FAILED", mensaje || undefined);
}
