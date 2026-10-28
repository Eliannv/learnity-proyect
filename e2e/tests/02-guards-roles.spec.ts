import { test, expect, type Page } from '@playwright/test';
import { crearCuenta } from '../soporte/bd';
import { iniciarSesionPorUI } from '../soporte/ui';

// Rutas que no existen: muestran la página 404 (sin redirigir) con un camino de vuelta.
const RUTAS_INEXISTENTES = ['/aprender/1/evaluacion/3', '/docente/cursos/1/evaluacion', '/no-existe'];

async function rutasInexistentes(page: Page): Promise<void> {
  for (const ruta of RUTAS_INEXISTENTES) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { name: 'No encontramos esta página' }), ruta).toBeVisible();
    await expect(page.getByRole('region', { name: 'No encontramos esta página' }).getByRole('link', { name: 'Explorar cursos' })).toBeVisible();
  }
}

/** Sin el rol necesario: página 403 que explica el motivo, en vez de volver al inicio sin aviso. */
async function accesoDenegado(page: Page, rutas: string[]): Promise<void> {
  for (const ruta of rutas) {
    await page.goto(ruta);
    await expect(page, ruta).toHaveURL(/\/acceso-denegado$/);
    await expect(page.getByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeVisible();
  }
}

test.describe('E2E-02: guards de ruta por rol', () => {
  test('visitante: las rutas privadas llevan al login recordando el destino', async ({ page }) => {
    for (const ruta of ['/perfil', '/mi-aprendizaje', '/aprender/1/2', '/docente/cursos', '/docente/estudiantes', '/admin/revision', '/admin/solicitudes', '/admin/usuarios']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(new RegExp(`/login\\?volver=${encodeURIComponent(ruta)}`));
    }
    await rutasInexistentes(page);
  });

  test('estudiante: entra a Mi aprendizaje, sin acceso a docente ni admin', async ({ page }) => {
    const cuenta = await crearCuenta(['ESTUDIANTE'], 'estudiante');
    await iniciarSesionPorUI(page, cuenta.correo);

    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/perfil$/);
    await page.goto('/mi-aprendizaje');
    await expect(page.getByRole('heading', { name: 'Mi aprendizaje' })).toBeVisible();
    await accesoDenegado(page, ['/docente/cursos', '/docente/estudiantes', '/admin/revision', '/admin/solicitudes', '/admin/usuarios']);
    // Con sesión, /login y /registro no tienen sentido (invitadoGuard).
    await page.goto('/login');
    await expect(page).not.toHaveURL(/\/login/);
    await rutasInexistentes(page);
  });

  test('docente: entra a su panel, /perfil lo manda a sus ajustes y /admin le está vedado', async ({ page }) => {
    const cuenta = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente');
    await iniciarSesionPorUI(page, cuenta.correo);

    await page.goto('/docente/cursos');
    await expect(page).toHaveURL(/\/docente\/cursos$/);
    await expect(page.getByRole('heading', { name: 'Mis cursos' })).toBeVisible();

    await page.goto('/perfil');
    await expect(page).toHaveURL(/\/docente\/perfil$/);

    await accesoDenegado(page, ['/admin/revision', '/admin/solicitudes', '/admin/usuarios']);
    await page.goto('/docente/estudiantes');
    await expect(page.getByRole('heading', { name: 'Estudiantes de mis cursos' })).toBeVisible();
    await rutasInexistentes(page);
  });

  test('administrador: entra a su panel y no al del docente', async ({ page }) => {
    const cuenta = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin');
    await iniciarSesionPorUI(page, cuenta.correo);

    await page.goto('/admin/revision');
    await expect(page).toHaveURL(/\/admin\/revision$/);
    await page.goto('/admin/solicitudes');
    await expect(page.getByRole('heading', { name: 'Solicitudes de docente' })).toBeVisible();

    await page.goto('/admin/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
    await accesoDenegado(page, ['/docente/cursos']);
    await rutasInexistentes(page);
  });
});
