import AxeBuilder from '@axe-core/playwright';
import { test, expect, request, type Page } from '@playwright/test';
import path from 'node:path';
import { CONTRASENA_PRUEBA, crearCuenta } from '../soporte/bd';
import { RAIZ_TMP, URL_API, URL_WEB } from '../soporte/entorno';
import { iniciarSesionPorUI } from '../soporte/ui';

// Panel de administración (Sprint 4): accesos y cuentas bloqueadas.

async function revisarAccesibilidad(pagina: Page): Promise<void> {
  const axe = await new AxeBuilder({ page: pagina as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('iframe').analyze();
  const violaciones = axe.violations.map((v) => `${v.id} · ${v.nodes[0]?.target.join(' ')} · ${v.help}`);
  expect(violaciones, violaciones.join('\n')).toEqual([]);
}

const captura = (pagina: Page, nombre: string) =>
  pagina.screenshot({ path: path.join(RAIZ_TMP, 'capturas', `${nombre}.png`), fullPage: true });

test('el administrador ve los accesos fallidos y desbloquea una cuenta bloqueada', async ({ page }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-accesos');
  const ana = await crearCuenta(['ESTUDIANTE'], 'ana-bloqueo');

  // Cinco contraseñas incorrectas seguidas bloquean la cuenta 15 minutos.
  const api = await request.newContext({ baseURL: URL_API, extraHTTPHeaders: { Origin: URL_WEB } });
  for (let i = 0; i < 5; i++) {
    const r = await api.post('/api/auth/login', { data: { correo: ana.correo, contrasena: 'clave-equivocada-123' } });
    expect(r.status()).toBe(401);
  }
  await api.dispose();

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/accesos');
  await expect(page.getByRole('heading', { name: 'Accesos', level: 1 })).toBeVisible();

  const bloqueadas = page.locator('section.bloqueadas');
  await expect(bloqueadas.getByText(ana.correo)).toBeVisible();
  await expect(bloqueadas.getByText('5 intentos')).toBeVisible();

  await page.getByRole('tab', { name: 'Solo fallidos' }).click();
  await page.getByLabel('Buscar por correo o nombre').fill(ana.correo);
  const filas = page.locator('table.tabla tbody tr');
  await expect(filas).toHaveCount(5);
  await expect(filas.first()).toContainText('Contraseña incorrecta');
  await expect(filas.first()).toContainText('Fallo');
  await revisarAccesibilidad(page);
  await captura(page, 'admin-accesos');

  await bloqueadas.getByRole('button', { name: /Desbloquear la cuenta de/ }).click();
  await expect(page.getByText(/desbloqueada\. Ya puede iniciar sesión\./)).toBeVisible();
  await expect(bloqueadas.getByText('Ninguna cuenta está bloqueada')).toBeVisible();

  // Con la cuenta desbloqueada, Ana entra con su contraseña y el acceso aparece como éxito.
  const ctx = await request.newContext({ baseURL: URL_API, extraHTTPHeaders: { Origin: URL_WEB } });
  expect((await ctx.post('/api/auth/login', { data: { correo: ana.correo, contrasena: CONTRASENA_PRUEBA } })).status()).toBe(200);
  await ctx.dispose();
  await page.getByRole('tab', { name: 'Todos' }).click();
  await expect(filas.first()).toContainText('Éxito');
});
