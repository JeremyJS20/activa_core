import { describe, it, expect } from 'vitest';
import {
  normalizarDocumento,
  validarCedulaJCE,
  validarRncDGII,
  validarIdentidadDominicana,
  formatearCedula,
  formatearRnc,
} from '../../lib/validators/identity';
import {
  validarCuentaContable,
  normalizarCuentaContable,
  formatearCuentaContable,
} from '../../lib/validators/accounting';

describe('Motor de Validación de Cédula JCE (Módulo 10)', () => {
  it('debe aceptar cédulas válidas reales con y sin guiones', () => {
    expect(validarCedulaJCE('402-0000000-4')).toBe(true);
    expect(validarCedulaJCE('40200000004')).toBe(true);
    expect(validarCedulaJCE('001-0101010-6')).toBe(true);
    expect(validarCedulaJCE('00101010106')).toBe(true);
    expect(validarCedulaJCE('001-1234567-3')).toBe(true);
    expect(validarCedulaJCE('00112345673')).toBe(true);
  });

  it('debe rechazar cédulas con dígito verificador incorrecto', () => {
    expect(validarCedulaJCE('402-0000000-5')).toBe(false);
    expect(validarCedulaJCE('001-0101010-9')).toBe(false);
    expect(validarCedulaJCE('001-1234567-8')).toBe(false);
  });

  it('debe rechazar cadenas que no tengan exactamente 11 dígitos', () => {
    expect(validarCedulaJCE('402-000000-4')).toBe(false); // 10 dígitos
    expect(validarCedulaJCE('402-00000000-4')).toBe(false); // 12 dígitos
    expect(validarCedulaJCE('')).toBe(false);
    expect(validarCedulaJCE(null)).toBe(false);
    expect(validarCedulaJCE(undefined)).toBe(false);
  });

  it('debe rechazar secuencias inválidas de ceros continuos', () => {
    expect(validarCedulaJCE('000-0000000-0')).toBe(false);
    expect(validarCedulaJCE('00000000000')).toBe(false);
  });

  it('debe rechazar caracteres alfanuméricos espurios', () => {
    expect(validarCedulaJCE('402-ABCDEFG-4')).toBe(false);
    expect(validarCedulaJCE('4020000000X')).toBe(false);
    expect(validarCedulaJCE('cedula_falsa')).toBe(false);
  });
});

describe('Motor de Validación de RNC DGII (Módulo 11)', () => {
  it('debe aceptar RNCs válidos estándar para personas jurídicas', () => {
    expect(validarRncDGII('1-01-00624-2')).toBe(true);
    expect(validarRncDGII('101006242')).toBe(true);
  });

  it('debe calcular correctamente residuos especiales 0 y 1', () => {
    // Residuo 0 -> verificador 2
    expect(validarRncDGII('1-00-00002-2')).toBe(true);
    expect(validarRncDGII('100000022')).toBe(true);

    // Residuo 1 -> verificador 1
    expect(validarRncDGII('1-00-00008-1')).toBe(true);
    expect(validarRncDGII('100000081')).toBe(true);
  });

  it('debe rechazar RNCs con dígito verificador incorrecto', () => {
    expect(validarRncDGII('1-01-00624-5')).toBe(false);
    expect(validarRncDGII('100000029')).toBe(false);
  });

  it('debe rechazar RNCs que no tengan exactamente 9 dígitos', () => {
    expect(validarRncDGII('10100624')).toBe(false); // 8 dígitos
    expect(validarRncDGII('1010062420')).toBe(false); // 10 dígitos
    expect(validarRncDGII('')).toBe(false);
    expect(validarRncDGII(null)).toBe(false);
    expect(validarRncDGII('000000000')).toBe(false);
  });
});

describe('Validador Unificado de Identidad Dominicana', () => {
  it('debe validar cédula para persona física y RNC para persona jurídica', () => {
    expect(validarIdentidadDominicana('402-0000000-4', 'FISICA')).toBe(true);
    expect(validarIdentidadDominicana('1-01-00624-2', 'JURIDICA')).toBe(true);
    expect(validarIdentidadDominicana('1-01-00624-2', 'FISICA')).toBe(false);
    expect(validarIdentidadDominicana('402-0000000-4', 'JURIDICA')).toBe(false);
  });
});

describe('Formateadores y Normalizadores de Identidad', () => {
  it('debe normalizar cadenas con guiones y espacios', () => {
    expect(normalizarDocumento(' 402-0000000-4 ')).toBe('40200000004');
    expect(normalizarDocumento('1-01.00624-2')).toBe('101006242');
  });

  it('debe aplicar la máscara XXX-XXXXXXX-X a cédulas de 11 dígitos', () => {
    expect(formatearCedula('40200000004')).toBe('402-0000000-4');
  });

  it('debe aplicar la máscara X-XX-XXXXX-X a RNCs de 9 dígitos', () => {
    expect(formatearRnc('101006242')).toBe('1-01-00624-2');
  });
});

describe('Motor de Validación de Cuentas Contables (X-XX-XX-XXXX)', () => {
  it('debe aceptar cuentas contables con formato y máscara oficial', () => {
    expect(validarCuentaContable('1-01-04-0001')).toBe(true);
    expect(validarCuentaContable('1-02-01-0010')).toBe(true);
    expect(validarCuentaContable('5-01-02-0003')).toBe(true);
  });

  it('debe rechazar cuentas contables con formatos anómalos', () => {
    expect(validarCuentaContable('0-01-04-0001')).toBe(false); // Primer dígito 0
    expect(validarCuentaContable('1-1-04-0001')).toBe(false); // Grupo incompleto
    expect(validarCuentaContable('1-01-4-0001')).toBe(false); // Subgrupo incompleto
    expect(validarCuentaContable('1-01-04-001')).toBe(false); // Auxiliar de 3 dígitos
    expect(validarCuentaContable('101040001')).toBe(false); // Sin guiones
    expect(validarCuentaContable('A-01-04-0001')).toBe(false); // Letras
    expect(validarCuentaContable('')).toBe(false);
    expect(validarCuentaContable(null)).toBe(false);
  });

  it('debe formatear 9 dígitos continuos al formato contable con guiones', () => {
    expect(formatearCuentaContable('101040001')).toBe('1-01-04-0001');
    expect(formatearCuentaContable('102010010')).toBe('1-02-01-0010');
  });

  it('debe normalizar espacios en cuentas contables', () => {
    expect(normalizarCuentaContable('  1-01-04-0001  ')).toBe('1-01-04-0001');
  });
});
