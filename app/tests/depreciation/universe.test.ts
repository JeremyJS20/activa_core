import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { evaluarDepreciabilidad } from "../../lib/depreciation/asset-universe";

const base = {
  estadoActivo: "ACTIVO",
  fechaAdquisicion: "2026-01-15",
  fechaBaja: null as string | null,
  estadoTipoActivo: "ACTIVO",
  costoAdquisicion: new Prisma.Decimal("85000.00"),
  valorResidual: new Prisma.Decimal("8500.00"),
  depreciacionAcumulada: new Prisma.Decimal("0.00"),
  vidaUtilMeses: 48,
  anio: 2026,
  mes: 3,
};

describe("evaluarDepreciabilidad — universo del período", () => {
  it("debe incluir un activo ACTIVO adquirido antes del período", () => {
    const r = evaluarDepreciabilidad(base);
    expect(r.depreciable).toBe(true);
    expect(r.motivo).toBeNull();
    expect(r.indiceMes).toBe(3);
  });

  it("debe incluir un activo EN_MANTENIMIENTO", () => {
    const r = evaluarDepreciabilidad({ ...base, estadoActivo: "EN_MANTENIMIENTO" });
    expect(r.depreciable).toBe(true);
  });

  it("debe excluir un activo DADO_DE_BAJA", () => {
    const r = evaluarDepreciabilidad({ ...base, estadoActivo: "DADO_DE_BAJA" });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("ESTADO_NO_DEPRECIABLE");
  });

  it("debe excluir un activo VENDIDO", () => {
    const r = evaluarDepreciabilidad({ ...base, estadoActivo: "VENDIDO" });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("ESTADO_NO_DEPRECIABLE");
  });

  it("debe excluir un activo adquirido después del corte del período", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      fechaAdquisicion: "2026-04-02",
      anio: 2026,
      mes: 3,
    });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("ADQUIRIDO_DESPUES_DEL_CORTE");
  });

  it("debe incluir un activo adquirido el último día del mes", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      fechaAdquisicion: "2026-01-31",
      anio: 2026,
      mes: 1,
    });
    expect(r.depreciable).toBe(true);
    expect(r.indiceMes).toBe(1);
  });

  it("debe excluir un activo con baja anterior al período", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      fechaBaja: "2026-02-10",
      anio: 2026,
      mes: 3,
    });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("BAJA_ANTERIOR_AL_PERIODO");
  });

  it("debe incluir un activo cuya baja es posterior al corte del período", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      fechaBaja: "2026-03-20",
      anio: 2026,
      mes: 2,
    });
    expect(r.depreciable).toBe(true);
  });

  it("debe excluir un activo cuyo tipo está INACTIVO", () => {
    const r = evaluarDepreciabilidad({ ...base, estadoTipoActivo: "INACTIVO" });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("TIPO_ACTIVO_INACTIVO");
  });

  it("debe excluir un activo con vida útil agotada", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      fechaAdquisicion: "2020-01-15",
      vidaUtilMeses: 48,
      anio: 2026,
      mes: 3,
    });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("VIDA_UTIL_AGOTADA");
  });

  it("debe excluir un activo sin remanente depreciable", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      depreciacionAcumulada: new Prisma.Decimal("76500.00"),
    });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("SIN_REMANENTE");
  });

  it("debe excluir un activo con residual igual al costo", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      valorResidual: new Prisma.Decimal("85000.00"),
    });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("SIN_REMANENTE");
  });

  it("debe contabilizar el índice del primer mes en 1", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      fechaAdquisicion: "2026-01-15",
      anio: 2026,
      mes: 1,
    });
    expect(r.indiceMes).toBe(1);
  });

  it("no debe modificar el estado del activo (función pura)", () => {
    const input = { ...base };
    evaluarDepreciabilidad(input);
    expect(input.estadoActivo).toBe("ACTIVO");
  });

  it("debe excluir un estado de activo no contemplado en las listas conocidas", () => {
    const r = evaluarDepreciabilidad({ ...base, estadoActivo: "EXTRAVIADO" });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("ESTADO_NO_DEPRECIABLE");
  });

  it("marca VIDA_UTIL_INVALIDA con vida útil cero (el servicio debe abortar)", () => {
    const r = evaluarDepreciabilidad({ ...base, vidaUtilMeses: 0 });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("VIDA_UTIL_INVALIDA");
  });

  it("marca VIDA_UTIL_INVALIDA con vida útil negativa (el servicio debe abortar)", () => {
    const r = evaluarDepreciabilidad({ ...base, vidaUtilMeses: -12 });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("VIDA_UTIL_INVALIDA");
  });

  it("marca RESIDUAL_EXCEEDS_COST cuando el residual supera el costo (el servicio debe abortar)", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      costoAdquisicion: new Prisma.Decimal("1000.00"),
      valorResidual: new Prisma.Decimal("1000.01"),
    });
    expect(r.depreciable).toBe(false);
    expect(r.motivo).toBe("RESIDUAL_EXCEEDS_COST");
  });

  it("debe exigir el primer mes completo cuando se adquiere en el mes del período", () => {
    const r = evaluarDepreciabilidad({
      ...base,
      fechaAdquisicion: "2026-03-31T23:00:00.000Z",
      anio: 2026,
      mes: 3,
    });
    expect(r.depreciable).toBe(true);
    expect(r.indiceMes).toBe(1);
  });

  it("debe aceptar montos en string y en number de forma equivalente", () => {
    const desdeString = evaluarDepreciabilidad({
      ...base,
      costoAdquisicion: "85000.00",
      valorResidual: "8500.00",
      depreciacionAcumulada: "0.00",
    });
    const desdeNumber = evaluarDepreciabilidad({
      ...base,
      costoAdquisicion: 85000,
      valorResidual: 8500,
      depreciacionAcumulada: 0,
    });
    expect(desdeString.depreciable).toBe(true);
    expect(desdeNumber.depreciable).toBe(true);
  });
});
