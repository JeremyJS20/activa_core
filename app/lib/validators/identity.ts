/**
 * Motor de validación cripto-aritmética de documentos de identidad dominicana.
 * Cumple con las especificaciones de la Junta Central Electoral (JCE) y la DGII.
 */

/**
 * Normaliza cualquier documento eliminando guiones, espacios, puntos o caracteres no numéricos.
 */
export function normalizarDocumento(doc: string | null | undefined): string {
  if (!doc) return '';
  return doc.replace(/[^0-9]/g, '').trim();
}

/**
 * Valida una Cédula de Identidad y Electoral dominicana (11 dígitos).
 * Algoritmo: Módulo 10 (Luhn modificado con vector alternado [1, 2, 1, 2, 1, 2, 1, 2, 1, 2]).
 */
export function validarCedulaJCE(cedula: string | null | undefined): boolean {
  const limpio = normalizarDocumento(cedula);

  // Debe tener exactamente 11 dígitos numéricos
  if (!/^\d{11}$/.test(limpio)) {
    return false;
  }

  // Rechazar secuencias inválidas conocidas (todos ceros)
  if (/^0{11}$/.test(limpio)) {
    return false;
  }

  // Vector de ponderación alternado reglamentario JCE
  const pesos = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 10; i++) {
    const digito = parseInt(limpio[i], 10);
    let producto = digito * pesos[i];

    // Si el producto es mayor o igual a 10, se suman sus dígitos (ej: 14 -> 1 + 4 = 5 o 14 - 9 = 5)
    if (producto >= 10) {
      producto = Math.floor(producto / 10) + (producto % 10);
    }

    suma += producto;
  }

  const digitoVerificadorReal = parseInt(limpio[10], 10);
  const digitoEsperado = (10 - (suma % 10)) % 10;

  return digitoVerificadorReal === digitoEsperado;
}

/**
 * Valida un Registro Nacional de Contribuyentes (RNC) dominicano para personas jurídicas (9 dígitos).
 * Algoritmo: Módulo 11 con vector de pesos [7, 9, 8, 6, 5, 4, 3, 2].
 */
export function validarRncDGII(rnc: string | null | undefined): boolean {
  const limpio = normalizarDocumento(rnc);

  // Debe tener exactamente 9 dígitos numéricos
  if (!/^\d{9}$/.test(limpio)) {
    return false;
  }

  // Rechazar secuencias de ceros
  if (/^0{9}$/.test(limpio)) {
    return false;
  }

  const pesos = [7, 9, 8, 6, 5, 4, 3, 2];
  let suma = 0;

  for (let i = 0; i < 8; i++) {
    const digito = parseInt(limpio[i], 10);
    suma += digito * pesos[i];
  }

  const residuo = suma % 11;
  let digitoEsperado: number;

  if (residuo === 0) {
    digitoEsperado = 2;
  } else if (residuo === 1) {
    digitoEsperado = 1;
  } else {
    digitoEsperado = 11 - residuo;
  }

  const digitoVerificadorReal = parseInt(limpio[8], 10);

  return digitoVerificadorReal === digitoEsperado;
}

/**
 * Validador unificado de documento según la naturaleza jurídica del colaborador.
 */
export function validarIdentidadDominicana(
  documento: string | null | undefined,
  tipoPersona: 'FISICA' | 'JURIDICA' = 'FISICA'
): boolean {
  if (tipoPersona === 'JURIDICA') {
    return validarRncDGII(documento);
  }
  return validarCedulaJCE(documento);
}

/**
 * Aplica máscara visual estándar dominicana XXX-XXXXXXX-X a una cédula.
 */
export function formatearCedula(cedula: string | null | undefined): string {
  const limpio = normalizarDocumento(cedula);
  if (limpio.length !== 11) return cedula || '';
  return limpio.substring(0, 3) + "-" + limpio.substring(3, 10) + "-" + limpio.substring(10, 11);
}

/**
 * Aplica máscara visual estándar X-XX-XXXXX-X a un RNC.
 */
export function formatearRnc(rnc: string | null | undefined): string {
  const limpio = normalizarDocumento(rnc);
  if (limpio.length !== 9) return rnc || '';
  return limpio.substring(0, 1) + "-" + limpio.substring(1, 3) + "-" + limpio.substring(3, 8) + "-" + limpio.substring(8, 9);
}
