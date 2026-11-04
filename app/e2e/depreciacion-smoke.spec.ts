import { test, expect, Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Smoke E2E del motor de depreciación (Sub-03).
 *
 * Flujo: login → crear período → ejecutar corrida → verificar detalle → cerrar período.
 *
 * ADVERTENCIA: este flujo muta la base de datos (crea un período, actualiza la
 * depreciación acumulada de todos los activos y cierra el período de forma
 * irreversible por API). Para poder ejecutarlo de forma repetible, el test:
 *   1. Exige que el período de prueba NO exista (si existe, falla sin tocar nada).
 *   2. Al terminar (éxito o fallo) borra el período, su detalle, su asiento y su
 *      auditoría, y RESTAURA la depreciación acumulada y el valor en libros de
 *      cada activo usando las columnas `depreciacion_acumulada_anterior` y
 *      `valor_en_libros_anterior` del detalle generado.
 *
 * El período de prueba es configurable con `E2E_DEPRECIACION_PERIODO=YYYY-MM`.
 * Por defecto usa el mes siguiente al último período sembrado (2026-12).
 */

const PERIODO_PRUEBA = process.env.E2E_DEPRECIACION_PERIODO ?? '2026-12';
const [ANIO_PRUEBA, MES_PRUEBA] = PERIODO_PRUEBA.split('-').map(Number);

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const NOMBRE_MES = MESES[MES_PRUEBA - 1];

const ARTIFACT_DIR = path.resolve(process.cwd(), 'e2e-artifacts');
const SCREENSHOT = path.join(ARTIFACT_DIR, 'depreciacion-periodo-cerrado.png');

/** Carga DATABASE_URL desde .env cuando Playwright no lo inyecta. */
function cargarEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const linea of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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

/** Devuelve el período de prueba solamente si existe y no fue creado por este test. */
async function periodoExistente(prisma: PrismaClient) {
  return prisma.periodoDepreciacion.findUnique({
    where: { anio_mes: { anio: ANIO_PRUEBA, mes: MES_PRUEBA } },
    include: { detalles: true, asiento: { include: { lineas: true } } },
  });
}

/** Restaura los activos afectados y elimina todo rastro del período. */
async function limpiarPeriodo(prisma: PrismaClient) {
  const periodo = await periodoExistente(prisma);
  if (!periodo) return;

  await prisma.$transaction(async (tx) => {
    for (const detalle of periodo.detalles) {
      await tx.activoFijo.update({
        where: { id: detalle.activoId },
        data: {
          depreciacionAcumulada: detalle.depreciacionAcumuladaAnterior,
          valorEnLibros: detalle.valorEnLibrosAnterior,
        },
      });
    }

    if (periodo.asiento) {
      await tx.lineaAsiento.deleteMany({ where: { asientoId: periodo.asiento.id } });
      await tx.asientoContable.delete({ where: { id: periodo.asiento.id } });
    }

    await tx.detalleDepreciacion.deleteMany({ where: { periodoId: periodo.id } });
    await tx.auditoria.deleteMany({ where: { recursoId: periodo.id } });
    await tx.periodoDepreciacion.delete({ where: { id: periodo.id } });
  });
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('#correo', 'admin@unapec.edu.do');
  await page.fill('#password', 'Admin2026!');
  await page.click('button[type=submit]');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

test.describe('Motor de Depreciación DGII - Smoke E2E', () => {
  test.describe.configure({ mode: 'serial' });

  let prisma: PrismaClient;

  test.beforeAll(async () => {
    prisma = crearPrisma();
    // Precondición de seguridad: nunca cerramos un período con datos reales.
    const existente = await periodoExistente(prisma);
    if (existente) {
      throw new Error(
        `El período ${PERIODO_PRUEBA} ya existe en la base de datos. ` +
          'El smoke E2E se niega a ejecutarse para no cerrar un período real. ' +
          'Defina otro mes con E2E_DEPRECIACION_PERIODO=YYYY-MM.'
      );
    }
    if (!existsSync(ARTIFACT_DIR)) {
      mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test.afterAll(async () => {
    if (prisma) {
      await limpiarPeriodo(prisma);
      await prisma.$disconnect();
    }
  });

  test('1. Flujo completo: crear período, ejecutar corrida, verificar detalle y cerrar', async ({
    page,
  }) => {
    test.setTimeout(180000);

    await loginAsAdmin(page);
    await page.goto('/depreciacion');

    await expect(page.getByRole('heading', { name: 'Depreciación DGII' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Períodos de Depreciación' })).toBeVisible();

    // --- 1. Crear el período de prueba -------------------------------------
    await page.getByRole('button', { name: 'Nuevo período' }).click();
    const modalNuevo = page.locator('.fixed.inset-0');
    await expect(modalNuevo.getByRole('heading', { name: 'Nuevo período' })).toBeVisible();

    await modalNuevo.locator('#nuevo-periodo-anio').selectOption(String(ANIO_PRUEBA));
    await modalNuevo.locator('#nuevo-periodo-mes').selectOption(String(MES_PRUEBA));
    await modalNuevo.getByRole('button', { name: 'Crear período' }).click();
    await expect(modalNuevo).not.toBeVisible({ timeout: 20000 });

    const fila = page.getByTestId(`periodo-row-${PERIODO_PRUEBA}`);
    await expect(fila).toBeVisible({ timeout: 20000 });
    await expect(fila).toContainText(NOMBRE_MES);
    await expect(fila).toContainText('Abierto');

    // --- 2. Ejecutar la corrida -------------------------------------------
    await page.getByRole('button', { name: `Ejecutar corrida del período ${PERIODO_PRUEBA}` }).click();
    const modalEjecutar = page.locator('.fixed.inset-0');
    await expect(
      modalEjecutar.getByRole('heading', { name: 'Ejecutar corrida' })
    ).toBeVisible();
    await expect(modalEjecutar).toContainText(NOMBRE_MES);

    await modalEjecutar.getByRole('button', { name: 'Confirmar ejecución' }).click();
    await expect(modalEjecutar).not.toBeVisible({ timeout: 120000 });

    await expect(fila).toContainText('Calculado', { timeout: 20000 });

    // --- 3. Verificar el detalle por activo y el asiento -------------------
    await page.getByRole('button', { name: `Ver detalle del período ${PERIODO_PRUEBA}` }).click();
    const panelDetalle = page.locator('aside[role="dialog"]');
    await expect(
      panelDetalle.getByRole('heading', { name: 'Detalle del período' })
    ).toBeVisible();

    await expect(panelDetalle.getByRole('heading', { name: 'Desglose por activo' })).toBeVisible({
      timeout: 30000,
    });
    const filasDetalle = panelDetalle.locator('tbody tr');
    await expect(filasDetalle.first()).toBeVisible({ timeout: 30000 });
    expect(await filasDetalle.count()).toBeGreaterThan(0);

    await expect(panelDetalle.getByRole('heading', { name: 'Asiento contable' })).toBeVisible();
    await expect(panelDetalle).toContainText('DEP-');
    await expect(panelDetalle).toContainText('Asiento cuadrado');

    await panelDetalle.getByRole('button', { name: 'Cerrar panel de detalle' }).first().click();
    await expect(panelDetalle).not.toBeVisible();

    // --- 4. Cerrar el período ---------------------------------------------
    await page.getByRole('button', { name: `Cerrar período ${PERIODO_PRUEBA}` }).click();
    const modalCerrar = page.locator('.fixed.inset-0');
    await expect(modalCerrar.getByRole('heading', { name: 'Cerrar período' })).toBeVisible();

    const botonConfirmar = modalCerrar.getByRole('button', { name: 'Confirmar cierre' });
    await expect(botonConfirmar).toBeDisabled();

    await modalCerrar
      .getByRole('checkbox', {
        name: /Entiendo que el cierre es irreversible/,
      })
      .check();
    await expect(botonConfirmar).toBeEnabled();
    await botonConfirmar.click();
    await expect(modalCerrar).not.toBeVisible({ timeout: 30000 });

    // --- 5. El período cerrado queda inmutable en la UI -------------------
    await expect(fila).toContainText('Cerrado', { timeout: 20000 });
    await expect(
      page.getByRole('button', { name: `Cerrar período ${PERIODO_PRUEBA}` })
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: `Re-ejecutar corrida del período ${PERIODO_PRUEBA}` })
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: `Ejecutar corrida del período ${PERIODO_PRUEBA}` })
    ).toHaveCount(0);

    await page.screenshot({ path: SCREENSHOT, fullPage: true });
  });
});
