import { test, expect } from '@playwright/test';

test.describe('Autenticación y Control de Acceso RBAC - Smoke Tests', () => {

  test('1. Flujo de contraseña incorrecta muestra alerta en pantalla sin romper la sesión', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Acceder al Sistema' })).toBeVisible();
    await page.fill('#correo', 'admin@unapec.edu.do');
    await page.fill('#password', 'ClaveTotalmenteErronea999!');
    await page.click('button[type="submit"]');
    const alert = page.locator('[role="alert"]:not([id])');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Correo institucional o contraseña incorrectos.');
    expect(page.url()).toContain('/login');
  });

  test('2. Flujo de bloqueo temporal responde con mensaje de throttling tras 5 fallos consecutivos', async ({ page }) => {
    await page.goto('/login');
    const testEmail = 'throttled_' + Date.now() + '@unapec.edu.do';
    const alert = page.locator('[role="alert"]:not([id])');
    const submitBtn = page.locator('button[type="submit"]');
    for (let attempt = 1; attempt <= 4; attempt++) {
      await page.fill('#correo', testEmail);
      await page.fill('#password', 'IntentoErroneo_' + attempt + '!');
      await submitBtn.click();
      await expect(submitBtn).toBeEnabled();
      await expect(alert).toBeVisible();
      await expect(alert).toContainText('Correo institucional o contraseña incorrectos.');
    }
    await page.fill('#correo', testEmail);
    await page.fill('#password', 'IntentoErroneo_5!');
    await submitBtn.click();
      await expect(submitBtn).toBeEnabled();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Cuenta bloqueada temporalmente por 15 minutos');
  });

  test('3. Flujo de recuperación de contraseña muestra confirmación neutra', async ({ page }) => {
    await page.goto('/recuperar-contrasena');
    await expect(page.getByRole('heading', { name: 'Recuperar Contraseña' })).toBeVisible();
    await page.fill('#correo', 'admin@unapec.edu.do');
    await page.click('button[type="submit"]');
    await expect(page.getByRole('heading', { name: 'Solicitud Procesada' })).toBeVisible();
    await expect(page.locator('text=hemos emitido un enlace de un solo uso')).toBeVisible();
    const returnLink = page.getByRole('link', { name: 'Volver al Inicio de Sesión' });
    await expect(returnLink).toBeVisible();
    await returnLink.click();
    await page.waitForURL('**/login', { timeout: 15000 });
    expect(page.url()).toContain('/login');
  });

  test('4. Flujo de login exitoso navega al dashboard y renderiza el menú de usuario', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#correo', 'admin@unapec.edu.do');
    await page.fill('#password', 'Admin2026!Final');
    await page.click('button[type="submit"]');
    await page.waitForURL('/**/', { timeout: 15000 });
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside').getByText('ActivaCore')).toBeVisible();
    await expect(page.locator('header nav').getByText('ActivaCore', { exact: true })).toBeVisible();
    const userButton = page.locator('header').locator('button[aria-haspopup="true"]');
    await expect(userButton).toBeVisible();
    await expect(userButton.getByText('AG', { exact: true })).toBeVisible();
    await expect(userButton.getByText('Administrador General', { exact: true })).toBeVisible();
    await userButton.click();
    await expect(page.locator('header').getByText('admin@unapec.edu.do')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mi Perfil & Contraseña' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gestión de Usuarios & RBAC' })).toBeVisible();
    const logoutBtn = page.getByRole('button', { name: 'Cerrar Sesión' });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await page.waitForURL('**/login', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Acceder al Sistema' })).toBeVisible();
  });
});
