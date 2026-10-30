import AxeBuilder from '@axe-core/playwright';
import { test, expect, request, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CONTRASENA_PRUEBA, crearCuenta, MARCA } from '../soporte/bd';
import { CONTRASENA_UI, DIR_BUZON, RAIZ_TMP, URL_API, URL_WEB } from '../soporte/entorno';
import { correoNuevo, iniciarSesionPorUI, otroContexto } from '../soporte/ui';

// Panel de administración (Sprint 4): accesos, cuentas bloqueadas, alta por invitación y ficha de la cuenta.

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

interface CorreoBuzon { para: string; asunto: string; texto: string }
const correosPara = (destino: string): CorreoBuzon[] => readdirSync(DIR_BUZON)
  .filter((n) => n.endsWith('.json'))
  .map((n) => JSON.parse(readFileSync(path.join(DIR_BUZON, n), 'utf8')) as CorreoBuzon)
  .filter((c) => c.para === destino);

test('el administrador crea una cuenta por invitación, revisa su ficha y cierra sus sesiones', async ({ page, context }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-alta');
  const correo = correoNuevo('invitada');

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/usuarios');
  await page.getByRole('button', { name: 'Crear usuario' }).click();
  const modal = page.getByRole('dialog', { name: 'Crear usuario' });
  await modal.getByLabel('Nombres').fill(MARCA);
  await modal.getByLabel('Apellidos').fill('Invitada');
  await modal.getByLabel('Correo').fill(correo);
  await modal.getByText('Docente', { exact: true }).click();
  await modal.getByLabel('Especialidad del docente').fill('Matemáticas');
  await revisarAccesibilidad(page);
  await modal.getByRole('button', { name: 'Crear y enviar invitación' }).click();
  await expect(page.getByText(`Le enviamos la invitación a ${correo}`)).toBeVisible();

  // La persona abre el enlace del correo, crea su contraseña y entra.
  await expect.poll(() => correosPara(correo).length, { timeout: 15_000 }).toBeGreaterThan(0);
  const enlace = correosPara(correo)[0]!.texto.match(/https?:\/\/\S+#token=\S+&invitacion=1/)?.[0];
  expect(enlace, 'el correo trae el enlace de invitación').toBeTruthy();
  const { contexto, pagina } = await otroContexto(context);
  await pagina.goto(enlace!);
  await expect(pagina.getByRole('heading', { name: 'Crea tu contraseña' })).toBeVisible();
  await pagina.getByLabel('Nueva contraseña').fill(CONTRASENA_UI);
  await pagina.getByLabel('Confirmar contraseña').fill(CONTRASENA_UI);
  await pagina.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(pagina.getByRole('status')).toBeVisible();
  await iniciarSesionPorUI(pagina, correo, CONTRASENA_UI);

  // Su ficha muestra la sesión abierta; el administrador la cierra.
  await page.getByLabel('Buscar por nombre o correo').fill(correo);
  await page.getByRole('button', { name: `Ver la ficha de ${MARCA} Invitada` }).click();
  const ficha = page.getByRole('dialog', { name: `Ficha de ${MARCA} Invitada` });
  await expect(ficha.getByText('Sesiones abiertas (1)')).toBeVisible();
  await expect(ficha.getByText('Matemáticas')).toBeVisible();
  await revisarAccesibilidad(page);
  await captura(page, 'admin-ficha-usuario');
  await ficha.getByRole('button', { name: 'Cerrar todas las sesiones' }).click();
  await page.getByRole('dialog', { name: /Cerrar las sesiones de/ }).getByRole('button', { name: 'Cerrar sesiones' }).click();
  await expect(ficha.getByText('Sesiones abiertas (0)')).toBeVisible();

  // En su navegador, la siguiente navegación ya no tiene sesión.
  await pagina.goto('/perfil');
  await expect(pagina).toHaveURL(/\/login/);
  await contexto.close();
});
