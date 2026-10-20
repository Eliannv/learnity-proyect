import { test, expect } from '@playwright/test';
import { crearCuenta } from '../soporte/bd';
import { cerrarSesionPorUI, contenidoDeAlmacenamiento, correoNuevo, iniciarSesionPorUI, registrarPorUI } from '../soporte/ui';

test.describe('E2E-01: sesión por cookies (registro, login, refresh y logout)', () => {
  test('registro abre sesión, las cookies son las esperadas y no hay token en el almacenamiento', async ({ page, context }) => {
    await registrarPorUI(page, correoNuevo('sesion'));

    const cookies = await context.cookies();
    const refresh = cookies.find((c) => c.name === 'learnity_rt');
    const csrf = cookies.find((c) => c.name === 'XSRF-TOKEN');
    expect(refresh, 'cookie de refresh presente').toBeTruthy();
    expect(refresh!.httpOnly, 'refresh HttpOnly').toBe(true);
    expect(refresh!.sameSite).toBe('Lax');
    expect(refresh!.path).toBe('/api/auth');
    expect(csrf, 'cookie XSRF-TOKEN presente').toBeTruthy();
    expect(csrf!.httpOnly, 'XSRF-TOKEN legible por Angular').toBe(false);

    // JavaScript de la página no puede leer el refresh token.
    expect(await page.evaluate(() => document.cookie)).not.toContain('learnity_rt');

    // Sin tokens en localStorage ni sessionStorage.
    const almacen = await contenidoDeAlmacenamiento(page);
    expect(almacen).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(almacen.toLowerCase()).not.toMatch(/token|jwt|bearer|learnity_rt/);
  });

  test('recargar la página restaura la sesión con /api/auth/refresh y el cierre de sesión la termina', async ({ page, context }) => {
    await registrarPorUI(page, correoNuevo('recarga'));

    const [refresco] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/refresh') && r.request().method() === 'POST'),
      page.goto('/perfil'),
    ]);
    expect(refresco.status()).toBe(200);
    expect(refresco.request().headers()['x-xsrf-token'], 'Angular envía el encabezado CSRF').toBeTruthy();
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
    expect(await contenidoDeAlmacenamiento(page)).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);

    const [cierre] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/logout')),
      cerrarSesionPorUI(page),
    ]);
    expect(cierre.status()).toBeLessThan(300);
    const tras = await context.cookies();
    expect(tras.find((c) => c.name === 'learnity_rt'), 'refresh borrado').toBeUndefined();

    // Recargar ya no restaura nada y la ruta protegida lleva al login recordando el destino.
    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/login\?volver=%2Fperfil/);
  });

  test('login: contraseña incorrecta muestra el error y la correcta abre la sesión', async ({ page }) => {
    const cuenta = await crearCuenta(['ESTUDIANTE'], 'login');

    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(cuenta.correo);
    await page.getByLabel('Contraseña', { exact: true }).fill('una-clave-equivocada-123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await iniciarSesionPorUI(page, cuenta.correo);
    await expect(page.getByRole('link', { name: /^Mi perfil,/ })).toBeVisible();
    expect(await contenidoDeAlmacenamiento(page)).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });
});
