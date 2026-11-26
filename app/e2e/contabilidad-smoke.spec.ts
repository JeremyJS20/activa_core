import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Smoke E2E del Sub-módulo 05 — Integración Contable.
 *
 * Flujo: consola/KPIs/filtros → lote → despacho individual → reintento →
 * bitácora/payload → AUDITOR solo lectura y POST directo 403.
 *
 * El WS se resuelve por el mock interno de desarrollo (`/api/mock/contabilidad/asientos`).
 * El test exige que el servidor Next esté corriendo en `PLAYWRIGHT_TEST_BASE_URL`
 * (por defecto http://localhost:3000) y que el mock esté habilitado.
 *
 * Precondición: los 3 asientos demo de `seed-integracion.ts` existen. El test
 * desactiva temporalmente los tipos de activo con cuentas de depreciación
 * duplicadas (el catálogo semilla contiene duplicados que harían ambiguo el
 * `tipoInventario`), y restaura su estado al terminar. La bitácora append-only
 * (nunca se elimina ni se actualiza).
 */

const PENDIENTE = "DEP-202610-001";
const ERROR = "DEP-202609-001";
const ENVIADO = "DEP-202608-001";
const PERIODOS = {
  [PENDIENTE]: "2026-10",
  [ERROR]: "2026-09",
  [ENVIADO]: "2026-08",
} as const;

type EstadoAsiento = "PENDIENTE_ENVIO" | "ERROR" | "ENVIADO";

const BASELINE: Record<string, {
  estado: EstadoAsiento;
  transaccionWsId: string | null;
  codigoRespuestaWs: string | null;
  mensajeRespuestaWs: string | null;
  fechaEnvioWs: Date | null;
}> = {
  [ENVIADO]: {
    estado: "ENVIADO",
    transaccionWsId: "WS-20260828-90001",
    codigoRespuestaWs: "201",
    mensajeRespuestaWs: "Asiento registrado",
    fechaEnvioWs: new Date("2026-08-28T15:00:00.000Z"),
  },
  [ERROR]: {
    estado: "ERROR",
    transaccionWsId: null,
    codigoRespuestaWs: "500",
    mensajeRespuestaWs: "Falla simulada del servidor contable (seed E2E)",
    fechaEnvioWs: null,
  },
  [PENDIENTE]: {
    estado: "PENDIENTE_ENVIO",
    transaccionWsId: null,
    codigoRespuestaWs: null,
    mensajeRespuestaWs: null,
    fechaEnvioWs: null,
  },
};

/** Carga DATABASE_URL desde .env cuando Playwright no lo inyecta. */
function cargarEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const linea of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

function crearPrisma() {
  cargarEnv();
  return new PrismaClient();
}

async function login(page: Page, correo: string, password: string) {
  await page.goto("/login");
  await page.fill("#correo", correo);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await expect(page.locator("aside")).toBeVisible({ timeout: 15000 });
}

async function irAContabilidad(page: Page, periodo?: string) {
  const query = periodo ? `?periodo=${periodo}` : "";
  await page.goto(`/contabilidad${query}`);
  await expect(page.getByRole("heading", { name: "Integración Contable" })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("Asientos Contables", { exact: true })).toBeVisible();
}

async function abrirDetalle(page: Page, numeroAsiento: string) {
  await page
    .locator(`[data-testid="asiento-row-${numeroAsiento}"]`)
    .getByRole("button", { name: `Ver detalle del asiento ${numeroAsiento}` })
    .click();
  const dialog = page.locator('[role="dialog"][aria-labelledby="titulo-detalle-asiento"]');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText("Líneas contables")).toBeVisible({ timeout: 30000 });
  return dialog;
}

let prisma: PrismaClient;
let tiposDesactivados: string[] = [];

test.describe("Integración Contable WS — Smoke E2E", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    prisma = crearPrisma();
    const asientos = await prisma.asientoContable.findMany({
      where: { numeroAsiento: { in: [PENDIENTE, ERROR, ENVIADO] } },
      select: { numeroAsiento: true },
    });
    if (asientos.length !== 3) {
      throw new Error(
        "Faltan los asientos demo del Sub-05. Ejecute `pnpm prisma db seed` antes del E2E."
      );
    }

    // Aísla el catálogo: solo un TipoActivo activo por cuenta de depreciación.
    const tipos = await prisma.tipoActivo.findMany({
      where: { estado: "ACTIVO" },
      select: { id: true, cuentaContableDepreciacion: true },
      orderBy: { codigo: "asc" },
    });
    const cuentasVistas = new Set<string>();
    const duplicados: string[] = [];
    for (const tipo of tipos) {
      if (cuentasVistas.has(tipo.cuentaContableDepreciacion)) {
        duplicados.push(tipo.id);
      } else {
        cuentasVistas.add(tipo.cuentaContableDepreciacion);
      }
    }
    if (duplicados.length > 0) {
      await prisma.tipoActivo.updateMany({
        where: { id: { in: duplicados } },
        data: { estado: "INACTIVO" },
      });
      tiposDesactivados = duplicados;
    }

    await restaurarBaseline();
  });

  test.afterAll(async () => {
    if (prisma) {
      await restaurarBaseline();
      if (tiposDesactivados.length > 0) {
        await prisma.tipoActivo.updateMany({
          where: { id: { in: tiposDesactivados } },
          data: { estado: "ACTIVO" },
        });
      }
      await prisma.$disconnect();
    }
  });

  async function restaurarBaseline() {
    for (const [numeroAsiento, data] of Object.entries(BASELINE)) {
      await prisma.asientoContable.update({
        where: { numeroAsiento },
        data,
      });
    }
  }

  async function preparar(numeroAsiento: string, estado: EstadoAsiento) {
    const data =
      estado === "ERROR"
        ? {
            estado,
            transaccionWsId: null,
            codigoRespuestaWs: "500",
            mensajeRespuestaWs: "Falla simulada del servidor contable (seed E2E)",
            fechaEnvioWs: null,
          }
        : {
            estado,
            transaccionWsId: null,
            codigoRespuestaWs: null,
            mensajeRespuestaWs: null,
            fechaEnvioWs: null,
          };
    await prisma.asientoContable.update({ where: { numeroAsiento }, data });
  }

  test("1. Consola ADMIN: KPIs, tabla, filtros y paginación", async ({ page }) => {
    test.setTimeout(60000);
    await login(page, "admin@unapec.edu.do", "Admin2026!");
    await irAContabilidad(page);

    await expect(
      page.locator("article").filter({ hasText: "Total de asientos" })
    ).toContainText("3");
    await expect(
      page.locator("article").filter({ hasText: "Pendientes de envío" })
    ).toContainText("1");
    await expect(
      page.locator("article").filter({ hasText: "Enviados a contabilidad" })
    ).toContainText("1");
    await expect(page.locator("article").filter({ hasText: "Con error" })).toContainText("1");
    await expect(page.locator("tbody tr")).toHaveCount(3);

    // Filtro por estado: solo el asiento con error; los KPIs del período no cambian.
    await page.selectOption("#filtro-estado-asiento", "ERROR");
    await page.waitForURL(/estado=ERROR/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.locator("tbody tr").first()).toContainText(ERROR);
    await expect(
      page.locator("article").filter({ hasText: "Total de asientos" })
    ).toContainText("3");

    // Filtro por período sin coincidencias: empty state + restablecer.
    await page.fill("#filtro-periodo-asiento", "2026-10");
    await page.waitForURL(/periodo=2026-10/);
    await expect(
      page.getByText("No hay asientos contables para los filtros seleccionados")
    ).toBeVisible();
    await page.getByRole("button", { name: "Restablecer", exact: true }).click();
    await expect(page).toHaveURL(/\/contabilidad$/);
    await expect(page.locator("tbody tr")).toHaveCount(3);

    // Paginación server-side: tamaño 25 y contador del resultset.
    await page.selectOption("#filtro-tamano-asiento", "25");
    await expect(page).toHaveURL(/pageSize=25/);
    await expect(page.getByText("Mostrando 1–3 de 3 asientos")).toBeVisible();
  });

  test("2. Lote: confirmación, resumen y refresco de KPIs", async ({ page }) => {
    test.setTimeout(60000);
    await preparar(PENDIENTE, "PENDIENTE_ENVIO");
    await login(page, "admin@unapec.edu.do", "Admin2026!");
    await irAContabilidad(page, PERIODOS[PENDIENTE]);

    const batch = page.getByRole("button", { name: "Despachar Pendientes en Lote" });
    await expect(batch).toBeVisible();
    await batch.click();

    const dialog = page.locator(
      '[role="dialog"][aria-labelledby="titulo-lote-contabilidad"]'
    );
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Asientos pendientes");
    await expect(dialog).toContainText("Irreversible");

    await dialog.getByRole("button", { name: /Confirmar y despachar/ }).click();
    await expect(dialog.getByText("Enviados", { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await expect(dialog).toContainText("Restantes");
    await expect(dialog).toContainText(/WS-/);

    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    const fila = page.locator(`[data-testid="asiento-row-${PENDIENTE}"]`);
    await expect(fila).toContainText("Enviado", { timeout: 15000 });
  });

  test("3. Detalle PENDIENTE_ENVIO: balance, despacho y confirmación", async ({ page }) => {
    test.setTimeout(60000);
    await preparar(ENVIADO, "PENDIENTE_ENVIO");
    await login(page, "admin@unapec.edu.do", "Admin2026!");
    await irAContabilidad(page, PERIODOS[ENVIADO]);

    const dialog = await abrirDetalle(page, ENVIADO);
    await expect(dialog.getByText("Asiento cuadrado")).toBeVisible();
    await expect(dialog.getByText("RD$ 0.00").first()).toBeVisible();
    await expect(dialog.getByText("Líneas contables")).toBeVisible();

    await dialog.getByRole("button", { name: "Despachar a Contabilidad" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "enviado correctamente" })
    ).toBeVisible({ timeout: 20000 });
    await expect(dialog.getByText("Asiento enviado a Contabilidad")).toBeVisible({
      timeout: 20000,
    });
    await page.keyboard.press("Escape");
  });

  test("4. Reintento de ERROR: transición a ENVIADO", async ({ page }) => {
    test.setTimeout(60000);
    await preparar(ERROR, "ERROR");
    await login(page, "admin@unapec.edu.do", "Admin2026!");
    await irAContabilidad(page, PERIODOS[ERROR]);

    const dialog = await abrirDetalle(page, ERROR);
    await expect(dialog.getByText("Con error").first()).toBeVisible();
    await dialog.getByRole("button", { name: "Reintentar envío" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "enviado correctamente" })
    ).toBeVisible({ timeout: 20000 });
    await expect(dialog.getByText("Asiento enviado a Contabilidad")).toBeVisible({
      timeout: 20000,
    });
    await page.keyboard.press("Escape");
  });

  test("5. Bitácora y payload exacto del intento", async ({ page }) => {
    test.setTimeout(60000);
    await login(page, "admin@unapec.edu.do", "Admin2026!");
    await irAContabilidad(page, PERIODOS[ERROR]);

    const dialog = await abrirDetalle(page, ERROR);
    await dialog.getByRole("button", { name: /Ver bitácora completa/ }).click();
    await expect(dialog.getByText(/Intento #/).first()).toBeVisible({ timeout: 15000 });

    await dialog.getByRole("button", { name: "Ver payload del intento" }).first().click();
    const pre = dialog.locator("pre").first();
    await expect(pre).toContainText('"numeroAsiento"');
    await expect(pre).toContainText(ERROR);
    await expect(dialog.getByRole("button", { name: /Copiar Payload/ })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("6. AUDITOR: solo lectura, bitácora visible y POST directo 403", async ({ page }) => {
    test.setTimeout(60000);
    await login(page, "auditor@unapec.edu.do", "Auditor2026!");
    await irAContabilidad(page, PERIODOS[ERROR]);

    const fila = page.locator(`[data-testid="asiento-row-${ERROR}"]`);
    await expect(fila).toBeVisible();
    await expect(fila.getByRole("button", { name: /Despachar|Reintentar/ })).toHaveCount(0);

    const dialog = await abrirDetalle(page, ERROR);
    await expect(dialog.getByText("Modo auditoría: solo lectura")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Despachar a Contabilidad|Reintentar envío/ })
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: /Ver bitácora completa/ })
    ).toBeVisible();

    const listado = await page.evaluate(async () => {
      const res = await fetch("/api/contabilidad/asientos?estado=TODOS");
      return { ok: res.ok, json: await res.json() };
    });
    expect(listado.ok).toBe(true);
    const asiento = (listado.json as { data: Array<{ id: string; numeroAsiento: string }> }).data.find(
      (item) => item.numeroAsiento === ERROR
    );
    expect(asiento).toBeTruthy();

    const intento = await page.evaluate(async (id) => {
      const res = await fetch(`/api/contabilidad/asientos/${id}/despachar`, {
        method: "POST",
      });
      return { status: res.status, body: await res.json() };
    }, asiento!.id);

    expect(intento.status).toBe(403);
    const body = intento.body as { code?: string; title?: string };
    expect(body.code ?? body.title).toBe("FORBIDDEN");
    await page.keyboard.press("Escape");
  });
});
