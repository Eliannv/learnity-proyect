import { test, expect, type Page } from '@playwright/test';
import { crearCuenta } from '../soporte/bd';
import { iniciarSesionPorUI } from '../soporte/ui';

// Las evaluaciones y la gestión de usuarios siguen reservadas para otro sprint.
const RUTAS_FUTURAS = [
  '/aprender/1/evaluacion/3',
  '/docente/cursos/1/evaluacion',
  '/admin/usuarios',
];

async function sinRutasFuturas(page: Page): Promise<void> {
  for (const ruta of RUTAS_FUTURAS) {
    await page.goto(ruta);
    await expect(page, `${ruta} no debe mostrarse`).not.toHaveURL(new RegExp(`${ruta.replace(/\//g, '\\/')}$`));
    await expect(page.getByRole('heading', { name: /mi aprendizaje|evaluaci[oó]n|estudiantes|usuarios/i })).toHaveCount(0);
  }
}

test.describe('E2E-02: guards de ruta por rol', () => {
  test('visitante: las rutas privadas llevan al login recordando el destino', async ({ page }) => {
    for (const ruta of ['/perfil', '/mi-aprendizaje', '/aprender/1/2', '/docente/cursos', '/docente/estudiantes', '/admin/revision', '/admin/solicitudes']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(new RegExp(`/login\\?volver=${encodeURIComponent(ruta)}`));
    }
    await sinRutasFuturas(page);
  });

  test('estudiante: entra a Mi aprendizaje, sin acceso a docente ni admin', async ({ page }) => {
    const cuenta = await crearCuenta(['ESTUDIANTE'], 'estudiante');
    await iniciarSesionPorUI(page, cuenta.correo);

    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/perfil$/);
    await page.goto('/mi-aprendizaje');
    await expect(page.getByRole('heading', { name: 'Mi aprendizaje' })).toBeVisible();
    for (const ruta of ['/docente/cursos', '/docente/estudiantes', '/admin/revision', '/admin/solicitudes']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/localhost:4300\/$/);
    }
    // Con sesión, /login y /registro no tienen sentido (invitadoGuard).
    await page.goto('/login');
    await expect(page).not.toHaveURL(/\/login/);
    await sinRutasFuturas(page);
  });

  test('docente: entra a su panel, /perfil lo manda a sus ajustes y /admin le está vedado', async ({ page }) => {
    const cuenta = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente');
    await iniciarSesionPorUI(page, cuenta.correo);

    await page.goto('/docente/cursos');
    await expect(page).toHaveURL(/\/docente\/cursos$/);
    await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();

    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/docente\/perfil$/);

    for (const ruta of ['/admin/revision', '/admin/solicitudes']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/localhost:4300\/$/);
    }
    await page.goto('/docente/estudiantes');
    await expect(page.getByRole('heading', { name: 'Estudiantes de mis cursos' })).toBeVisible();
    await sinRutasFuturas(page);
  });

  test('administrador: entra a su panel y no al del docente', async ({ page }) => {
    const cuenta = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin');
    await iniciarSesionPorUI(page, cuenta.correo);

    await page.goto('/admin/revision');
    await expect(page).toHaveURL(/\/admin\/revision$/);
    await page.goto('/admin/solicitudes');
    await expect(page.getByRole('heading', { name: 'Solicitudes de docente' })).toBeVisible();

    await page.goto('/docente/cursos');
    await expect(page).toHaveURL(/localhost:4300\/$/);
    await sinRutasFuturas(page);
  });
});
