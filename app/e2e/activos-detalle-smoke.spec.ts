import { test, expect, Page } from '@playwright/test';

/**
 * Regresión del Sub-01: el ojito de /activos debe abrir la ficha técnica
 * en modo consulta (drawer), NO el formulario de edición.
 *
 * Prueba de solo lectura: no crea ni modifica activos.
 */

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('#correo', 'admin@unapec.edu.do');
  await page.fill('#password', 'Admin2026!');
  await page.click('button[type=submit]');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

test.describe('Inventario de Activos - Ficha técnica vs edición', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/activos');
    await expect(page.getByRole('heading', { name: 'Listado General de Activos' })).toBeVisible({
      timeout: 15000,
    });
  });

  test('1. El ojito abre el drawer de ficha técnica en solo lectura', async ({ page }) => {
    const fila = page.locator('table tbody tr').first();
    await expect(fila).toBeVisible();

    await fila.locator('button[title="Ver Ficha Técnica"]').click();

    const drawer = page.locator('aside[role="dialog"]');
    await expect(drawer.getByRole('heading', { name: 'Ficha Técnica del Activo' })).toBeVisible({
      timeout: 10000,
    });

    await expect(drawer.getByText('Solo consulta')).toBeVisible();
    await expect(drawer.getByRole('heading', { name: 'Identificación del bien' })).toBeVisible();
    await expect(drawer.getByRole('heading', { name: 'Situación financiera' })).toBeVisible();
    await expect(drawer.getByRole('heading', { name: 'Clasificación fiscal DGII' })).toBeVisible();
    await expect(drawer.getByRole('heading', { name: 'Custodia y adscripción' })).toBeVisible();

    // El formulario de edición no debe haberse abierto.
    await expect(page.getByRole('heading', { name: 'Editar Ficha de Activo Fijo' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Guardar Cambios' })).toHaveCount(0);
  });

  test('2. El drawer se cierra con Escape', async ({ page }) => {
    const fila = page.locator('table tbody tr').first();
    await fila.locator('button[title="Ver Ficha Técnica"]').click();

    const drawer = page.locator('aside[role="dialog"]');
    await expect(drawer.getByRole('heading', { name: 'Ficha Técnica del Activo' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
  });

  test('3. El lápiz sigue abriendo el formulario de edición', async ({ page }) => {
    // Solo los activos no desincorporados exponen el botón de edición.
    const filaEditable = page
      .locator('table tbody tr')
      .filter({ has: page.locator('button[title="Editar Datos Físicos"]') })
      .first();
    await expect(filaEditable).toBeVisible();

    await filaEditable.locator('button[title="Editar Datos Físicos"]').click();

    await expect(
      page.getByRole('heading', { name: 'Editar Ficha de Activo Fijo' })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Guardar Cambios' })).toBeVisible();

    // El drawer de consulta no debe abrirse en esta ruta.
    await expect(page.getByRole('heading', { name: 'Ficha Técnica del Activo' })).toHaveCount(0);
  });
});
