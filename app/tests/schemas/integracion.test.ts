import { describe, it, expect } from "vitest";
import {
  AsientoPayloadSchema,
  BatchDispatchSchema,
  BitacoraQuerySchema,
  ListAsientosQuerySchema,
  WsErrorResponseSchema,
  WsSuccessResponseSchema,
} from "@/lib/schemas/integracion";

function payloadValido() {
  return {
    numeroAsiento: "DEP-202610-001",
    concepto: "Depreciación 10/2026",
    fechaAsiento: "2026-10-31",
    estado: "PENDIENTE_ENVIO" as const,
    lineas: [
      {
        tipoInventario: "TPA-001",
        cuentaContable: "6-30-01-0001",
        tipoMovimiento: "DB" as const,
        monto: "1000.00",
        descripcion: "Gasto por depreciación 10/2026",
      },
      {
        tipoInventario: "TPA-001",
        cuentaContable: "1-01-04-0011",
        tipoMovimiento: "CR" as const,
        monto: "1000.00",
        descripcion: "Depreciación acumulada 10/2026",
      },
    ],
    totalDebito: "1000.00",
    totalCredito: "1000.00",
  };
}

function primerMensaje(resultado: { success: boolean; error?: { issues: Array<{ message: string }> } }) {
  return resultado.success ? "" : (resultado.error?.issues[0]?.message ?? "");
}

describe("AsientoPayloadSchema", () => {
  it("acepta el payload canónico de la Ficha", () => {
    const resultado = AsientoPayloadSchema.safeParse(payloadValido());
    expect(resultado.success).toBe(true);
  });

  it("rechaza un número de asiento con formato inválido", () => {
    const resultado = AsientoPayloadSchema.safeParse({
      ...payloadValido(),
      numeroAsiento: "DEP-2026-001",
    });
    expect(resultado.success).toBe(false);
    expect(primerMensaje(resultado)).toContain("DEP-YYYYMM-NNN");
  });

  it("rechaza tipoMovimiento interno (DEBITO/CREDITO): el wire exige DB/CR", () => {
    const payload = payloadValido();
    const resultado = AsientoPayloadSchema.safeParse({
      ...payload,
      lineas: [{ ...payload.lineas[0], tipoMovimiento: "DEBITO" }, payload.lineas[1]],
    });
    expect(resultado.success).toBe(false);
  });

  it("rechaza montos con una sola posición decimal", () => {
    const payload = payloadValido();
    const resultado = AsientoPayloadSchema.safeParse({
      ...payload,
      lineas: [{ ...payload.lineas[0], monto: "1000.5" }, payload.lineas[1]],
    });
    expect(resultado.success).toBe(false);
    expect(primerMensaje(resultado)).toContain("2 posiciones");
  });

  it("rechaza cuentas contables fuera del formato X-XX-XX-XXXX", () => {
    const payload = payloadValido();
    const resultado = AsientoPayloadSchema.safeParse({
      ...payload,
      lineas: [{ ...payload.lineas[0], cuentaContable: "630010001" }, payload.lineas[1]],
    });
    expect(resultado.success).toBe(false);
    expect(primerMensaje(resultado)).toContain("X-XX-XX-XXXX");
  });

  it("rechaza un asiento sin líneas", () => {
    const resultado = AsientoPayloadSchema.safeParse({ ...payloadValido(), lineas: [] });
    expect(resultado.success).toBe(false);
    expect(primerMensaje(resultado)).toContain("al menos una línea");
  });

  it("rechaza débitos y créditos desbalanceados", () => {
    const payload = payloadValido();
    const resultado = AsientoPayloadSchema.safeParse({
      ...payload,
      lineas: [payload.lineas[0], { ...payload.lineas[1], monto: "999.99" }],
    });
    expect(resultado.success).toBe(false);
    expect(primerMensaje(resultado)).toContain("débitos");
  });

  it("rechaza totales que no coinciden con las líneas", () => {
    const resultado = AsientoPayloadSchema.safeParse({
      ...payloadValido(),
      totalDebito: "999.00",
      totalCredito: "999.00",
    });
    expect(resultado.success).toBe(false);
  });

  it("rechaza una fecha inexistente en el calendario", () => {
    const resultado = AsientoPayloadSchema.safeParse({
      ...payloadValido(),
      fechaAsiento: "2026-02-31",
    });
    expect(resultado.success).toBe(false);
    expect(primerMensaje(resultado)).toContain("calendario");
  });
});

describe("WsSuccessResponseSchema / WsErrorResponseSchema", () => {
  it("acepta una confirmación contable institucional", () => {
    const resultado = WsSuccessResponseSchema.safeParse({
      numeroAsiento: "DEP-202610-001",
      numeroConfirmacion: "WS-20261031-00042",
      codigoRespuesta: "201",
      mensaje: "Asiento registrado",
      fechaRecepcion: "2026-10-31T14:05:12.000Z",
    });
    expect(resultado.success).toBe(true);
  });

  it("exige numeroConfirmacion en la respuesta exitosa", () => {
    const resultado = WsSuccessResponseSchema.safeParse({ codigoRespuesta: "201" });
    expect(resultado.success).toBe(false);
  });

  it("acepta un error del WS con lista de errores Zod", () => {
    const resultado = WsErrorResponseSchema.safeParse({
      codigo: "VALIDATION_ERROR",
      mensaje: "Payload inválido",
      errores: [{ path: "lineas.0.cuentaContable", message: "Formato inválido" }],
    });
    expect(resultado.success).toBe(true);
  });
});

describe("ListAsientosQuerySchema", () => {
  it("aplica defaults de paginación, estado, orden y dirección", () => {
    const resultado = ListAsientosQuerySchema.safeParse({});
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).toEqual({
        page: 1,
        pageSize: 10,
        estado: "TODOS",
        sort: "fecha",
        dir: "desc",
      });
    }
  });

  it("normaliza strings de querystring", () => {
    const resultado = ListAsientosQuerySchema.safeParse({
      page: "2",
      pageSize: "25",
      estado: "ERROR",
      periodo: "2026-10",
      sort: "numero",
      dir: "asc",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.page).toBe(2);
      expect(resultado.data.pageSize).toBe(25);
      expect(resultado.data.estado).toBe("ERROR");
      expect(resultado.data.periodo).toBe("2026-10");
      expect(resultado.data.sort).toBe("numero");
      expect(resultado.data.dir).toBe("asc");
    }
  });

  it("rechaza pageSize fuera de {10,25,50}", () => {
    const resultado = ListAsientosQuerySchema.safeParse({ pageSize: "13" });
    expect(resultado.success).toBe(false);
  });

  it("rechaza un período imposible (2026-13)", () => {
    const resultado = ListAsientosQuerySchema.safeParse({ periodo: "2026-13" });
    expect(resultado.success).toBe(false);
  });

  it("rechaza un criterio de orden no permitido", () => {
    const resultado = ListAsientosQuerySchema.safeParse({ sort: "monto" });
    expect(resultado.success).toBe(false);
  });
});

describe("BitacoraQuerySchema", () => {
  it("acepta un UUID y defaults 20 por página", () => {
    const resultado = BitacoraQuerySchema.safeParse({
      asientoId: "8b1c0e6e-2f4a-4f7e-9d6b-3a1f2c9d8e01",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.page).toBe(1);
      expect(resultado.data.pageSize).toBe(20);
    }
  });

  it("rechaza un asientoId que no es UUID", () => {
    const resultado = BitacoraQuerySchema.safeParse({ asientoId: "DEP-202610-001" });
    expect(resultado.success).toBe(false);
  });
});

describe("BatchDispatchSchema", () => {
  it("acepta un período opcional", () => {
    expect(BatchDispatchSchema.safeParse({}).success).toBe(true);
    expect(BatchDispatchSchema.safeParse({ periodo: "2026-10" }).success).toBe(true);
  });

  it("rechaza un período con formato inválido", () => {
    expect(BatchDispatchSchema.safeParse({ periodo: "10-2026" }).success).toBe(false);
  });
});
