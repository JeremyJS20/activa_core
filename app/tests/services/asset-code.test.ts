import { describe, it, expect, vi } from 'vitest';
import {
  esCodigoActivoValido,
  formatearCodigoActivo,
  parsearCodigoActivo,
  generarCodigoActivo,
} from '../../lib/services/asset-code.service';
import {
  validarBloqueoFinanciero,
  detectarCamposFinancierosModificados,
  assertFinanciallyEditable,
  FinancialLockError,
  CAMPOS_FINANCIEROS_BLOQUEADOS,
} from '../../lib/validators/asset-lock';

describe('Servicio de Código Correlativo de Activos (asset-code.service)', () => {
  describe('esCodigoActivoValido', () => {
    it('debe validar códigos con formato ACT-YYYY-NNNN', () => {
      expect(esCodigoActivoValido('ACT-2026-0001')).toBe(true);
      expect(esCodigoActivoValido('ACT-2026-9999')).toBe(true);
      expect(esCodigoActivoValido('ACT-2025-0042')).toBe(true);
      expect(esCodigoActivoValido('ACT-2030-10000')).toBe(true);
    });

    it('debe rechazar códigos con formatos incorrectos', () => {
      expect(esCodigoActivoValido('ACT-26-0001')).toBe(false);
      expect(esCodigoActivoValido('ACT-2026-1')).toBe(false);
      expect(esCodigoActivoValido('ACT-2026-01')).toBe(false);
      expect(esCodigoActivoValido('ACT-2026-001')).toBe(false);
      expect(esCodigoActivoValido('DEP-2026-0001')).toBe(false);
      expect(esCodigoActivoValido('ACT-ABCD-0001')).toBe(false);
      expect(esCodigoActivoValido('')).toBe(false);
    });
  });

  describe('formatearCodigoActivo', () => {
    it('debe formatear año y secuencia rellenando con ceros a la izquierda (4 dígitos)', () => {
      expect(formatearCodigoActivo(2026, 1)).toBe('ACT-2026-0001');
      expect(formatearCodigoActivo(2026, 25)).toBe('ACT-2026-0025');
      expect(formatearCodigoActivo(2026, 350)).toBe('ACT-2026-0350');
      expect(formatearCodigoActivo(2026, 1500)).toBe('ACT-2026-1500');
    });

    it('debe lanzar error si la secuencia es menor o igual a cero', () => {
      expect(() => formatearCodigoActivo(2026, 0)).toThrow();
      expect(() => formatearCodigoActivo(2026, -5)).toThrow();
    });
  });

  describe('parsearCodigoActivo', () => {
    it('debe extraer año y secuencia de un código válido', () => {
      expect(parsearCodigoActivo('ACT-2026-0001')).toEqual({ anio: 2026, secuencia: 1 });
      expect(parsearCodigoActivo('ACT-2025-0145')).toEqual({ anio: 2025, secuencia: 145 });
    });

    it('debe retornar null para códigos con formato inválido', () => {
      expect(parsearCodigoActivo('INVALID-CODE')).toBeNull();
      expect(parsearCodigoActivo('ACT-26-01')).toBeNull();
    });
  });

  describe('generarCodigoActivo con mock de Prisma', () => {
    it('debe generar ACT-YYYY-0001 si no existen activos previos para ese año', async () => {
      const mockClient = {
        activoFijo: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as any;

      const codigo = await generarCodigoActivo(mockClient, 2026);
      expect(codigo).toBe('ACT-2026-0001');
      expect(mockClient.activoFijo.findMany).toHaveBeenCalledWith({
        where: { codigo: { startsWith: 'ACT-2026-' } },
        select: { codigo: true },
      });
    });

    it('debe calcular el siguiente número correlativo a partir del máximo existente', async () => {
      const mockClient = {
        activoFijo: {
          findMany: vi.fn().mockResolvedValue([
            { codigo: 'ACT-2026-0001' },
            { codigo: 'ACT-2026-0005' },
            { codigo: 'ACT-2026-0002' },
          ]),
        },
      } as any;

      const codigo = await generarCodigoActivo(mockClient, 2026);
      expect(codigo).toBe('ACT-2026-0006');
    });

    it('debe reiniciar la secuencia correlativa en 0001 para un nuevo año fiscal', async () => {
      const mockClient = {
        activoFijo: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            if (where.codigo.startsWith === 'ACT-2027-') {
              return Promise.resolve([]);
            }
            return Promise.resolve([{ codigo: 'ACT-2026-0150' }]);
          }),
        },
      } as any;

      const codigo2027 = await generarCodigoActivo(mockClient, 2027);
      expect(codigo2027).toBe('ACT-2027-0001');
    });

    it('debe manejar concurrencia simulada generando códigos secuenciales', async () => {
      let currentMax = 0;
      const mockClient = {
        activoFijo: {
          findMany: vi.fn().mockImplementation(() => {
            const list = [];
            for (let i = 1; i <= currentMax; i++) {
              list.push({ codigo: `ACT-2026-${i.toString().padStart(4, '0')}` });
            }
            return Promise.resolve(list);
          }),
        },
      } as any;

      const c1 = await generarCodigoActivo(mockClient, 2026);
      expect(c1).toBe('ACT-2026-0001');
      currentMax = 1;

      const c2 = await generarCodigoActivo(mockClient, 2026);
      expect(c2).toBe('ACT-2026-0002');
      currentMax = 2;

      const c3 = await generarCodigoActivo(mockClient, 2026);
      expect(c3).toBe('ACT-2026-0003');
    });
  });
});

describe('Motor de Bloqueo Contable de Activos Fijos (asset-lock)', () => {
  describe('validarBloqueoFinanciero', () => {
    it('debe retornar false si el activo no posee depreciación acumulada y está ACTIVO', async () => {
      const mockClient = {
        activoFijo: {
          findUnique: vi.fn().mockResolvedValue({
            depreciacionAcumulada: 0.0,
            estado: 'ACTIVO',
          }),
        },
      } as any;

      const bloqueado = await validarBloqueoFinanciero('act-1', mockClient);
      expect(bloqueado).toBe(false);
    });

    it('debe retornar true si el activo posee depreciación acumulada > 0', async () => {
      const mockClient = {
        activoFijo: {
          findUnique: vi.fn().mockResolvedValue({
            depreciacionAcumulada: 1250.75,
            estado: 'ACTIVO',
          }),
        },
      } as any;

      const bloqueado = await validarBloqueoFinanciero('act-2', mockClient);
      expect(bloqueado).toBe(true);
    });

    it('debe retornar true si el activo se encuentra DADO_DE_BAJA o VENDIDO', async () => {
      const mockClientBaja = {
        activoFijo: {
          findUnique: vi.fn().mockResolvedValue({
            depreciacionAcumulada: 0,
            estado: 'DADO_DE_BAJA',
          }),
        },
      } as any;

      const bloqueadoBaja = await validarBloqueoFinanciero('act-3', mockClientBaja);
      expect(bloqueadoBaja).toBe(true);

      const mockClientVendido = {
        activoFijo: {
          findUnique: vi.fn().mockResolvedValue({
            depreciacionAcumulada: 0,
            estado: 'VENDIDO',
          }),
        },
      } as any;

      const bloqueadoVendido = await validarBloqueoFinanciero('act-4', mockClientVendido);
      expect(bloqueadoVendido).toBe(true);
    });

    it('debe retornar false si el activo no existe en la base de datos', async () => {
      const mockClient = {
        activoFijo: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const bloqueado = await validarBloqueoFinanciero('non-existent', mockClient);
      expect(bloqueado).toBe(false);
    });
  });

  describe('detectarCamposFinancierosModificados', () => {
    it('debe identificar campos financieros críticos presentes en el payload', () => {
      const payload = {
        costoAdquisicion: 100000,
        marca: 'Dell',
        tipoActivoId: 'tpa-1',
      };

      const detectados = detectarCamposFinancierosModificados(payload);
      expect(detectados).toContain('costoAdquisicion');
      expect(detectados).toContain('tipoActivoId');
      expect(detectados).not.toContain('marca');
      expect(detectados.length).toBe(2);
    });

    it('debe retornar arreglo vacío si solo se modifican atributos físicos', () => {
      const payload = {
        marca: 'HP',
        modelo: 'ProDesk 600',
        color: 'Negro',
        ubicacionFisica: 'Edificio 1 - Aula 204',
        numeroSerie: 'SN-998877',
      };

      const detectados = detectarCamposFinancierosModificados(payload);
      expect(detectados).toEqual([]);
    });

    it('debe contemplar los 4 campos financieros definidos por la norma', () => {
      expect(CAMPOS_FINANCIEROS_BLOQUEADOS).toEqual([
        'costoAdquisicion',
        'valorResidual',
        'fechaAdquisicion',
        'tipoActivoId',
      ]);
    });
  });

  describe('assertFinanciallyEditable', () => {
    it('no debe lanzar error si el activo no está bloqueado financieramente', async () => {
      const mockClient = {
        activoFijo: {
          findUnique: vi.fn().mockResolvedValue({
            depreciacionAcumulada: 0,
            estado: 'ACTIVO',
          }),
        },
      } as any;

      await expect(
        assertFinanciallyEditable('act-1', { costoAdquisicion: 50000 }, mockClient)
      ).resolves.not.toThrow();
    });

    it('no debe lanzar error si el activo está bloqueado pero solo se editan atributos físicos', async () => {
      const mockClient = {
        activoFijo: {
          findUnique: vi.fn().mockResolvedValue({
            depreciacionAcumulada: 5000,
            estado: 'ACTIVO',
          }),
        },
      } as any;

      await expect(
        assertFinanciallyEditable('act-1', { marca: 'Lenovo', color: 'Gris' }, mockClient)
      ).resolves.not.toThrow();
    });

    it('debe lanzar FinancialLockError (409) si se intentan alterar campos financieros en un activo bloqueado', async () => {
      const mockClient = {
        activoFijo: {
          findUnique: vi.fn().mockResolvedValue({
            depreciacionAcumulada: 2500,
            estado: 'ACTIVO',
          }),
        },
      } as any;

      await expect(
        assertFinanciallyEditable(
          'act-1',
          { costoAdquisicion: 60000, valorResidual: 6000 },
          mockClient
        )
      ).rejects.toThrow(FinancialLockError);

      try {
        await assertFinanciallyEditable(
          'act-1',
          { costoAdquisicion: 60000, valorResidual: 6000 },
          mockClient
        );
      } catch (err: any) {
        expect(err.code).toBe('FINANCIAL_FIELDS_LOCKED');
        expect(err.status).toBe(409);
        expect(err.camposBloqueados).toEqual(['costoAdquisicion', 'valorResidual']);
      }
    });
  });
});