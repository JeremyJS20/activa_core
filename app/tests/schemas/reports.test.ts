import { describe, expect, it } from "vitest";
import {
  DepreciacionQuerySchema,
  ExportQuerySchema,
  InventarioQuerySchema,
  KardexParamsSchema,
  MAX_EXPORT_ROWS,
  parseEstadosParam,
  PeriodoFiscalSchema,
} from "@/lib/schemas/report.schema";

const UUID_DEPTO = "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607";
const UUID_TIPO = "9a8b7c6d-5e4f-4321-8765-0f1e2d3c4b5a";

describe("InventarioQuerySchema", () => {
  it("aplica defaults cuando no se envía ningún parámetro", () => {
    const parsed = InventarioQuerySchema.parse({});
    expect(parsed).toMatchObject({ sort: "codigo", dir: "asc", page: 1, pageSize: 25 });
  });

  it("normaliza page y pageSize desde strings (querystring)", () => {
    const parsed = InventarioQuerySchema.parse({ page: "3", pageSize: "50" });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(50);
  });

  it("acepta todos los filtros válidos combinados", () => {
    const parsed = InventarioQuerySchema.parse({
      fechaInicio: "2026-01-01",
      fechaFin: "2026-12-31",
      montoMin: "50000.00",
      montoMax: "800000.50",
      departamentoId: UUID_DEPTO,
      tipoActivoId: UUID_TIPO,
      custodio: "maria",
      search: "ACT-2026-0042",
      estados: ["ACTIVO", "EN_MANTENIMIENTO"],
      sort: "costo",
      dir: "desc",
      page: "2",
      pageSize: "10",
    });
    expect(parsed.estados).toEqual(["ACTIVO", "EN_MANTENIMIENTO"]);
    expect(parsed.sort).toBe("costo");
  });

  it("rechaza fechaFin anterior a fechaInicio", () => {
    const result = InventarioQuerySchema.safeParse({
      fechaInicio: "2026-06-01",
      fechaFin: "2026-05-31",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["fechaFin"]);
      expect(result.error.issues[0]?.message).toContain("La fecha final no puede ser anterior");
    }
  });

  it("acepta fechaFin igual a fechaInicio (rango de un solo día)", () => {
    const result = InventarioQuerySchema.safeParse({
      fechaInicio: "2026-06-01",
      fechaFin: "2026-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("rechaza fecha con formato inválido", () => {
    expect(InventarioQuerySchema.safeParse({ fechaInicio: "01/06/2026" }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ fechaInicio: "2026-13-01" }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ fechaInicio: "2026-02-31" }).success).toBe(false);
  });

  it("rechaza montoMax menor a montoMin", () => {
    const result = InventarioQuerySchema.safeParse({ montoMin: "100000", montoMax: "50000" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("El monto máximo no puede ser menor");
    }
  });

  it("acepta montos iguales (rango cerrado de un valor)", () => {
    expect(InventarioQuerySchema.safeParse({ montoMin: "1000.00", montoMax: "1000.00" }).success).toBe(true);
  });

  it("rechaza montos negativos o con más de 2 decimales", () => {
    expect(InventarioQuerySchema.safeParse({ montoMin: "-10" }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ montoMin: "10.999" }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ montoMin: "abc" }).success).toBe(false);
  });

  it("rechaza sort fuera de la whitelist (protección anti-injection en orderBy)", () => {
    expect(InventarioQuerySchema.safeParse({ sort: "password_hash" }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ sort: "codigo; DROP TABLE activos_fijos" }).success).toBe(false);
  });

  it("rechaza dir inválida", () => {
    expect(InventarioQuerySchema.safeParse({ dir: "sideways" }).success).toBe(false);
  });

  it("rechaza pageSize fuera de {10,25,50}", () => {
    expect(InventarioQuerySchema.safeParse({ pageSize: "20" }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ pageSize: "100" }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ pageSize: "abc" }).success).toBe(false);
  });

  it("rechaza page menor a 1", () => {
    expect(InventarioQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ page: "-2" }).success).toBe(false);
  });

  it("rechaza estados desconocidos y arreglos vacíos", () => {
    expect(InventarioQuerySchema.safeParse({ estados: ["VENDIDO"] }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ estados: [] }).success).toBe(false);
  });

  it("rechaza UUIDs mal formados en filtros de catálogo", () => {
    expect(InventarioQuerySchema.safeParse({ departamentoId: "DEP-001" }).success).toBe(false);
    expect(InventarioQuerySchema.safeParse({ tipoActivoId: "123" }).success).toBe(false);
  });
});

describe("parseEstadosParam", () => {
  it("parsea lista separada por comas", () => {
    expect(parseEstadosParam("ACTIVO,en_mantenimiento")).toEqual(["ACTIVO", "EN_MANTENIMIENTO"]);
  });

  it("parsea valores repetidos en la URL (arreglo)", () => {
    expect(parseEstadosParam(["ACTIVO", "DADO_DE_BAJA"])).toEqual(["ACTIVO", "DADO_DE_BAJA"]);
  });

  it("devuelve undefined para vacío o ausente", () => {
    expect(parseEstadosParam(undefined)).toBeUndefined();
    expect(parseEstadosParam("")).toBeUndefined();
    expect(parseEstadosParam(" , ")).toBeUndefined();
  });
});

describe("DepreciacionQuerySchema", () => {
  it("acepta período válido y defaults de paginación", () => {
    const parsed = DepreciacionQuerySchema.parse({ periodo: "2026-10" });
    expect(parsed).toMatchObject({ periodo: "2026-10", page: 1, pageSize: 25 });
  });

  it("rechaza período 2026-13 y formatos alternativos", () => {
    expect(DepreciacionQuerySchema.safeParse({ periodo: "2026-13" }).success).toBe(false);
    expect(DepreciacionQuerySchema.safeParse({ periodo: "26-10" }).success).toBe(false);
    expect(DepreciacionQuerySchema.safeParse({ periodo: "2026-1" }).success).toBe(false);
  });

  it("exige el período (obligatorio)", () => {
    expect(DepreciacionQuerySchema.safeParse({}).success).toBe(false);
  });

  it("valida cuentas contables con la máscara X-XX-XX-XXXX", () => {
    expect(
      DepreciacionQuerySchema.safeParse({ periodo: "2026-10", cuentaCompra: "1-01-04-0020" }).success
    ).toBe(true);
    expect(
      DepreciacionQuerySchema.safeParse({ periodo: "2026-10", cuentaDepreciacion: "101040020" }).success
    ).toBe(false);
  });

  it("valida formato de período de forma aislada", () => {
    expect(PeriodoFiscalSchema.safeParse("2026-01").success).toBe(true);
    expect(PeriodoFiscalSchema.safeParse("2026-00").success).toBe(false);
  });
});

describe("KardexParamsSchema", () => {
  it("acepta UUID válido", () => {
    expect(KardexParamsSchema.safeParse({ id: "2c1d0e9f-8a7b-4c6d-9e5f-1a2b3c4d5e6f" }).success).toBe(true);
  });

  it("rechaza id no UUID", () => {
    expect(KardexParamsSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});

describe("ExportQuerySchema", () => {
  it("acepta exportación de inventario xlsx", () => {
    const parsed = ExportQuerySchema.parse({ reporte: "inventario", formato: "xlsx" });
    expect(parsed).toMatchObject({ reporte: "inventario", formato: "xlsx", precheck: false });
  });

  it("transforma precheck=true de string a booleano", () => {
    const parsed = ExportQuerySchema.parse({
      reporte: "depreciacion",
      formato: "csv",
      periodo: "2026-10",
      precheck: "true",
    });
    expect(parsed.precheck).toBe(true);
  });

  it("rechaza reporte o formato desconocidos", () => {
    expect(ExportQuerySchema.safeParse({ reporte: "usuarios", formato: "xlsx" }).success).toBe(false);
    expect(ExportQuerySchema.safeParse({ reporte: "inventario", formato: "pdf" }).success).toBe(false);
  });

  it("expone el tope operativo de 10,000 filas", () => {
    expect(MAX_EXPORT_ROWS).toBe(10_000);
  });
});
