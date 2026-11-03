import { describe, expect, it } from "vitest";
import {
  AsientoFilterSchema,
  ClosePeriodSchema,
  CreatePeriodSchema,
  PeriodFilterSchema,
} from "../../lib/schemas/depreciation";

describe("CreatePeriodSchema", () => {
  it("debe aceptar un período válido con año y mes en rango", () => {
    const valid = CreatePeriodSchema.safeParse({ anio: 2026, mes: 3 });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.anio).toBe(2026);
      expect(valid.data.mes).toBe(3);
    }
  });

  it("debe coercionar valores numéricos enviados como texto", () => {
    const valid = CreatePeriodSchema.safeParse({ anio: "2026", mes: "12" });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.anio).toBe(2026);
      expect(valid.data.mes).toBe(12);
    }
  });

  it("debe rechazar mes 0 y mes 13", () => {
    expect(CreatePeriodSchema.safeParse({ anio: 2026, mes: 0 }).success).toBe(false);
    expect(CreatePeriodSchema.safeParse({ anio: 2026, mes: 13 }).success).toBe(false);
  });

  it("debe rechazar año 1999 y año 2101", () => {
    expect(CreatePeriodSchema.safeParse({ anio: 1999, mes: 1 }).success).toBe(false);
    expect(CreatePeriodSchema.safeParse({ anio: 2101, mes: 1 }).success).toBe(false);
  });

  it("debe rechazar mes no entero", () => {
    expect(CreatePeriodSchema.safeParse({ anio: 2026, mes: 3.5 }).success).toBe(false);
  });

  it("debe devolver mensajes de error en español", () => {
    const invalid = CreatePeriodSchema.safeParse({ anio: 2026, mes: 13 });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0].message).toContain("entre 1 y 12");
    }
  });
});

describe("ClosePeriodSchema", () => {
  it("debe aceptar confirmar = true", () => {
    expect(ClosePeriodSchema.safeParse({ confirmar: true }).success).toBe(true);
  });

  it("debe rechazar confirmar = false con mensaje de irreversibilidad", () => {
    const invalid = ClosePeriodSchema.safeParse({ confirmar: false });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0].message).toContain("irreversible");
    }
  });

  it("debe rechazar la ausencia del campo confirmar", () => {
    expect(ClosePeriodSchema.safeParse({}).success).toBe(false);
  });

  it("debe rechazar confirmar con valor no booleano", () => {
    expect(ClosePeriodSchema.safeParse({ confirmar: "true" }).success).toBe(false);
  });
});

describe("PeriodFilterSchema", () => {
  it("debe aplicar valores por defecto sin parámetros", () => {
    const valid = PeriodFilterSchema.safeParse({});
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.page).toBe(1);
      expect(valid.data.pageSize).toBe(10);
      expect(valid.data.estado).toBe("TODOS");
      expect(valid.data.anio).toBeUndefined();
    }
  });

  it("debe aceptar un estado de período válido y un año", () => {
    const valid = PeriodFilterSchema.safeParse({ estado: "CERRADO", anio: "2025" });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.estado).toBe("CERRADO");
      expect(valid.data.anio).toBe(2025);
    }
  });

  it("debe rechazar pageSize mayor a 50", () => {
    expect(PeriodFilterSchema.safeParse({ pageSize: 51 }).success).toBe(false);
  });

  it("debe rechazar un estado fuera del dominio", () => {
    expect(PeriodFilterSchema.safeParse({ estado: "INVALIDO" }).success).toBe(false);
  });
});

describe("AsientoFilterSchema", () => {
  it("debe aplicar PENDIENTE_ENVIO como estado por defecto", () => {
    const valid = AsientoFilterSchema.safeParse({});
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.estado).toBe("PENDIENTE_ENVIO");
    }
  });

  it("debe aceptar ENVIADO y ERROR", () => {
    expect(AsientoFilterSchema.safeParse({ estado: "ENVIADO" }).success).toBe(true);
    expect(AsientoFilterSchema.safeParse({ estado: "ERROR" }).success).toBe(true);
  });

  it("debe rechazar un estado desconocido", () => {
    expect(AsientoFilterSchema.safeParse({ estado: "DESPACHADO" }).success).toBe(false);
  });
});
