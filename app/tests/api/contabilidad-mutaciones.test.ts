import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
  despachar: vi.fn(),
  reintentar: vi.fn(),
  lote: vi.fn(),
}));

vi.mock("@/lib/auth/rbac", () => ({
  checkSessionPermission: mocks.check,
}));

vi.mock("@/lib/services/integracion-contable.service", () => ({
  despacharAsiento: mocks.despachar,
  reintentarAsiento: mocks.reintentar,
  despacharPendientes: mocks.lote,
}));

import { POST as despachar } from "@/app/api/contabilidad/asientos/[id]/despachar/route";
import { POST as reintentar } from "@/app/api/contabilidad/asientos/[id]/reintentar/route";
import { POST as lote, maxDuration } from "@/app/api/contabilidad/asientos/despachar-pendientes/route";
import { IntegrationError } from "@/lib/integracion/errors";

const usuario = { id: "u-1", correo: "admin@unapec.edu.do" };

function autorizado() {
  mocks.check.mockResolvedValue({
    authorized: true,
    response: null,
    session: { user: { ...usuario, permisos: ["INT_MANAGE"] } },
  });
}

function negado(status: number) {
  mocks.check.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: "x" }, { status }),
    session: null,
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  autorizado();
});

describe("POST /api/contabilidad/asientos/[id]/despachar", () => {
  it("despacha y responde 200 con el resultado", async () => {
    mocks.despachar.mockResolvedValue({
      asientoId: "a-1",
      numeroAsiento: "DEP-202610-001",
      estado: "ENVIADO",
      transaccionWsId: "WS-20261031-00042",
      intento: 1,
    });

    const response = await despachar(
      new NextRequest("http://localhost/api/contabilidad/asientos/a-1/despachar", {
        method: "POST",
      }),
      params("a-1")
    );

    expect(response.status).toBe(200);
    expect(mocks.check).toHaveBeenCalledWith(["INT_MANAGE", "ACC_POST_SEND"]);
    expect(mocks.despachar).toHaveBeenCalledWith("a-1", usuario);
    const body = (await response.json()) as { data: { estado: string } };
    expect(body.data.estado).toBe("ENVIADO");
  });

  it("mapea 409 ASIENTO_ALREADY_SENT", async () => {
    mocks.despachar.mockRejectedValue(new IntegrationError("ASIENTO_ALREADY_SENT"));

    const response = await despachar(
      new NextRequest("http://localhost/api/contabilidad/asientos/a-1/despachar", {
        method: "POST",
      }),
      params("a-1")
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("ASIENTO_ALREADY_SENT");
  });

  it("mapea 422 ASIENTO_UNBALANCED", async () => {
    mocks.despachar.mockRejectedValue(new IntegrationError("ASIENTO_UNBALANCED"));

    const response = await despachar(
      new NextRequest("http://localhost/api/contabilidad/asientos/a-1/despachar", {
        method: "POST",
      }),
      params("a-1")
    );

    expect(response.status).toBe(422);
  });

  it("mapea 504 WS_TIMEOUT", async () => {
    mocks.despachar.mockRejectedValue(new IntegrationError("WS_TIMEOUT"));

    const response = await despachar(
      new NextRequest("http://localhost/api/contabilidad/asientos/a-1/despachar", {
        method: "POST",
      }),
      params("a-1")
    );

    expect(response.status).toBe(504);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("WS_TIMEOUT");
  });

  it("mapea 502 WS_SERVER_ERROR", async () => {
    mocks.despachar.mockRejectedValue(new IntegrationError("WS_SERVER_ERROR"));

    const response = await despachar(
      new NextRequest("http://localhost/api/contabilidad/asientos/a-1/despachar", {
        method: "POST",
      }),
      params("a-1")
    );

    expect(response.status).toBe(502);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("WS_SERVER_ERROR");
  });

  it("responde 401 sin sesión y no invoca al servicio", async () => {
    negado(401);
    const response = await despachar(
      new NextRequest("http://localhost/api/contabilidad/asientos/a-1/despachar", {
        method: "POST",
      }),
      params("a-1")
    );
    expect(response.status).toBe(401);
    expect(mocks.despachar).not.toHaveBeenCalled();
  });
});

describe("POST /api/contabilidad/asientos/[id]/reintentar", () => {
  it("reintenta y responde 200", async () => {
    mocks.reintentar.mockResolvedValue({
      asientoId: "a-1",
      estado: "ENVIADO",
      intento: 2,
    });

    const response = await reintentar(
      new NextRequest("http://localhost/api/contabilidad/asientos/a-1/reintentar", {
        method: "POST",
      }),
      params("a-1")
    );

    expect(response.status).toBe(200);
    expect(mocks.reintentar).toHaveBeenCalledWith("a-1", usuario);
  });

  it("mapea 409 ASIENTO_NOT_RETRYABLE", async () => {
    mocks.reintentar.mockRejectedValue(new IntegrationError("ASIENTO_NOT_RETRYABLE"));

    const response = await reintentar(
      new NextRequest("http://localhost/api/contabilidad/asientos/a-1/reintentar", {
        method: "POST",
      }),
      params("a-1")
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("ASIENTO_NOT_RETRYABLE");
  });
});

describe("POST /api/contabilidad/asientos/despachar-pendientes", () => {
  it("procesa el lote con el período enviado", async () => {
    mocks.lote.mockResolvedValue({ total: 3, enviados: 2, errores: 1, restantes: 0, resultados: [] });

    const response = await lote(
      new NextRequest("http://localhost/api/contabilidad/asientos/despachar-pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: "2026-10" }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.lote).toHaveBeenCalledWith("2026-10", usuario);
    const body = (await response.json()) as { data: { total: number } };
    expect(body.data.total).toBe(3);
  });

  it("acepta body vacío y despacha todos los pendientes", async () => {
    mocks.lote.mockResolvedValue({ total: 0, enviados: 0, errores: 0, restantes: 0, resultados: [] });

    const response = await lote(
      new NextRequest("http://localhost/api/contabilidad/asientos/despachar-pendientes", {
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.lote).toHaveBeenCalledWith(undefined, usuario);
  });

  it("rechaza un período inválido con 400", async () => {
    const response = await lote(
      new NextRequest("http://localhost/api/contabilidad/asientos/despachar-pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodo: "10-2026" }),
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(mocks.lote).not.toHaveBeenCalled();
  });

  it("expone maxDuration=300 para el lote", () => {
    expect(maxDuration).toBe(300);
  });

  it("responde 403 a un usuario sin permiso de despacho", async () => {
    negado(403);
    const response = await lote(
      new NextRequest("http://localhost/api/contabilidad/asientos/despachar-pendientes", {
        method: "POST",
      })
    );
    expect(response.status).toBe(403);
    expect(mocks.lote).not.toHaveBeenCalled();
  });
});
