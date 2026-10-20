import { test, expect, type Page } from '@playwright/test';
import { crearCuenta } from '../soporte/bd';
import { correoNuevo, iniciarSesionPorUI, registrarPorUI } from '../soporte/ui';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/** Devuelve las rutas que desbordan horizontalmente a 390 px. */
async function conScroll(page: Page, rutas: string[]): Promise<string[]> {
  const mal: string[] = [];
  for (const ruta of rutas) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    const m = await page.evaluate(() => ({
      ventana: window.innerWidth,
      documento: document.documentElement.scrollWidth,
      cuerpo: document.body.scrollWidth,
    }));
    if (m.documento > m.ventana || m.cuerpo > m.ventana) {
      mal.push(`${ruta}: ventana ${m.ventana}px, documento ${m.documento}px, cuerpo ${m.cuerpo}px`);
    }
  }
  return mal;
}

test.describe('E2E-06: vista a 390 px sin scroll horizontal', () => {
  test('páginas públicas', async ({ page }) => {
    const mal = await conScroll(page, ['/', '/cursos', '/cursos/99999999', '/login', '/registro', '/recuperar-contrasena']);
    expect(mal, mal.join('\n')).toEqual([]);
  });

  test('estudiante', async ({ page }) => {
    await registrarPorUI(page, correoNuevo('movil'));
    const mal = await conScroll(page, ['/perfil']);
    expect(mal, mal.join('\n')).toEqual([]);
  });

  test('docente', async ({ page }) => {
    const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente');
    await iniciarSesionPorUI(page, docente.correo);
    const mal = await conScroll(page, ['/docente/cursos', '/docente/cursos/nuevo/editar', '/docente/perfil']);
    expect(mal, mal.join('\n')).toEqual([]);
  });

  test('administrador', async ({ page }) => {
    const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin');
    await iniciarSesionPorUI(page, admin.correo);
    const mal = await conScroll(page, ['/admin/revision', '/admin/solicitudes', '/admin/categorias', '/admin/perfil']);
    expect(mal, mal.join('\n')).toEqual([]);
  });
});
