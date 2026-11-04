import { describe, expect, it } from "vitest";
import {
  compararPeriodos,
  esPeriodoValido,
  etiquetaPeriodo,
  fechaContable,
  fechaCorte,
  generarNumeroAsiento,
  periodoDeFecha,
  primerDiaDelPeriodo,
} from "../../lib/depreciation/period-utils";

describe("fechaCorte", () => {
  it("debe devolver el último día de febrero de 2026", () => {
    expect(fechaCorte(2026, 2).toISOString().split("T")[0]).toBe("2026-02-28");
  });

  it("debe devolver el último día de febrero en año bisiesto", () => {
    expect(fechaCorte(2024, 2).toISOString().split("T")[0]).toBe("2024-02-29");
  });

  it("debe devolver el último día de un mes de 31 días", () => {
    expect(fechaCorte(2026, 3).toISOString().split("T")[0]).toBe("2026-03-31");
  });

  it("debe devolver el último día de diciembre", () => {
    expect(fechaCorte(2026, 12).toISOString().split("T")[0]).toBe("2026-12-31");
  });
});

describe("primerDiaDelPeriodo", () => {
  it("debe devolver el primer día del mes en UTC", () => {
    expect(primerDiaDelPeriodo(2026, 3).toISOString().split("T")[0]).toBe("2026-03-01");
  });

  it("debe devolver el primer día de enero", () => {
    expect(primerDiaDelPeriodo(2026, 1).toISOString().split("T")[0]).toBe("2026-01-01");
  });
});

describe("esPeriodoValido", () => {
  it("debe aceptar períodos dentro del rango", () => {
    expect(esPeriodoValido(2026, 1)).toBe(true);
    expect(esPeriodoValido(2000, 12)).toBe(true);
    expect(esPeriodoValido(2100, 1)).toBe(true);
  });

  it("debe rechazar meses fuera de 1..12", () => {
    expect(esPeriodoValido(2026, 0)).toBe(false);
    expect(esPeriodoValido(2026, 13)).toBe(false);
  });

  it("debe rechazar años fuera del rango", () => {
    expect(esPeriodoValido(1999, 1)).toBe(false);
    expect(esPeriodoValido(2101, 1)).toBe(false);
  });

  it("debe rechazar meses no enteros", () => {
    expect(esPeriodoValido(2026, 3.5)).toBe(false);
  });
});

describe("compararPeriodos", () => {
  it("debe ordenar por año y luego por mes", () => {
    expect(compararPeriodos({ anio: 2026, mes: 1 }, { anio: 2026, mes: 2 })).toBeLessThan(0);
    expect(compararPeriodos({ anio: 2026, mes: 2 }, { anio: 2026, mes: 1 })).toBeGreaterThan(0);
    expect(compararPeriodos({ anio: 2026, mes: 2 }, { anio: 2026, mes: 2 })).toBe(0);
    expect(compararPeriodos({ anio: 2025, mes: 12 }, { anio: 2026, mes: 1 })).toBeLessThan(0);
  });
});

describe("generarNumeroAsiento", () => {
  it("debe generar el correlativo con formato DEP-AAAAMM-SEQ", () => {
    expect(generarNumeroAsiento(2026, 3, 1)).toBe("DEP-202603-001");
  });

  it("debe rellenar la secuencia a tres dígitos", () => {
    expect(generarNumeroAsiento(2026, 12, 42)).toBe("DEP-202612-042");
  });

  it("debe rechazar secuencias menores a 1", () => {
    expect(() => generarNumeroAsiento(2026, 3, 0)).toThrow("INVALID_ASIENTO_SEQUENCE");
    expect(() => generarNumeroAsiento(2026, 3, -5)).toThrow("INVALID_ASIENTO_SEQUENCE");
  });

  it("debe rechazar secuencias no enteras", () => {
    expect(() => generarNumeroAsiento(2026, 3, 2.5)).toThrow("INVALID_ASIENTO_SEQUENCE");
  });
});

describe("etiquetaPeriodo y periodoDeFecha", () => {
  it("debe etiquetar el período como AAAAMM", () => {
    expect(etiquetaPeriodo(2026, 3)).toBe("202603");
    expect(etiquetaPeriodo(2026, 12)).toBe("202612");
  });

  it("debe derivar el período de una fecha en UTC", () => {
    expect(periodoDeFecha("2026-03-15T00:00:00.000Z")).toEqual({ anio: 2026, mes: 3 });
  });

  it("debe derivar el período de una fecha de fin de año", () => {
    expect(periodoDeFecha("2026-12-31T12:00:00.000Z")).toEqual({ anio: 2026, mes: 12 });
  });
});

describe("fechaContable", () => {
  it("debe coincidir con el último día del período", () => {
    expect(fechaContable(2026, 2).toISOString().split("T")[0]).toBe("2026-02-28");
  });
});
