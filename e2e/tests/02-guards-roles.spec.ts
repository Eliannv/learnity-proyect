import { test, expect, type Page } from '@playwright/test';
import { crearCuenta } from '../soporte/bd';
import { URL_WEB } from '../soporte/entorno';
import { iniciarSesionPorUI } from '../soporte/ui';

// Rutas del Sprint 3/4: con environment.sprint34Habilitado = false no deben existir para nadie.
const RUTAS_SPRINT_34 = [
  '/mi-aprendizaje',
  '/aprender/1/2',
  '/aprender/1/evaluacion/3',
  '/docente/estudiantes',
  '/docente/cursos/1/evaluacion',
  '/admin/usuarios',
];

async function sinRutasDelSprint34(page: Page): Promise<void> {
  for (const ruta of RUTAS_SPRINT_34) {
    await page.goto(ruta);
    await expect(page, `${ruta} no debe mostrarse`).not.toHaveURL(new RegExp(`${ruta.replace(/\//g, '\\/')}$`));
    await expect(page.getByRole('heading', { name: /mi aprendizaje|evaluaci[oó]n|estudiantes|usuarios/i })).toHaveCount(0);
  }
}

test.describe('E2E-02: guards de ruta por rol', () => {
  test('visitante: las rutas privadas llevan al login recordando el destino y el sprint 3/4 no existe', async ({ page }) => {
    for (const ruta of ['/perfil', '/docente/cursos', '/admin/revision', '/admin/solicitudes']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(new RegExp(`/login\\?volver=${encodeURIComponent(ruta)}`));
    }
    await sinRutasDelSprint34(page);
  });

  test('estudiante: no entra a docente ni admin, /perfil sí, y no ve rutas del sprint 3/4', async ({ page }) => {
    const cuenta = await crearCuenta(['ESTUDIANTE'], 'estudiante');
    await iniciarSesionPorUI(page, cuenta.correo);

    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/perfil$/);
    for (const ruta of ['/docente/cursos', '/admin/revision', '/admin/solicitudes']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/localhost:4300\/$/);
    }
    // Con sesión, /login y /registro no tienen sentido (invitadoGuard).
    await page.goto('/login');
    await expect(page).not.toHaveURL(/\/login/);
    await sinRutasDelSprint34(page);
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
    await sinRutasDelSprint34(page);
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
    await sinRutasDelSprint34(page);
  });
});
