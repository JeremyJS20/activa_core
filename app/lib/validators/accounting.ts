/**
 * Motor de validación y formateo de cuentas contables auxiliares.
 * Cumple con la nomenclatura contable dominicana: X-XX-XX-XXXX (Clase-Grupo-Subgrupo-Auxiliar).
 */

export const ACCOUNT_CODE_REGEX = /^[1-9]-[0-9]{2}-[0-9]{2}-[0-9]{4}$/;

/**
 * Valida si una cadena cumple con la máscara contable oficial X-XX-XX-XXXX.
 */
export function validarCuentaContable(cuenta: string | null | undefined): boolean {
  if (!cuenta) return false;
  return ACCOUNT_CODE_REGEX.test(cuenta.trim());
}

/**
 * Normaliza una cuenta contable removiendo espacios en blanco superfluos.
 */
export function normalizarCuentaContable(cuenta: string | null | undefined): string {
  if (!cuenta) return '';
  return cuenta.trim();
}

/**
 * Formatea una secuencia de 9 dígitos continuos al formato contable X-XX-XX-XXXX.
 */
export function formatearCuentaContable(cuenta: string | null | undefined): string {
  if (!cuenta) return '';
  const limpio = cuenta.replace(/[^0-9]/g, '').trim();
  if (limpio.length !== 9) return cuenta.trim();
  return limpio.substring(0, 1) + "-" + limpio.substring(1, 3) + "-" + limpio.substring(3, 5) + "-" + limpio.substring(5, 9);
}
