import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTABILIDAD_QUERY,
  codigoPeriodo,
  contabilidadQueryToApiParams,
  contabilidadQueryToSearchParams,
  estadoAsientoLabel,
  formatCount,
  formatFechaContable,
  formatRD,
  nombrePeriodo,
  parseContabilidadQuery,
} from "@/components/contabilidad/types";

describe("parseContabilidadQuery", () => {
  it("usa los valores por defecto con querystring vacío", () => {
    expect(parseContabilidadQuery(new URLSearchParams())).toEqual(
      DEFAULT_CONTABILIDAD_QUERY
    );
  });

  it("interpreta correctamente todos los parámetros válidos", () => {
    const query = parseContabilidadQuery(
      new URLSearchParams(
        "estado=error&periodo=2026-10&page=3&pageSize=25&sort=numero&dir=asc"
      )
    );

    expect(query).toEqual({
      estado: "ERROR",
      periodo: "2026-10",
      page: 3,
      pageSize: 25,
      sort: "numero",
      dir: "asc",
    });
  });

  it("descarta valores inválidos y vuelve a los defaults", () => {
    const query = parseContabilidadQuery(
      new URLSearchParams(
        "estado=OTRO&periodo=2026-13&page=-2&pageSize=13&sort=otro&dir=otro"
      )
    );

    expect(query).toEqual(DEFAULT_CONTABILIDAD_QUERY);
  });

  it("acepta períodos con mes de dos dígitos", () => {
    expect(parseContabilidadQuery(new URLSearchParams("periodo=2026-01")).periodo).toBe(
      "2026-01"
    );
    expect(parseContabilidadQuery(new URLSearchParams("periodo=2026-1")).periodo).toBe("");
  });
});

describe("serialización de la consulta", () => {
  it("omite los valores por defecto en la URL", () => {
    const params = contabilidadQueryToSearchParams(DEFAULT_CONTABILIDAD_QUERY);
    expect(params.toString()).toBe("");
  });

  it("incluye solo los valores no predeterminados", () => {
    const params = contabilidadQueryToSearchParams({
      estado: "ERROR",
      periodo: "2026-10",
      page: 2,
      pageSize: 50,
      sort: "numero",
      dir: "asc",
    });

    expect(params.get("estado")).toBe("ERROR");
    expect(params.get("periodo")).toBe("2026-10");
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("50");
    expect(params.get("sort")).toBe("numero");
    expect(params.get("dir")).toBe("asc");
  });

  it("hace round-trip URL → query → URL", () => {
    const original = new URLSearchParams(
      "estado=PENDIENTE_ENVIO&periodo=2026-09&page=2&pageSize=50&sort=numero&dir=asc"
    );
    const query = parseContabilidadQuery(original);
    const serialized = contabilidadQueryToSearchParams(query);

    expect(parseContabilidadQuery(serialized)).toEqual(query);
  });

  it("construye los parámetros del API con estado y paginación siempre presentes", () => {
    const params = contabilidadQueryToApiParams(DEFAULT_CONTABILIDAD_QUERY);
    expect(params.get("estado")).toBe("TODOS");
    expect(params.get("page")).toBe("1");
    expect(params.get("pageSize")).toBe("10");
    expect(params.get("sort")).toBe("fecha");
    expect(params.get("dir")).toBe("desc");
    expect(params.get("periodo")).toBeNull();
  });
});

describe("formato de presentación", () => {
  it("formatea moneda dominicana a dos decimales", () => {
    expect(formatRD("47812.5")).toBe("RD$ 47,812.50");
    expect(formatRD(0)).toBe("RD$ 0.00");
    expect(formatRD("1234567.891")).toBe("RD$ 1,234,567.89");
  });

  it("aplica redondeo Half-Up a dos decimales", () => {
    expect(formatRD("1.005")).toBe("RD$ 1.01");
  });

  it("protege contra valores no numéricos", () => {
    expect(formatRD("no-es-numero")).toBe("RD$ 0.00");
  });

  it("formatea conteos con separador de miles", () => {
    expect(formatCount(1234)).toBe("1,234");
  });

  it("nombra el período y genera su código", () => {
    expect(nombrePeriodo(2026, 10)).toBe("Octubre 2026");
    expect(codigoPeriodo(2026, 1)).toBe("2026-01");
    expect(nombrePeriodo(2026, 13)).toBe("—");
    expect(codigoPeriodo(2026, 0)).toBe("—");
  });

  it("formatea la fecha contable sin desfase de zona horaria", () => {
    expect(formatFechaContable("2026-10-31T00:00:00.000Z")).toBe("31/10/2026");
    expect(formatFechaContable("fecha-invalida")).toBe("—");
  });

  it("traduce los estados del asiento", () => {
    expect(estadoAsientoLabel("PENDIENTE_ENVIO")).toBe("Pendiente de envío");
    expect(estadoAsientoLabel("ENVIADO")).toBe("Enviado");
    expect(estadoAsientoLabel("ERROR")).toBe("Con error");
    expect(estadoAsientoLabel("OTRO_ESTADO")).toBe("otro estado");
  });
});
