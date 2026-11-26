import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { dispatchAsiento } from "@/lib/services/ws-contabilidad.client";
import { IntegrationError, integrationStatusFor } from "@/lib/integracion/errors";
import {
  metaSolicitud,
  nuevaCorrelationId,
  respuestaIntegracionError,
  serializarIntegracion,
} from "@/lib/integracion/http";
import type { AsientoPayload } from "@/lib/schemas/integracion";

const payload: AsientoPayload = {
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

const opcionesBase = {
  url: "http://localhost:3000/api/mock/contabilidad/asientos",
  timeoutMs: 5000,
  apiKey: "secret-token",
  correlationId: "corr-test",
};

function respuesta(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function headersDe(init: RequestInit | undefined): Record<string, string> {
  return (init?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("dispatchAsiento — éxito", () => {
  it("envía el payload y retorna la confirmación 201", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuesta(201, {
        numeroAsiento: "DEP-202610-001",
        numeroConfirmacion: "WS-20261031-00042",
        codigoRespuesta: "201",
        mensaje: "Asiento registrado",
      })
    );

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(resultado).toMatchObject({
      ok: true,
      httpStatus: 201,
      resultado: "EXITOSO",
      transaccionWsId: "WS-20261031-00042",
      codigo: "201",
    });

    const llamada = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(llamada[0]).toBe(opcionesBase.url);
    expect(llamada[1].method).toBe("POST");
    const headers = headersDe(llamada[1]);
    expect(headers["x-correlation-id"]).toBe("corr-test");
    expect(headers.Authorization).toBe("Bearer secret-token");
    expect(JSON.stringify(resultado)).not.toContain("secret-token");
  });

  it("usa un header de autenticación personalizado (x-api-key) sin prefijo Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuesta(201, { numeroConfirmacion: "WS-20261031-00043" })
    );

    await dispatchAsiento(payload, {
      ...opcionesBase,
      apiKey: "abc-123",
      authHeader: "x-api-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const headers = headersDe((fetchMock.mock.calls[0] as [string, RequestInit])[1]);
    expect(headers["x-api-key"]).toBe("abc-123");
  });

  it("acepta 200 como éxito", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respuesta(200, { numeroConfirmacion: "WS-20261031-00044" }));

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(resultado.ok).toBe(true);
    expect(resultado.httpStatus).toBe(200);
  });
});

describe("dispatchAsiento — errores del WS", () => {
  it("mapea 400 a WS_REJECTED conservando el mensaje", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuesta(400, { codigo: "VALIDATION_ERROR", mensaje: "Cuenta inválida" })
    );

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(resultado).toMatchObject({
      ok: false,
      httpStatus: 400,
      codigo: "WS_REJECTED",
      resultado: "RECHAZADO",
      mensaje: "Cuenta inválida",
    });
  });

  it("reconcilia un 409 con numeroConfirmacion como EXITOSO/RECONCILIADO", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respuesta(409, {
        codigo: "ASIENTO_ALREADY_SENT",
        numeroConfirmacion: "WS-20261031-00042",
        mensaje: "Ya registrado",
      })
    );

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(resultado).toMatchObject({
      ok: true,
      httpStatus: 409,
      resultado: "RECONCILIADO",
      transaccionWsId: "WS-20261031-00042",
    });
  });

  it("marca WS_DUPLICATE_UNCONFIRMED si el 409 no trae confirmación", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respuesta(409, { codigo: "ASIENTO_ALREADY_SENT" }));

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.codigo).toBe("WS_DUPLICATE_UNCONFIRMED");
    expect(resultado.httpStatus).toBe(409);
  });

  it("mapea 5xx a WS_SERVER_ERROR", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respuesta(500, { codigo: "WS_SERVER_ERROR", mensaje: "Falla interna" }));

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(resultado).toMatchObject({
      ok: false,
      httpStatus: 500,
      codigo: "WS_SERVER_ERROR",
      resultado: "RECHAZADO",
    });
  });

  it("marca WS_INVALID_RESPONSE si el 201 no cumple el contrato Zod", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta(201, { mensaje: "sin confirmación" }));

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.codigo).toBe("WS_INVALID_RESPONSE");
    expect(resultado.httpStatus).toBe(201);
  });
});

describe("dispatchAsiento — red y timeout", () => {
  it("aborta por timeout con AbortController y retorna WS_TIMEOUT", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    );

    const promesa = dispatchAsiento(payload, {
      ...opcionesBase,
      timeoutMs: 1000,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(1000);
    const resultado = await promesa;

    expect(resultado).toMatchObject({
      ok: false,
      httpStatus: null,
      codigo: "WS_TIMEOUT",
      resultado: "TIMEOUT",
    });
  });

  it("mapea un fallo de red a WS_NETWORK_ERROR", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(resultado).toMatchObject({
      ok: false,
      httpStatus: null,
      codigo: "WS_NETWORK_ERROR",
      resultado: "ERROR_RED",
    });
  });
});

describe("dispatchAsiento — configuración y validación previa", () => {
  it("lanza WS_CONFIG_ERROR en producción sin WS_CONTABILIDAD_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WS_CONTABILIDAD_URL", "");

    await expect(dispatchAsiento(payload, { timeoutMs: 5000 })).rejects.toMatchObject({
      code: "WS_CONFIG_ERROR",
    });
  });

  it("lanza WS_CONFIG_ERROR en producción si la URL no es HTTPS", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WS_CONTABILIDAD_URL", "http://contabilidad.unapec.edu.do/asientos");

    await expect(dispatchAsiento(payload, { timeoutMs: 5000 })).rejects.toMatchObject({
      code: "WS_CONFIG_ERROR",
    });
  });

  it("lanza WS_CONFIG_ERROR si el timeout está fuera del rango 1000–30000", async () => {
    await expect(
      dispatchAsiento(payload, { ...opcionesBase, timeoutMs: 500 })
    ).rejects.toMatchObject({ code: "WS_CONFIG_ERROR" });
  });

  it("lanza VALIDATION_ERROR y no llama al WS si el payload saliente es inválido", async () => {
    const fetchMock = vi.fn();
    const invalido = { ...payload, lineas: [] } as unknown as AsientoPayload;

    await expect(
      dispatchAsiento(invalido, { ...opcionesBase, fetchImpl: fetchMock as unknown as typeof fetch })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("http.ts — RFC 7807 y serialización", () => {
  it("genera problem+json con el código y status del error de dominio", async () => {
    const response = respuestaIntegracionError(new IntegrationError("ASIENTO_ALREADY_SENT"));

    expect(response.status).toBe(409);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    const body = (await response.json()) as { code: string; status: number; title: string };
    expect(body.code).toBe("ASIENTO_ALREADY_SENT");
    expect(body.status).toBe(409);
    expect(body.title).toBe("ASIENTO_ALREADY_SENT");
  });

  it("convierte un error inesperado en 500 INTEGRATION_INTERNAL_ERROR", async () => {
    const response = respuestaIntegracionError(new Error("boom"));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("INTEGRATION_INTERNAL_ERROR");
  });

  it("serializa Decimal y Date de forma estable", () => {
    const serializado = serializarIntegracion({
      monto: new Prisma.Decimal("1000.5"),
      fecha: new Date("2026-10-31T00:00:00.000Z"),
      anidado: [{ monto: new Prisma.Decimal("2.25") }],
    });

    expect(serializado).toEqual({
      monto: "1000.50",
      fecha: "2026-10-31T00:00:00.000Z",
      anidado: [{ monto: "2.25" }],
    });
  });

  it("genera correlation-id con formato UUID", () => {
    expect(nuevaCorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("incluye details e instance cuando se entrega un request", async () => {
    const req = new NextRequest("http://localhost/api/contabilidad/asientos/1/despachar");
    const response = respuestaIntegracionError(
      new IntegrationError("ASIENTO_UNBALANCED", "descuadrado", { totalDebito: "100.00" }),
      req
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      instance: string;
      errors: { totalDebito: string };
    };
    expect(body.instance).toBe("/api/contabilidad/asientos/1/despachar");
    expect(body.errors).toEqual({ totalDebito: "100.00" });
  });

  it("metaSolicitud toma el primer x-forwarded-for y el user-agent", () => {
    const req = new NextRequest("http://localhost/api", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        "user-agent": "playwright-test",
      },
    });
    expect(metaSolicitud(req)).toEqual({
      ipAddress: "1.2.3.4",
      userAgent: "playwright-test",
    });
  });

  it("metaSolicitud usa x-real-ip, trunca user-agent y tolera headers ausentes", () => {
    const conRealIp = new NextRequest("http://localhost/api", {
      headers: { "x-real-ip": "9.9.9.9", "user-agent": "x".repeat(300) },
    });
    const meta = metaSolicitud(conRealIp);
    expect(meta.ipAddress).toBe("9.9.9.9");
    expect(meta.userAgent).toHaveLength(255);

    const sinHeaders = new NextRequest("http://localhost/api");
    expect(metaSolicitud(sinHeaders)).toEqual({ ipAddress: null, userAgent: null });
  });

  it("serializa null, undefined y primitivos sin alterarlos", () => {
    expect(serializarIntegracion(null)).toBeNull();
    expect(serializarIntegracion(undefined)).toBeUndefined();
    expect(serializarIntegracion("texto")).toBe("texto");
    expect(serializarIntegracion(42)).toBe(42);
  });

  it("integrationStatusFor expone el status HTTP del catálogo", () => {
    expect(integrationStatusFor("ASIENTO_ALREADY_SENT")).toBe(409);
    expect(integrationStatusFor("WS_TIMEOUT")).toBe(504);
    expect(integrationStatusFor("TIPO_INVENTARIO_UNRESOLVED")).toBe(422);
  });
});

describe("dispatchAsiento — ramas adicionales", () => {
  it("mapea un 4xx distinto de 400/409 a WS_REJECTED", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respuesta(403, { codigo: "FORBIDDEN", mensaje: "Sin permiso" }));

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(resultado.ok).toBe(false);
    expect(resultado.httpStatus).toBe(403);
    expect(resultado.codigo).toBe("WS_REJECTED");
  });

  it("no envía header de autorización si no hay API key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respuesta(201, { numeroConfirmacion: "WS-20261031-00045" }));

    await dispatchAsiento(payload, {
      ...opcionesBase,
      apiKey: "",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const headers = headersDe((fetchMock.mock.calls[0] as [string, RequestInit])[1]);
    expect(headers.Authorization).toBeUndefined();
  });

  it("usa el mock interno como fallback en desarrollo", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("WS_CONTABILIDAD_URL", "");
    vi.stubEnv("APP_URL", "http://localhost:3000");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respuesta(201, { numeroConfirmacion: "WS-20261031-00046" }));

    await dispatchAsiento(payload, {
      ...opcionesBase,
      url: undefined,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const url = (fetchMock.mock.calls[0] as [string, RequestInit])[0];
    expect(url).toBe("http://localhost:3000/api/mock/contabilidad/asientos");
  });

  it("conserva el texto crudo cuando el 500 no es JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Falla cruda del servidor", { status: 500, headers: { "Content-Type": "text/plain" } })
    );

    const resultado = await dispatchAsiento(payload, {
      ...opcionesBase,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(resultado.codigo).toBe("WS_SERVER_ERROR");
    expect(resultado.mensaje).toBe("Falla cruda del servidor");
  });
});
