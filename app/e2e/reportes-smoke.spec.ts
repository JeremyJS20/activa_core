import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";

/**
 * Sub-módulo 04 — Consultas y Reportes (REQ-REP-001…008).
 * Smoke E2E: filtros/KPIs, orden, paginación, Kardex, depreciación,
 * exportación XLSX re-parseada con exceljs e impresión vía CDP.
 */
test.describe("Reportes DGII - Smoke Tests E2E", () => {
  test.setTimeout(120_000);

  async function loginAsAdmin(page: import("@playwright/test").Page) {
    await page.goto("/login");
    await page.fill("#correo", "admin@unapec.edu.do");
    await page.fill("#password", "Admin2026!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
    await expect(page.locator("aside")).toBeVisible({ timeout: 60_000 });
  }

  function parseMoney(text: string): number {
    return Number(text.replace(/[^\d.-]/g, "").replace(/,/g, ""));
  }

  async function waitForInventoryRows(page: import("@playwright/test").Page) {
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 30_000 });
  }

  test("1. Inventario: filtros, KPIs, orden por costo y paginación server-side", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/reportes");
    await waitForInventoryRows(page);

    await expect(
      page.getByRole("heading", { name: "Inventario de Activos Fijos", level: 2 })
    ).toBeVisible();

    // Espera la respuesta server-side del filtro antes de leer KPIs
    const filteredResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/reportes/inventario") &&
        response.url().includes("montoMin=100000") &&
        response.status() === 200,
      { timeout: 30_000 }
    );

    // Filtro por rango de costo (UI, no URL directa)
    await page.locator('input[type="number"]').first().fill("100000");
    await expect(page).toHaveURL(/montoMin=100000/, { timeout: 10_000 });
    await filteredResponse;
    await expect(page.locator("article p")).toHaveCount(8, { timeout: 30_000 });

    const pillText = (await page.locator("h2 + span.font-mono").first().innerText()).trim();
    const pillCount = Number(pillText.split(" ")[0]);
    expect(pillCount).toBeGreaterThan(0);

    // KPIs coherentes con el conjunto filtrado (pares label/valor por tarjeta)
    const kpiTexts = await page.locator("article p").allInnerTexts();
    const kpiValues = [kpiTexts[1], kpiTexts[3], kpiTexts[5], kpiTexts[7]];
    expect(Number(kpiValues[0].replace(/[^\d]/g, ""))).toBe(pillCount);
    expect(kpiValues[1]).toMatch(/^RD\$ [\d.,]+$/);
    expect(kpiValues[2]).toMatch(/^RD\$ [\d.,]+$/);
    expect(kpiValues[3]).toMatch(/^RD\$ [\d.,]+$/);
    expect(parseMoney(kpiValues[1])).toBeGreaterThan(0);

    // Orden ascendente y descendente por costo (server-side)
    const costHeader = page.getByRole("button", { name: /Costo \(RD\$\)/ });

    const ascResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/reportes/inventario") &&
        response.url().includes("sort=costo") &&
        response.url().includes("dir=asc") &&
        response.status() === 200,
      { timeout: 30_000 }
    );
    await costHeader.click();
    await expect(page).toHaveURL(/sort=costo/, { timeout: 10_000 });
    await ascResponse;

    const descResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/reportes/inventario") &&
        response.url().includes("sort=costo") &&
        response.url().includes("dir=desc") &&
        response.status() === 200,
      { timeout: 30_000 }
    );
    await costHeader.click();
    await expect(page).toHaveURL(/dir=desc/, { timeout: 10_000 });
    await descResponse;
    await expect(page.locator("article p")).toHaveCount(8, { timeout: 30_000 });

    const costsDesc = (await page.locator("table tbody tr td:nth-child(3)").allInnerTexts()).map(
      parseMoney
    );
    const sortedDesc = [...costsDesc].sort((a, b) => b - a);
    expect(costsDesc).toEqual(sortedDesc);

    // Paginación server-side (solo si el filtro supera una página)
    const nextButton = page.getByRole("button", { name: "Siguiente" });
    if (await nextButton.isEnabled()) {
      const pageResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/api/reportes/inventario") &&
          response.url().includes("page=2") &&
          response.status() === 200,
        { timeout: 30_000 }
      );
      await nextButton.click();
      await expect(page).toHaveURL(/page=2/, { timeout: 10_000 });
      await pageResponse;
      await expect(page.locator("table tbody tr").first()).toBeVisible();

      const prevResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/api/reportes/inventario") &&
          !response.url().includes("page=2") &&
          response.status() === 200,
        { timeout: 30_000 }
      );
      await page.getByRole("button", { name: "Anterior" }).click();
      await expect(page).not.toHaveURL(/page=2/, { timeout: 10_000 });
      await prevResponse;
    }

    // Evidencia visual del shell /reportes (Task 4.1)
    mkdirSync("artifacts", { recursive: true });
    await page.screenshot({ path: "artifacts/reportes-shell-e2e.png", fullPage: true });
  });

  test("2. Kardex del activo: apertura, timeline, cuotas y cierre con ESC", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/reportes");
    await waitForInventoryRows(page);

    await page
      .locator("table tbody tr")
      .first()
      .getByRole("button", { name: /Ver Kardex/ })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText("Línea de tiempo de custodia")).toBeVisible({
      timeout: 20_000,
    });
    await expect(dialog.getByText("Cuotas de depreciación procesadas")).toBeVisible();
    await expect(dialog.getByText("Registro inmutable · solo lectura")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cerrar Kardex" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });
  });

  test("3. Depreciación: período por defecto, totales y filtro por cuenta", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/reportes/depreciacion");
    await waitForInventoryRows(page);

    await expect(page).toHaveURL(/periodo=\d{4}-\d{2}/, { timeout: 20_000 });
    const periodo = new URL(page.url()).searchParams.get("periodo");
    expect(periodo).toMatch(/^\d{4}-\d{2}$/);

    await expect(page.locator('input[type="month"]')).toHaveValue(periodo!);
    await expect(page.locator("tfoot")).toContainText(/totales del período/i);
    await expect(page.locator("tfoot")).toContainText("RD$");
    await expect(page.getByText(/Con datos: \d{4}-\d{2}/)).toBeVisible();

    const accountSelect = page.locator("select").first();
    const options = await accountSelect.locator("option").count();
    expect(options).toBeGreaterThan(1);
    await accountSelect.selectOption({ index: 1 });
    await expect(page).toHaveURL(/cuentaCompra=/, { timeout: 10_000 });
    await page.waitForTimeout(1200);
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("4. Exportación XLSX con fila de totales re-parseada (exceljs)", async ({ page }, testInfo) => {
    await loginAsAdmin(page);
    await page.goto("/reportes?montoMin=100000");
    await waitForInventoryRows(page);
    await page.waitForTimeout(800);

    const kpiValues = await page.locator("article p:last-child").allInnerTexts();
    const kpiCosto = parseMoney(kpiValues[1]);
    const kpiDepreciacion = parseMoney(kpiValues[2]);
    const kpiValorLibros = parseMoney(kpiValues[3]);

    const download = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      (async () => {
        await page.getByRole("button", { name: /Exportar/ }).click();
        await page.getByText("Libro Excel (.xlsx)").click();
      })(),
    ]).then(([event]) => event);

    expect(download.suggestedFilename()).toMatch(/^inventario-activos-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const xlsxPath = testInfo.outputPath("inventario-e2e.xlsx");
    await download.saveAs(xlsxPath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxPath);
    const sheet = workbook.worksheets[0];

    // Fila 1: título institucional; fila 3: encabezados con autoFilter
    expect(sheet.getCell(1, 1).value).toContain("Inventario de Activos Fijos");
    const autoFilter = sheet.autoFilter as unknown as
      | { from?: { row?: number } }
      | string
      | undefined;
    const autoFilterRow =
      typeof autoFilter === "string"
        ? Number(autoFilter.match(/\d+/)?.[0])
        : autoFilter?.from?.row;
    expect(autoFilterRow).toBe(3);

    let totalsRowNumber = 0;
    sheet.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === "TOTALES") totalsRowNumber = rowNumber;
    });
    expect(totalsRowNumber).toBeGreaterThan(3);

    const totalsRow = sheet.getRow(totalsRowNumber);
    expect(Number(totalsRow.getCell(8).value)).toBeCloseTo(kpiCosto, 2);
    expect(Number(totalsRow.getCell(9).value)).toBeCloseTo(kpiDepreciacion, 2);
    expect(Number(totalsRow.getCell(10).value)).toBeCloseTo(kpiValorLibros, 2);
  });

  test("5. Impresión: membrete institucional y PDF vía CDP Page.printToPDF", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/reportes?montoMin=100000");
    await waitForInventoryRows(page);
    await page.waitForTimeout(800);

    await page.emulateMedia({ media: "print" });

    const printView = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const header = document.querySelector("header");
      const bodyText = document.body.innerText.toUpperCase();
      return {
        sidebarOculto: aside ? getComputedStyle(aside).display === "none" : false,
        topbarOculta: header ? getComputedStyle(header).display === "none" : false,
        membrete: bodyText.includes("UNIVERSIDAD APEC · UNAPEC"),
        filtros: bodyText.includes("FILTROS ACTIVOS:"),
        filtroMonto: bodyText.includes("MONTO MÍN. RD$ 100000"),
        sinPaginacion: !bodyText.includes("MOSTRANDO"),
      };
    });

    expect(printView).toEqual({
      sidebarOculto: true,
      topbarOculta: true,
      membrete: true,
      filtros: true,
      filtroMonto: true,
      sinPaginacion: true,
    });

    // CDP: genera el PDF con las reglas @media print aplicadas
    const client = await page.context().newCDPSession(page);
    const pdf = await client.send("Page.printToPDF", {
      printBackground: true,
      landscape: true,
      preferCSSPageSize: true,
    });
    expect(Buffer.from(pdf.data, "base64").byteLength).toBeGreaterThan(10_000);

    await page.emulateMedia({ media: "screen" });
  });
});
