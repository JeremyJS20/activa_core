import { test, expect } from '@playwright/test';

test.describe('Gestión de Activos Fijos y Custodia - Smoke Tests E2E', () => {
  const uniqueSuffix = Date.now().toString().slice(-5);
  const assetDesc = 'Estacion Dell Precision E2E ' + uniqueSuffix;
  const assetSerial = 'SN-E2E-' + uniqueSuffix;

  async function loginAsAdmin(page: any) {
    await page.goto('/login');
    await page.fill('#correo', 'admin@unapec.edu.do');
    await page.fill('#password', 'Admin2026!');
    await page.click('button[type=submit]');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
  }

  test('1. Flujo E2E de registro de activo institucional y verificación en tabla de inventario', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/activos');

    await expect(page.locator('h1')).toContainText('Inventario de Activos Fijos');
    await expect(page.getByRole('heading', { name: 'Listado General de Activos' })).toBeVisible();

    await page.getByRole('button', { name: 'Nuevo Activo' }).click();
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByRole('heading', { name: 'Alta de Activo Institucional' })).toBeVisible();

    await modal.locator('textarea').first().fill(assetDesc);

    const empSelect = modal.locator('select').nth(2);
    await expect(empSelect.locator('option').nth(1)).toBeAttached({ timeout: 10000 });
    await empSelect.selectOption({ index: 1 });

    await modal.locator('input[placeholder*=Dell]').fill('Dell');
    await modal.locator('input[placeholder*=OptiPlex]').fill('Precision 3660');
    await modal.locator('input[placeholder*=SN-]').fill(assetSerial);

    const numberInputs = modal.locator('input[type=number]');
    await numberInputs.first().fill('85000');
    await numberInputs.nth(1).fill('5000');

    await modal.getByRole('button', { name: 'Registrar Activo' }).click();

    await expect(modal).not.toBeVisible({ timeout: 10000 });
    await page.fill('input[placeholder*=Buscar]', assetSerial);
    await expect(page.locator('table').first()).toContainText(assetDesc, { timeout: 10000 });
    await expect(page.locator('table').first()).toContainText('Activo');
  });

  test('2. Flujo E2E de traslado de custodia y verificación de Acta de Entrega PDF', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/activos');

    await page.fill('input[placeholder*=Buscar]', assetSerial);
    const row = page.locator('tbody tr').filter({ hasText: assetDesc }).first();
    await expect(row).toBeVisible({ timeout: 10000 });

    await row.locator('button[title*=Trasladar]').click();
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByRole('heading', { name: 'Traslado de Custodia y Asignación' })).toBeVisible();

    const deptSelect = modal.locator('select').first();
    const deptOptionsCount = await deptSelect.locator('option').count();
    if (deptOptionsCount > 2) {
      await deptSelect.selectOption({ index: 2 });
    }

    const empSelect = modal.locator('select').nth(1);
    await expect(empSelect.locator('option').nth(1)).toBeAttached({ timeout: 10000 });
    await empSelect.selectOption({ index: 1 });

    await modal.locator('textarea').fill('Reasignación operativa E2E para laboratorio de innovación universitaria.');

    await modal.getByRole('button', { name: 'Confirmar Traslado' }).click();

    await expect(modal.getByRole('heading', { name: '¡Traslado de Custodia Registrado!' })).toBeVisible({ timeout: 10000 });
    await expect(modal.getByText('Descargar Acta de Entrega')).toBeVisible();

    await modal.getByRole('button', { name: 'Finalizar y Cerrar' }).click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    const listRes = await page.request.get('/api/activos?search=' + encodeURIComponent(assetSerial));
    expect(listRes.ok()).toBeTruthy();
    const listJson = await listRes.json();
    const createdAssetId = listJson.data[0]?.id;
    expect(createdAssetId).toBeTruthy();

    const pdfRes = await page.request.get('/api/activos/' + createdAssetId + '/acta-entrega');
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()['content-type']).toContain('application/pdf');
  });

  test('3. Flujo E2E de desincorporación / baja formal por Administrador y bloqueo permanente', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/activos');

    await page.fill('input[placeholder*=Buscar]', assetSerial);
    const row = page.locator('tbody tr').filter({ hasText: assetDesc }).first();
    await expect(row).toBeVisible({ timeout: 10000 });

    await row.locator('button[title*=Baja]').click();
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByRole('heading', { name: 'Desincorporación y Baja Formal' })).toBeVisible();

    await modal.locator('input[placeholder*=ACTA-BAJA-]').fill('ACTA-E2E-' + uniqueSuffix);
    await modal.locator('textarea').fill('Dictamen técnico de prueba E2E: equipo desincorporado por obsolescencia programada certificada.');

    await modal.locator('input[type=checkbox]').check();

    await modal.getByRole('button', { name: 'Confirmar Desincorporación' }).click();
    await expect(modal).not.toBeVisible({ timeout: 10000 });

    const updatedRow = page.locator('tbody tr').filter({ hasText: assetDesc }).first();
    await expect(updatedRow).toContainText('Dado de Baja', { timeout: 10000 });
    await expect(updatedRow.locator('button[title*=Trasladar]')).toHaveCount(0);
    await expect(updatedRow.locator('button[title*=Baja]')).toHaveCount(0);
  });
});
