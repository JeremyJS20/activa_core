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

describe("calcularCuota — casos límite de redondeo", () => {
  it("debe aplicar Half Even cuando la cuota teórica cae en medio centavo (0.025 ⇒ 0.02)", () => {
    const primera = calcularCuota({
      costoAdquisicion: d("0.05"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 2,
    });
    expect(primera.cuota.toFixed(2)).toBe("0.02");
    expect(primera.tipoCuota).toBe("NORMAL");

    const segunda = calcularCuota({
      costoAdquisicion: d("0.05"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: primera.acumuladaNueva,
      vidaUtilMeses: 2,
    });
    expect(segunda.cuota.toFixed(2)).toBe("0.03");
    expect(segunda.esCuotaFinal).toBe(true);
    expect(segunda.valorEnLibrosNuevo.toFixed(2)).toBe("0.00");
  });

  it("debe aplicar Half Even cuando la cuota teórica es 0.015 (⇒ 0.02)", () => {
    const r = calcularCuota({
      costoAdquisicion: d("0.06"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 4,
    });
    expect(r.cuota.toFixed(2)).toBe("0.02");
    expect(r.esCuotaFinal).toBe(false);
  });

  it("debe manejar el tercio exacto (1/3) sin perder centavos", () => {
    const r = calcularCuota({
      costoAdquisicion: d("100.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 3,
    });
    expect(r.cuota.toFixed(2)).toBe("33.33");
    expect(r.esCuotaFinal).toBe(false);
  });

  it("absorbe el remanente antes del último mes cuando el desfase es de un centavo (2/3)", () => {
    const primera = calcularCuota({
      costoAdquisicion: d("200.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 3,
    });
    expect(primera.cuota.toFixed(2)).toBe("66.67");
    expect(primera.esCuotaFinal).toBe(false);

    // remanente 133.33 < 2 × 66.67 (133.34) ⇒ absorbe el remanente en esta cuota
    const segunda = calcularCuota({
      costoAdquisicion: d("200.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: primera.acumuladaNueva,
      vidaUtilMeses: 3,
    });
    expect(segunda.cuota.toFixed(2)).toBe("133.33");
    expect(segunda.esCuotaFinal).toBe(true);
    expect(segunda.valorEnLibrosNuevo.toFixed(2)).toBe("0.00");

    const tercera = calcularCuota({
      costoAdquisicion: d("200.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: segunda.acumuladaNueva,
      vidaUtilMeses: 3,
    });
    expect(tercera.cuota.toFixed(2)).toBe("0.00");
    expect(tercera.tipoCuota).toBe("ULTIMA");
    expect(tercera.valorEnLibrosNuevo.toFixed(2)).toBe("0.00");
  });

  it("debe depreciar todo el monto depreciable cuando la vida útil es 1 mes", () => {
    const r = calcularCuota({
      costoAdquisicion: d("1000.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 1,
    });
    expect(r.cuota.toFixed(2)).toBe("1000.00");
    expect(r.esCuotaFinal).toBe(true);
    expect(r.valorEnLibrosNuevo.toFixed(2)).toBe("0.00");
  });

  it("debe calcular correctamente con vida útil de 1200 meses", () => {
    const r = calcularCuota({
      costoAdquisicion: d("1200.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 1200,
    });
    expect(r.cuota.toFixed(2)).toBe("1.00");
    expect(r.esCuotaFinal).toBe(false);
  });

  it("debe manejar montos de nueve cifras sin pérdida de precisión", () => {
    const r = calcularCuota({
      costoAdquisicion: d("123456789.12"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 84,
    });
    expect(r.cuota.toFixed(2)).toBe("1469723.68");
    expect(new Prisma.Decimal("1469723.68").times(84).toFixed(2)).toBe("123456789.12");
  });

  it("debe tratar un monto depreciable mínimo de doce centavos", () => {
    const r = calcularCuota({
      costoAdquisicion: d("10000.00"),
      valorResidual: d("9999.88"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 12,
    });
    expect(r.cuota.toFixed(2)).toBe("0.01");
    expect(r.tipoCuota).toBe("NORMAL");
  });

  it("debe marcar cuota final cuando el remanente está entre una y dos cuotas teóricas", () => {
    const r = calcularCuota({
      costoAdquisicion: d("10.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("5.50"),
      vidaUtilMeses: 4,
    });
    expect(r.cuota.toFixed(2)).toBe("4.50");
    expect(r.esCuotaFinal).toBe(true);
  });

  it("debe mantener cuota normal cuando el remanente cubre al menos dos cuotas teóricas", () => {
    const r = calcularCuota({
      costoAdquisicion: d("10.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("4.00"),
      vidaUtilMeses: 4,
    });
    expect(r.cuota.toFixed(2)).toBe("2.50");
    expect(r.esCuotaFinal).toBe(false);
  });

  it("debe marcar NO_DEPRECIABLE cuando costo y residual son cero", () => {
    const r = calcularCuota({
      costoAdquisicion: d("0.00"),
      valorResidual: d("0.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 12,
    });
    expect(r.cuota.toFixed(2)).toBe("0.00");
    expect(r.tipoCuota).toBe("NO_DEPRECIABLE");
  });

  it("no debe acumular residuos en 1200 cuotas consecutivas", () => {
    let acumulada = new Prisma.Decimal(0);
    for (let mes = 1; mes <= 1200; mes++) {
      const r = calcularCuota({
        costoAdquisicion: d("1000.00"),
        valorResidual: d("100.00"),
        depreciacionAcumulada: acumulada,
        vidaUtilMeses: 1200,
      });
      acumulada = r.acumuladaNueva;
    }
    expect(acumulada.toFixed(2)).toBe("900.00");
  });

  it("debe mantener el valor residual exacto en 36 cuotas con residual alto", () => {
    let acumulada = new Prisma.Decimal(0);
    for (let mes = 1; mes <= 36; mes++) {
      const r = calcularCuota({
        costoAdquisicion: d("120000.00"),
        valorResidual: d("24000.00"),
        depreciacionAcumulada: acumulada,
        vidaUtilMeses: 36,
      });
      acumulada = r.acumuladaNueva;
    }
    expect(new Prisma.Decimal("120000.00").minus(acumulada).toFixed(2)).toBe("24000.00");
  });

  it("debe aceptar montos como string y como number sin usar aritmética de punto flotante", () => {
    const desdeString = calcularCuota({
      costoAdquisicion: "1000.55",
      valorResidual: "0.55",
      depreciacionAcumulada: "0",
      vidaUtilMeses: 10,
    });
    const desdeNumber = calcularCuota({
      costoAdquisicion: 1000.55,
      valorResidual: 0.55,
      depreciacionAcumulada: 0,
      vidaUtilMeses: 10,
    });
    expect(desdeString.cuota.toFixed(2)).toBe(desdeNumber.cuota.toFixed(2));
    expect(desdeString.cuota.toFixed(2)).toBe("100.00");
  });

  it("debe rechazar vida útil negativa", () => {
    expect(() =>
      calcularCuota({
        costoAdquisicion: d("1000.00"),
        valorResidual: d("0.00"),
        depreciacionAcumulada: d("0.00"),
        vidaUtilMeses: -1,
      })
    ).toThrow("ASSET_TYPE_INVALID_LIFE");
  });

  it("debe devolver cuota cero cuando la acumulada iguala el monto depreciable", () => {
    const r = calcularCuota({
      costoAdquisicion: d("1000.00"),
      valorResidual: d("100.00"),
      depreciacionAcumulada: d("900.00"),
      vidaUtilMeses: 36,
    });
    expect(r.cuota.toFixed(2)).toBe("0.00");
    expect(r.tipoCuota).toBe("ULTIMA");
    expect(r.valorEnLibrosNuevo.toFixed(2)).toBe("100.00");
  });

  it("no debe mutar el objeto de entrada (función pura)", () => {
    const input = {
      costoAdquisicion: d("85000.00"),
      valorResidual: d("8500.00"),
      depreciacionAcumulada: d("0.00"),
      vidaUtilMeses: 48,
    };
    calcularCuota(input);
    expect(input.depreciacionAcumulada.toFixed(2)).toBe("0.00");
    expect(input.costoAdquisicion.toFixed(2)).toBe("85000.00");
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
