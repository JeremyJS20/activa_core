import { test, expect } from "@playwright/test";

test.describe("Catálogos Base - Smoke Tests E2E", () => {
  // Helper para inicio de sesión seguro como Administrador General UNAPEC
  async function loginAsAdmin(page: any) {
    await page.goto("/login");
    await page.fill("#correo", "admin@unapec.edu.do");
    await page.fill("#password", "Admin2026!");
    await page.click('button[type="submit"]');
    // Esperar a que la navegación institucional y la sesión se establezcan
    await expect(page.locator("aside")).toBeVisible({ timeout: 15000 });
  }

  // Generador determinista de cédulas dominicanas válidas (Módulo 10 JCE)
  function generateValidCedula(): string {
    const random7 = Math.floor(1000000 + Math.random() * 9000000).toString();
    const base = "402" + random7;
    const multiplicadores = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
    let suma = 0;
    for (let i = 0; i < 10; i++) {
      const digito = parseInt(base[i], 10);
      const prod = digito * multiplicadores[i];
      suma += prod > 9 ? prod - 9 : prod;
    }
    const residuo = suma % 10;
    const digitoVerificador = residuo === 0 ? 0 : 10 - residuo;
    return base + digitoVerificador.toString();
  }

  test("1. Navegación fluida por las pestañas del módulo de Catálogos Base", async ({ page }) => {
    await loginAsAdmin(page);

    // Navegar a Departamentos
    await page.goto("/catalogos/departamentos");
    await expect(page.locator("h1")).toContainText("Catálogos Base");
    await expect(page.getByRole("heading", { name: "Listado de Departamentos" })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();

    // Navegar a Tipos de Activos mediante Tab
    await page.getByRole("link", { name: "Tipos de Activos" }).click();
    await page.waitForURL("**/catalogos/tipos-activos", { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Listado de Tipos de Activos" })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();

    // Navegar a Empleados Custodios mediante Tab
    await page.getByRole("link", { name: "Empleados Custodios" }).click();
    await page.waitForURL("**/catalogos/empleados", { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Directorio de Custodios & Colaboradores" })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible();
  });

  test("2. Flujo de registro de nuevo Departamento", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/catalogos/departamentos");

    const deptName = "Depto Auditoría E2E " + Date.now().toString().slice(-4);

    // Abrir modal
    await page.getByRole("button", { name: "Nuevo Departamento" }).click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal.getByRole("heading", { name: "Nuevo Departamento" })).toBeVisible();

    // Llenar descripción
    await modal.locator('input[placeholder*="Dirección de Tecnología"]').fill(deptName);

    // Guardar
    await modal.getByRole("button", { name: "Crear Departamento" }).click();

    // Verificar que el modal se cerró y el nuevo departamento aparece
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    await page.fill('input[placeholder*="Buscar"]', deptName);
    await expect(page.locator("table").first()).toContainText(deptName, { timeout: 10000 });
  });

  test("3. Flujo de registro de Tipo de Activo con auto-cálculo de Categoría Fiscal DGII", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/catalogos/tipos-activos");

    const assetTypeName = "Laptops E2E " + Date.now().toString().slice(-4);

    // Abrir modal
    await page.getByRole("button", { name: "Nuevo Tipo de Activo" }).click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal.getByRole("heading", { name: "Nuevo Tipo de Activo" })).toBeVisible();

    // Seleccionar Categoría 2 DGII dentro del modal
    const catSelect = modal.locator('select:has(option[value="DGII_CAT2"])');
    await catSelect.selectOption("DGII_CAT2");

    // Verificar que porcentaje y vida útil se configuran automáticamente (25% y 48 meses)
    const inputsNumber = modal.locator('input[type="number"]');
    await expect(inputsNumber.first()).toHaveValue("25");
    await expect(inputsNumber.nth(1)).toHaveValue("48");

    // Llenar descripción y cuentas contables oficiales con máscara
    await modal.locator('input[placeholder*="Equipos de Computación"]').fill(assetTypeName);
    await modal.locator('input[placeholder*="1-01-05-0001"]').fill("1-02-01-0010");
    await modal.locator('input[placeholder*="1-01-05-0002"]').fill("5-01-02-0003");

    // Guardar
    await modal.getByRole("button", { name: "Crear Tipo de Activo" }).click();

    // Verificar guardado
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    await page.fill('input[placeholder*="Buscar"]', assetTypeName);
    await expect(page.locator("table").first()).toContainText(assetTypeName, { timeout: 10000 });
  });

  test("4. Validación reactiva Módulo 10 JCE y registro de Colaborador Custodio", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/catalogos/empleados");

    // Abrir modal
    await page.getByRole("button", { name: "Nuevo Colaborador" }).click();
    const modal = page.locator(".fixed.inset-0");
    await expect(modal.getByRole("heading", { name: "Nuevo Colaborador / Custodio" })).toBeVisible();

    const cedulaInput = modal.locator('input[placeholder="402-0000000-0"]');

    // 1. Probar cédula con dígito verificador inválido
    await cedulaInput.fill("40200000001");
    await expect(modal.locator("text=Dígito verificador inválido JCE")).toBeVisible();

    // 2. Corregir con cédula válida real única (Módulo 10)
    const validCedula = generateValidCedula();
    await cedulaInput.fill(validCedula);
    await expect(modal.locator("text=Cédula JCE Válida (Módulo 10)")).toBeVisible();

    // 3. Completar campos obligatorios del custodio
    const timestamp = Date.now().toString().slice(-4);
    await modal.locator('input[placeholder="ej. Juan Carlos"]').fill("Custodio" + timestamp);
    await modal.locator('input[placeholder*="Pérez Gómez"]').fill("E2E");
    await modal.locator('input[placeholder="ej. Director de Carrera, Analista TI"]').fill("Especialista E2E");

    // Seleccionar un departamento activo dentro del modal (segundo select del modal)
    await modal.locator("select").nth(1).selectOption({ index: 1 });

    // Guardar
    await modal.getByRole("button", { name: "Registrar Empleado" }).click();

    // Verificar registro exitoso
    await expect(modal).not.toBeVisible({ timeout: 10000 });
    await page.fill('input[placeholder*="Buscar"]', "Custodio" + timestamp);
    await expect(page.locator("table").first()).toContainText("Custodio" + timestamp, { timeout: 10000 });
  });

  test("5. Exportación tabular a Libro Excel (.xlsx)", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/catalogos/departamentos");

    // Abrir dropdown de exportación
    await page.getByRole("button", { name: "Exportar" }).click();
    await expect(page.getByText("Libro Excel (.xlsx)")).toBeVisible();

    // Esperar evento de descarga al hacer clic
    const downloadPromise = page.waitForEvent("download");
    await page.getByText("Libro Excel (.xlsx)").click();
    const download = await downloadPromise;

    // Verificar que el archivo descargado tiene extensión .xlsx y nombre institucional
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/departamentos_unapec_.*\.xlsx$/);
  });
});
