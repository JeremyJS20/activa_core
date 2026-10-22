import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  filtersToSearchParams,
  formatCount,
  formatRD,
  searchParamsToFilters,
  type ReportFilters,
} from "@/components/reportes/reportes-types";

describe("formatRD (moneda dominicana)", () => {
  it("formatea cifras con separador de miles y 2 decimales", () => {
    expect(formatRD("400000.00")).toBe("RD$ 400,000.00");
    expect(formatRD("8450000.50")).toBe("RD$ 8,450,000.50");
  });

  it("formatea el caso de los KPIs del REQ-REP-002", () => {
    expect(formatRD("360000.00")).toBe("RD$ 360,000.00");
  });

  it("conserva exactamente 2 decimales aunque el valor venga sin decimales", () => {
    expect(formatRD("1000")).toBe("RD$ 1,000.00");
  });

  it("devuelve RD$ 0.00 para valores no numéricos", () => {
    expect(formatRD("abc")).toBe("RD$ 0.00");
  });
});

describe("formatCount", () => {
  it("usa separador de miles dominicano", () => {
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(0)).toBe("0");
  });
});

describe("sincronización de filtros con el querystring", () => {
  const fullFilters: ReportFilters = {
    fechaInicio: "2026-01-01",
    fechaFin: "2026-12-31",
    montoMin: "50000",
    montoMax: "800000",
    departamentoId: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607",
    tipoActivoId: "9a8b7c6d-5e4f-4321-8765-0f1e2d3c4b5a",
    custodio: "maria",
    search: "ACT-2026",
    estados: ["ACTIVO", "EN_MANTENIMIENTO"],
  };

  it("serializa todos los filtros activos", () => {
    const params = filtersToSearchParams(fullFilters);

    expect(params.get("fechaInicio")).toBe("2026-01-01");
    expect(params.get("montoMin")).toBe("50000");
    expect(params.get("custodio")).toBe("maria");
    expect(params.get("estados")).toBe("ACTIVO,EN_MANTENIMIENTO");
  });

  it("omite los filtros vacíos (URL limpia)", () => {
    const params = filtersToSearchParams(EMPTY_FILTERS);
    expect(params.toString()).toBe("");
  });

  it("reconstruye los filtros desde el querystring (round-trip)", () => {
    const params = filtersToSearchParams(fullFilters);
    expect(searchParamsToFilters(params)).toEqual(fullFilters);
  });

  it("descarta estados desconocidos al reconstruir", () => {
    const params = new URLSearchParams({ estados: "ACTIVO,VENDIDO,DADO_DE_BAJA" });
    expect(searchParamsToFilters(params).estados).toEqual(["ACTIVO", "DADO_DE_BAJA"]);
  });

  it("devuelve filtros vacíos cuando el querystring está vacío", () => {
    expect(searchParamsToFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });
});
