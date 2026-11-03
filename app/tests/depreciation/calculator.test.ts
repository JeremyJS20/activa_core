import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  calcularCuota,
  mesesTranscurridos,
} from "../../lib/depreciation/depreciation-calculator";

function d(valor: string): Prisma.Decimal {
  return new Prisma.Decimal(valor);
}

describe("calcularCuota — Línea Recta DGII", () => {
  it("debe calcular la cuota de un activo Cat. 2 (25% anual / 48 meses)", () => {
    const r = calcularCuota({
      costoAdquisicion: d("85000.00"),
      valorResidual: d("8500.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 48,
    });
    expect(r.cuota.toFixed(2)).toBe("1593.75");
    expect(r.tipoCuota).toBe("NORMAL");
    expect(r.esCuotaFinal).toBe(false);
  });

  it("debe aplicar redondeo bancario Half Even en la cuota teórica", () => {
    const r = calcularCuota({
      costoAdquisicion: d("10000.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 3,
    });
    expect(r.cuota.toFixed(2)).toBe("3333.33");
  });

  it("debe ajustar la última cuota para igualar exactamente el valor residual", () => {
    const r = calcularCuota({
      costoAdquisicion: d("10000.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("6666.66"),
      vidaUtilMeses: 3,
    });
    expect(r.cuota.toFixed(2)).toBe("3333.34");
    expect(r.esCuotaFinal).toBe(true);
    expect(r.tipoCuota).toBe("ULTIMA");
    expect(r.valorEnLibrosNuevo.toFixed(2)).toBe("0.00");
  });

  it("debe dejar valorEnLibros igual a valorResidual en el mes 48", () => {
    const r = calcularCuota({
      costoAdquisicion: d("85000.00"),
      valorResidual: d("8500.00"),
      depreciacionAcumulada: d("76406.25"),
      vidaUtilMeses: 48,
    });
    expect(r.valorEnLibrosNuevo.toFixed(2)).toBe("8500.00");
    expect(r.esCuotaFinal).toBe(true);
  });

  it("debe marcar NO_DEPRECIABLE cuando residual iguala el costo", () => {
    const r = calcularCuota({
      costoAdquisicion: d("5000.00"),
      valorResidual: d("5000.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 60,
    });
    expect(r.cuota.toFixed(2)).toBe("0.00");
    expect(r.tipoCuota).toBe("NO_DEPRECIABLE");
    expect(r.esCuotaFinal).toBe(true);
  });

  it("debe devolver cuota cero cuando la vida útil ya está agotada", () => {
    const r = calcularCuota({
      costoAdquisicion: d("10000.00"),
      valorResidual: d("1000.00"),
      depreciacionAcumulada: d("9000.00"),
      vidaUtilMeses: 12,
    });
    expect(r.cuota.toFixed(2)).toBe("0.00");
    expect(r.tipoCuota).toBe("ULTIMA");
    expect(r.valorEnLibrosNuevo.toFixed(2)).toBe("1000.00");
  });

  it("debe rechazar residual mayor al costo", () => {
    expect(() =>
      calcularCuota({
        costoAdquisicion: d("1000.00"),
        valorResidual: d("2000.00"),
        depreciacionAcumulada: d("0.00"),
        vidaUtilMeses: 12,
      })
    ).toThrow("RESIDUAL_EXCEEDS_COST");
  });

  it("debe rechazar vida útil menor o igual a cero", () => {
    expect(() =>
      calcularCuota({
        costoAdquisicion: d("1000.00"),
        valorResidual: d("0.00"),
        depreciacionAcumulada: d("0.00"),
        vidaUtilMeses: 0,
      })
    ).toThrow("ASSET_TYPE_INVALID_LIFE");
  });

  it("debe rechazar acumulada superior al monto depreciable", () => {
    expect(() =>
      calcularCuota({
        costoAdquisicion: d("1000.00"),
        valorResidual: d("100.00"),
        depreciacionAcumulada: d("5000.00"),
        vidaUtilMeses: 12,
      })
    ).toThrow("DEPRECIATION_OVERFLOW");
  });

  it("no debe acumular residuos de centavos en 48 cuotas consecutivas", () => {
    let acumulada = new Prisma.Decimal(0);
    for (let mes = 1; mes <= 48; mes++) {
      const r = calcularCuota({
        costoAdquisicion: d("85000.00"),
        valorResidual: d("8500.00"),
        depreciacionAcumulada: acumulada,
        vidaUtilMeses: 48,
      });
      acumulada = r.acumuladaNueva;
    }
    expect(acumulada.toFixed(2)).toBe("76500.00");
    expect(new Prisma.Decimal("85000.00").minus(acumulada).toFixed(2)).toBe("8500.00");
  });
});

describe("mesesTranscurridos", () => {
  it("debe contar el mes de adquisición como mes 1", () => {
    expect(mesesTranscurridos("2026-03-15", 2026, 3)).toBe(1);
  });

  it("debe contar el mes siguiente como mes 2", () => {
    expect(mesesTranscurridos("2026-03-15", 2026, 4)).toBe(2);
  });

  it("debe devolver 0 para períodos anteriores a la adquisición", () => {
    expect(mesesTranscurridos("2026-03-15", 2026, 2)).toBe(0);
  });

  it("debe cruzar correctamente el cambio de año", () => {
    expect(mesesTranscurridos("2025-11-20", 2026, 2)).toBe(4);
  });
});
