import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { CONTRASENA_PRUEBA, crearCuenta } from '../soporte/bd';
import { iniciarSesionPorUI, otroContexto } from '../soporte/ui';

async function revisarAccesibilidad(pagina: Page): Promise<void> {
  const axe = await new AxeBuilder({ page: pagina as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('iframe').analyze();
  const violaciones = axe.violations.map((v) => `${v.id} · ${v.nodes[0]?.target.join(' ')} · ${v.help}`);
  expect(violaciones, violaciones.join('\n')).toEqual([]);
}

test('panel del docente: guarda el perfil, cambia la contraseña y vuelve a entrar con la nueva', async ({ page, context }) => {
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'perfil-docente');
  const nueva = 'Otra-frase-larga-segura-2026';
  await iniciarSesionPorUI(page, docente.correo);

  await page.goto('/docente/perfil');
  await expect(page.getByText('Así te ven tus estudiantes')).toBeVisible();
  await expect(page.getByText('Todavía no tienes reseñas en tus cursos publicados.')).toBeVisible();
  await page.getByLabel('Biografía').fill('Enseño física con experimentos caseros.');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tu perfil se guardó.' })).toBeVisible();

  await page.getByRole('tab', { name: 'Contraseña' }).click();
  await page.getByLabel('Contraseña actual').fill(CONTRASENA_PRUEBA);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(nueva);
  await page.getByLabel('Repite la nueva contraseña').fill(nueva);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByRole('status').filter({ hasText: /contraseña/i })).toBeVisible();
  await revisarAccesibilidad(page);

  // Otra sesión: la contraseña anterior ya no sirve y la nueva abre el panel.
  const { contexto, pagina } = await otroContexto(context);
  try {
    await pagina.goto('/login');
    await pagina.getByLabel('Correo electrónico').fill(docente.correo);
    await pagina.getByLabel('Contraseña', { exact: true }).fill(CONTRASENA_PRUEBA);
    await pagina.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(pagina.getByRole('alert')).toBeVisible();
    await iniciarSesionPorUI(pagina, docente.correo, nueva);
    await pagina.goto('/docente/resenas');
    await expect(pagina.getByRole('heading', { name: 'Reseñas', level: 1 })).toBeVisible();
    await expect(pagina.getByText('Todavía no tienes reseñas')).toBeVisible();
  } finally {
    await contexto.close();
  }
});

test('si el servidor deja de entregar una sección, avisa y ofrece recargar en vez de quedar en blanco', async ({ page }) => {
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'carga-docente');
  await iniciarSesionPorUI(page, docente.correo);
  await page.goto('/docente/cursos');
  await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();

  // Como cuando se detiene o reinicia `ng serve` con la pestaña abierta: los módulos nuevos no se descargan.
  await page.route(/\/chunk-[\w-]+\.js(\?.*)?$/, (ruta) => ruta.abort('connectionrefused'));
  await page.getByRole('navigation', { name: 'Menú del panel' }).getByRole('link', { name: 'Reseñas' }).click();
  const aviso = page.getByRole('alert').filter({ hasText: 'No se pudo cargar esta sección' });
  await expect(aviso).toBeVisible();
  await revisarAccesibilidad(page);

  // Con el servidor de vuelta, «Recargar la página» lleva a la sección pedida y se ve con normalidad.
  await page.unrouteAll();
  await aviso.getByRole('button', { name: 'Recargar la página' }).click();
  await expect(page).toHaveURL(/\/docente\/resenas$/);
  await expect(page.getByRole('heading', { name: 'Reseñas', level: 1 })).toBeVisible();
});
