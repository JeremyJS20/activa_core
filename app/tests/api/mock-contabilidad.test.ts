import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mock/contabilidad/asientos/route";
import { resetMockStore } from "@/lib/integracion/mock-store";

const payload = {
  numeroAsiento: "DEP-202610-001",
  concepto: "Depreciación 10/2026",
  fechaAsiento: "2026-10-31",
  estado: "PENDIENTE_ENVIO",
  lineas: [
    {
      tipoInventario: "TPA-001",
      cuentaContable: "6-30-01-0001",
      tipoMovimiento: "DB",
      monto: "1000.00",
      descripcion: "Gasto por depreciación 10/2026",
    },
    {
      tipoInventario: "TPA-001",
      cuentaContable: "1-01-04-0011",
      tipoMovimiento: "CR",
      monto: "1000.00",
      descripcion: "Depreciación acumulada 10/2026",
    },
  ],
  totalDebito: "1000.00",
  totalCredito: "1000.00",
};

function request(headers: Record<string, string> = {}, body: unknown = payload): NextRequest {
  return new NextRequest("http://localhost:3000/api/mock/contabilidad/asientos", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetMockStore();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/mock/contabilidad/asientos", () => {
  it("responde 201 con confirmación institucional y formato WS-YYYYMMDD-NNNNN", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      numeroAsiento: string;
      numeroConfirmacion: string;
      codigoRespuesta: string;
      fechaRecepcion: string;
    };
    expect(body.numeroAsiento).toBe("DEP-202610-001");
    expect(body.numeroConfirmacion).toMatch(/^WS-\d{8}-\d{5}$/);
    expect(body.codigoRespuesta).toBe("201");
    expect(Number.isNaN(Date.parse(body.fechaRecepcion))).toBe(false);
  });

  it("responde 409 con la misma confirmación en un segundo envío del mismo asiento", async () => {
    const primera = await POST(request());
    const bodyPrimera = (await primera.json()) as { numeroConfirmacion: string };

    const segunda = await POST(request());
    expect(segunda.status).toBe(409);
    const bodySegunda = (await segunda.json()) as {
      codigo: string;
      numeroConfirmacion: string;
    };
    expect(bodySegunda.codigo).toBe("ASIENTO_ALREADY_SENT");
    expect(bodySegunda.numeroConfirmacion).toBe(bodyPrimera.numeroConfirmacion);
  });

  it("simula 400 con x-mock-scenario", async () => {
    const response = await POST(request({ "x-mock-scenario": "400" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { codigo: string; errores: unknown[] };
    expect(body.codigo).toBe("VALIDATION_ERROR");
    expect(body.errores.length).toBeGreaterThan(0);
  });

  it("simula 500 con x-mock-scenario", async () => {
    const response = await POST(request({ "x-mock-scenario": "500" }));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { codigo: string };
    expect(body.codigo).toBe("WS_SERVER_ERROR");
  });

  it("simula 409 con confirmación sintética para un asiento nuevo", async () => {
    const response = await POST(
      request({ "x-mock-scenario": "409" }, { ...payload, numeroAsiento: "DEP-202610-009" })
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { numeroConfirmacion: string };
    expect(body.numeroConfirmacion).toMatch(/^WS-\d{8}-\d{5}$/);
  });

  it("rechaza un escenario no soportado", async () => {
    const response = await POST(request({ "x-mock-scenario": "418" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { codigo: string };
    expect(body.codigo).toBe("INVALID_MOCK_SCENARIO");
  });

  it("rechaza un delay fuera de rango", async () => {
    const response = await POST(request({ "x-mock-delay-ms": "30001" }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { codigo: string };
    expect(body.codigo).toBe("INVALID_MOCK_SCENARIO");
  });

  it("acepta un delay válido y responde 201", async () => {
    const response = await POST(request({ "x-mock-delay-ms": "5" }));
    expect(response.status).toBe(201);
  });

  it("rechaza un payload inválido con errores Zod", async () => {
    const response = await POST(request({}, { ...payload, lineas: [] }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { codigo: string; errores: Array<{ path: string }> };
    expect(body.codigo).toBe("VALIDATION_ERROR");
    expect(body.errores.some((error) => error.path === "lineas")).toBe(true);
  });

  it("responde 404 en producción sin ENABLE_WS_MOCK", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_WS_MOCK", "");

    const response = await POST(request());
    expect(response.status).toBe(404);
    const body = (await response.json()) as { codigo: string };
    expect(body.codigo).toBe("NOT_FOUND");
  });

  it("permite el mock en producción con ENABLE_WS_MOCK=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_WS_MOCK", "true");

    const response = await POST(request());
    expect(response.status).toBe(201);
  });

  it("solo expone POST (no GET)", async () => {
    const modulo = await import("@/app/api/mock/contabilidad/asientos/route");
    expect((modulo as { GET?: unknown }).GET).toBeUndefined();
  });
});
