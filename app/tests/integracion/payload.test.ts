import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  construirPayloadAsiento,
  mapearTipoMovimiento,
  serializarMonto,
  type AsientoParaPayload,
  type TipoActivoContableInfo,
} from "@/lib/integracion/payload";
import { IntegrationError } from "@/lib/integracion/errors";

const dec = (valor: string) => new Prisma.Decimal(valor);

const tipoA: TipoActivoContableInfo = {
  codigo: "TPA-001",
  cuentaContableGastoDepreciacion: null,
  cuentaContableDepreciacion: "1-01-04-0011",
  metodoDepreciacion: "DGII_CAT1",
};

const tipoB: TipoActivoContableInfo = {
  codigo: "TPA-002",
  cuentaContableGastoDepreciacion: null,
  cuentaContableDepreciacion: "1-01-04-0021",
  metodoDepreciacion: "DGII_CAT2",
};

function asientoBase(overrides: Partial<AsientoParaPayload> = {}): AsientoParaPayload {
  const monto = dec("1000.00");
  return {
    numeroAsiento: "DEP-202610-001",
    concepto: "Depreciación 10/2026",
    fechaContable: new Date("2026-10-31T00:00:00.000Z"),
    estado: "PENDIENTE_ENVIO",
    totalDebito: monto,
    totalCredito: monto,
    lineas: [
      {
        cuentaContable: "6-30-01-0001",
        tipoMovimiento: "DEBITO",
        monto,
        descripcion: "Gasto por depreciación 10/2026",
      },
      {
        cuentaContable: "1-01-04-0011",
        tipoMovimiento: "CREDITO",
        monto,
        descripcion: "Depreciación acumulada 10/2026",
      },
    ],
    ...overrides,
  };
}

function capturarError(fn: () => unknown): IntegrationError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(IntegrationError);
    return error as IntegrationError;
  }
  throw new Error("Se esperaba un IntegrationError");
}

describe("mapearTipoMovimiento", () => {
  it("mapea DEBITO→DB y CREDITO→CR", () => {
    expect(mapearTipoMovimiento("DEBITO")).toBe("DB");
    expect(mapearTipoMovimiento("credito")).toBe("CR");
  });

  it("rechaza movimientos desconocidos con VALIDATION_ERROR", () => {
    const error = capturarError(() => mapearTipoMovimiento("AJUSTE"));
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.status).toBe(400);
  });
});

describe("serializarMonto", () => {
  it("serializa Decimal, string y number a 2 decimales", () => {
    expect(serializarMonto(dec("1000.5"))).toBe("1000.50");
    expect(serializarMonto("47812.5")).toBe("47812.50");
    expect(serializarMonto(1000)).toBe("1000.00");
  });
});

describe("construirPayloadAsiento", () => {
  it("construye el payload determinista con DB/CR, tipoInventario y strings", () => {
    const payload = construirPayloadAsiento(asientoBase(), [tipoA]);

    expect(payload).toEqual({
      numeroAsiento: "DEP-202610-001",
      concepto: "Depreciación 10/2026",
      fechaAsiento: "2026-10-31",
      estado: "PENDIENTE_ENVIO",
      lineas: [
        {
          tipoInventario: "TPA-001",
          cuentaContable: "6-30-01-0001",
          tipoMovimiento: "DB",
          monto: "1000.00",
          descripcion: "Gasto por depreciación 10/2026",
        },
        {
          tipoInventario: "TPA-001",
          cuentaContable: "1-01-04-0011",
          tipoMovimiento: "CR",
          monto: "1000.00",
          descripcion: "Depreciación acumulada 10/2026",
        },
      ],
      totalDebito: "1000.00",
      totalCredito: "1000.00",
    });
  });

  it("genera el mismo payload byte a byte en dos ejecuciones", () => {
    const primero = construirPayloadAsiento(asientoBase(), [tipoA]);
    const segundo = construirPayloadAsiento(asientoBase(), [tipoA]);
    expect(JSON.stringify(primero)).toBe(JSON.stringify(segundo));
  });

  it("ordena por tipoInventario, DB antes de CR y cuenta contable", () => {
    const montoA = dec("100.00");
    const montoB = dec("200.00");
    const asiento: AsientoParaPayload = {
      numeroAsiento: "DEP-202610-002",
      concepto: "Depreciación 10/2026",
      fechaContable: "2026-10-31",
      estado: "PENDIENTE_ENVIO",
      totalDebito: dec("300.00"),
      totalCredito: dec("300.00"),
      lineas: [
        { cuentaContable: "6-30-01-0002", tipoMovimiento: "DEBITO", monto: montoB },
        { cuentaContable: "1-01-04-0011", tipoMovimiento: "CREDITO", monto: montoA },
        { cuentaContable: "6-30-01-0001", tipoMovimiento: "DEBITO", monto: montoA },
        { cuentaContable: "1-01-04-0021", tipoMovimiento: "CREDITO", monto: montoB },
      ],
    };

    const payload = construirPayloadAsiento(asiento, [tipoB, tipoA]);
    expect(payload.lineas.map((linea) => `${linea.tipoInventario}:${linea.tipoMovimiento}`)).toEqual([
      "TPA-001:DB",
      "TPA-001:CR",
      "TPA-002:DB",
      "TPA-002:CR",
    ]);
  });

  it("rechaza un asiento sin líneas", () => {
    const error = capturarError(() =>
      construirPayloadAsiento(asientoBase({ lineas: [] }), [tipoA])
    );
    expect(error.code).toBe("ASIENTO_SIN_LINEAS");
    expect(error.status).toBe(422);
  });

  it("rechaza líneas desbalanceadas", () => {
    const error = capturarError(() =>
      construirPayloadAsiento(
        asientoBase({
          lineas: [
            { cuentaContable: "6-30-01-0001", tipoMovimiento: "DEBITO", monto: dec("1000.00") },
            { cuentaContable: "1-01-04-0011", tipoMovimiento: "CREDITO", monto: dec("999.99") },
          ],
        }),
        [tipoA]
      )
    );
    expect(error.code).toBe("ASIENTO_UNBALANCED");
  });

  it("rechaza totales declarados distintos de las líneas", () => {
    const error = capturarError(() =>
      construirPayloadAsiento(
        asientoBase({
          totalDebito: dec("999.00"),
          totalCredito: dec("999.00"),
        }),
        [tipoA]
      )
    );
    expect(error.code).toBe("ASIENTO_UNBALANCED");
  });

  it("rechaza una cuenta de crédito sin TipoActivo", () => {
    const error = capturarError(() =>
      construirPayloadAsiento(
        asientoBase({
          lineas: [
            { cuentaContable: "6-30-01-0001", tipoMovimiento: "DEBITO", monto: dec("1000.00") },
            { cuentaContable: "9-99-99-9999", tipoMovimiento: "CREDITO", monto: dec("1000.00") },
          ],
        }),
        [tipoA]
      )
    );
    expect(error.code).toBe("TIPO_INVENTARIO_UNRESOLVED");
  });

  it("rechaza cuentas de depreciación duplicadas entre tipos", () => {
    const duplicado: TipoActivoContableInfo = { ...tipoB, cuentaContableDepreciacion: tipoA.cuentaContableDepreciacion };
    const error = capturarError(() => construirPayloadAsiento(asientoBase(), [tipoA, duplicado]));
    expect(error.code).toBe("TIPO_INVENTARIO_UNRESOLVED");
  });

  it("rechaza un débito con más de un tipo candidato (ambigüedad por cuentas compartidas)", () => {
    const tipoD: TipoActivoContableInfo = {
      codigo: "TPA-004",
      cuentaContableGastoDepreciacion: null,
      cuentaContableDepreciacion: "1-01-04-0041",
      metodoDepreciacion: "LINEA_RECTA",
    };
    const monto = dec("100.00");
    const asiento: AsientoParaPayload = {
      numeroAsiento: "DEP-202610-003",
      concepto: "Depreciación 10/2026",
      fechaContable: "2026-10-31",
      estado: "PENDIENTE_ENVIO",
      totalDebito: dec("200.00"),
      totalCredito: dec("200.00"),
      lineas: [
        { cuentaContable: "6-30-01-0002", tipoMovimiento: "DEBITO", monto },
        { cuentaContable: "1-01-04-0021", tipoMovimiento: "CREDITO", monto },
        { cuentaContable: "6-30-01-0002", tipoMovimiento: "DEBITO", monto },
        { cuentaContable: "1-01-04-0041", tipoMovimiento: "CREDITO", monto },
      ],
    };

    // tipoB (DGII_CAT2) y tipoD (LINEA_RECTA) comparten cuenta de gasto 6-30-01-0002.
    const error = capturarError(() => construirPayloadAsiento(asiento, [tipoB, tipoD]));
    expect(error.code).toBe("TIPO_INVENTARIO_UNRESOLVED");
  });

  it("rechaza créditos sin débito correspondiente", () => {
    const error = capturarError(() =>
      construirPayloadAsiento(
        asientoBase({
          totalDebito: dec("1000.00"),
          totalCredito: dec("2000.00"),
          lineas: [
            { cuentaContable: "6-30-01-0001", tipoMovimiento: "DEBITO", monto: dec("1000.00") },
            { cuentaContable: "1-01-04-0011", tipoMovimiento: "CREDITO", monto: dec("1000.00") },
            { cuentaContable: "1-01-04-0021", tipoMovimiento: "CREDITO", monto: dec("1000.00") },
          ],
        }),
        [tipoA, tipoB]
      )
    );
    expect(error.code).toBe("ASIENTO_UNBALANCED");
  });

  it("usa la descripción del asiento si la línea no trae descripción", () => {
    const payload = construirPayloadAsiento(
      asientoBase({
        lineas: [
          { cuentaContable: "6-30-01-0001", tipoMovimiento: "DEBITO", monto: dec("1000.00") },
          { cuentaContable: "1-01-04-0011", tipoMovimiento: "CREDITO", monto: dec("1000.00") },
        ],
      }),
      [tipoA]
    );
    expect(payload.lineas.every((linea) => linea.descripcion === "Depreciación 10/2026")).toBe(true);
  });
});
