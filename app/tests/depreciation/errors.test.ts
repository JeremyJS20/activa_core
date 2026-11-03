import { describe, it, expect } from "vitest";
import { DepreciationError, normalizarErrorMotor } from "@/lib/depreciation/errors";

describe("DepreciationError — códigos y estados HTTP", () => {
  it("asigna el estado HTTP correcto a cada código usado por el motor", () => {
    expect(new DepreciationError("VALIDATION_ERROR").status).toBe(400);
    expect(new DepreciationError("PERIOD_NOT_FOUND").status).toBe(404);
    expect(new DepreciationError("PERIOD_ALREADY_EXISTS").status).toBe(409);
    expect(new DepreciationError("PERIOD_IMMUTABLE").status).toBe(409);
    expect(new DepreciationError("ASIENTO_ALREADY_EXISTS").status).toBe(409);
    expect(new DepreciationError("RESIDUAL_EXCEEDS_COST").status).toBe(422);
    expect(new DepreciationError("NO_DEPRECIABLE_ASSETS").status).toBe(422);
    expect(new DepreciationError("ASIENTO_UNBALANCED").status).toBe(500);
    expect(new DepreciationError("AUDIT_LOG_FAILED").status).toBe(500);
    expect(new DepreciationError("DEPRECIATION_RUN_FAILED").status).toBe(500);
  });

  it("usa el título por defecto cuando no se provee detalle", () => {
    const error = new DepreciationError("PERIOD_NOT_FOUND");
    expect(error.message).toBe("Período no encontrado");
    expect(error.title).toBe("Período no encontrado");
    expect(error.name).toBe("DepreciationError");
  });

  it("respeta el detalle provisto por el llamador", () => {
    const error = new DepreciationError("PERIOD_ALREADY_EXISTS", "Ya existe 2026-11");
    expect(error.message).toBe("Ya existe 2026-11");
    expect(error.title).toBe("El período ya existe");
  });
});

describe("normalizarErrorMotor — traducción de errores del cálculo", () => {
  it("traduce RESIDUAL_EXCEEDS_COST", () => {
    const error = normalizarErrorMotor(new Error("RESIDUAL_EXCEEDS_COST"));
    expect(error).toBeInstanceOf(DepreciationError);
    expect(error.code).toBe("RESIDUAL_EXCEEDS_COST");
    expect(error.status).toBe(422);
  });

  it("traduce ASSET_TYPE_INVALID_LIFE", () => {
    expect(normalizarErrorMotor(new Error("ASSET_TYPE_INVALID_LIFE")).code).toBe(
      "ASSET_TYPE_INVALID_LIFE"
    );
  });

  it("traduce DEPRECIATION_OVERFLOW", () => {
    expect(normalizarErrorMotor(new Error("DEPRECIATION_OVERFLOW")).code).toBe(
      "DEPRECIATION_OVERFLOW"
    );
  });

  it("convierte un error desconocido en DEPRECIATION_RUN_FAILED conservando el mensaje", () => {
    const error = normalizarErrorMotor(new Error("boom interno"));
    expect(error.code).toBe("DEPRECIATION_RUN_FAILED");
    expect(error.status).toBe(500);
    expect(error.message).toBe("boom interno");
  });

  it("convierte un valor no-Error en DEPRECIATION_RUN_FAILED con el título por defecto", () => {
    const error = normalizarErrorMotor("algo raro");
    expect(error.code).toBe("DEPRECIATION_RUN_FAILED");
    expect(error.message).toBe("Falló la corrida de depreciación");
  });
});
