/**
 * Estado en memoria del simulador del Web Service de Contabilidad.
 * Vive por proceso (suficiente para demo/E2E). No persiste en el dominio.
 */

export interface MockConfirmacion {
  numeroAsiento: string;
  numeroConfirmacion: string;
  fechaRecepcion: string;
}

const confirmados = new Map<string, MockConfirmacion>();
let secuencia = 0;

function fechaCompactaUtc(): string {
  const ahora = new Date();
  const y = ahora.getUTCFullYear();
  const m = String(ahora.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ahora.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function obtenerConfirmacion(numeroAsiento: string): MockConfirmacion | undefined {
  return confirmados.get(numeroAsiento);
}

export function registrarConfirmacion(numeroAsiento: string): MockConfirmacion {
  const existente = confirmados.get(numeroAsiento);
  if (existente) return existente;

  secuencia += 1;
  const confirmacion: MockConfirmacion = {
    numeroAsiento,
    numeroConfirmacion: `WS-${fechaCompactaUtc()}-${String(secuencia).padStart(5, "0")}`,
    fechaRecepcion: new Date().toISOString(),
  };
  confirmados.set(numeroAsiento, confirmacion);
  return confirmacion;
}

/** Solo para pruebas: limpia el registro en memoria y el correlativo. */
export function resetMockStore(): void {
  confirmados.clear();
  secuencia = 0;
}
