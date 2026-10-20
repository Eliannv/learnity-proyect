import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { crearCuenta } from '../soporte/bd';
import { correoNuevo, iniciarSesionPorUI, registrarPorUI } from '../soporte/ui';

const ETIQUETAS_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Pasa axe sobre la ruta y devuelve las violaciones como texto legible. */
async function violaciones(page: Page, ruta: string): Promise<string[]> {
  await page.goto(ruta);
  await page.waitForLoadState('networkidle');
  const resultado = await new AxeBuilder({ page: page as never }).withTags(ETIQUETAS_AA).analyze();
  return resultado.violations.map(
    (v) => `${ruta} · ${v.id} (${v.impact}) · ${v.nodes.length} nodo(s) · ${v.nodes[0]?.target.join(' ')} · ${v.help} · ${v.nodes[0]?.any[0]?.message ?? ""}`,
  );
}

test.describe('E2E-05: accesibilidad AA (axe) y teclado', () => {
  test('axe: páginas públicas sin violaciones WCAG A/AA', async ({ page }) => {
    const todas: string[] = [];
    for (const ruta of ['/', '/cursos', '/login', '/registro', '/recuperar-contrasena']) {
      todas.push(...(await violaciones(page, ruta)));
    }
    expect(todas, todas.join('\n')).toEqual([]);
  });

  test('axe: perfil del estudiante', async ({ page }) => {
    await registrarPorUI(page, correoNuevo('axe'));
    const todas = await violaciones(page, '/perfil');
    expect(todas, todas.join('\n')).toEqual([]);
  });

  test('axe: paneles de docente y administrador', async ({ page }) => {
    const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente');
    await iniciarSesionPorUI(page, docente.correo);
    const todas = [
      ...(await violaciones(page, '/docente/cursos')),
      ...(await violaciones(page, '/docente/cursos/nuevo/editar')),
      ...(await violaciones(page, '/docente/perfil')),
    ];
    expect(todas, todas.join('\n')).toEqual([]);
  });

  test('axe: vistas del administrador', async ({ page }) => {
    const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin');
    await iniciarSesionPorUI(page, admin.correo);
    const todas = [
      ...(await violaciones(page, '/admin/revision')),
      ...(await violaciones(page, '/admin/solicitudes')),
      ...(await violaciones(page, '/admin/categorias')),
    ];
    expect(todas, todas.join('\n')).toEqual([]);
  });

  test('teclado: cada control del login recibe un foco visible y todos los campos tienen nombre accesible', async ({ page }) => {
    await page.goto('/login');
    const sinIndicador: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const estado = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const contorno = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
        const sombra = s.boxShadow !== 'none';
        const borde = s.borderColor;
        return { etiqueta: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`, visible: contorno || sombra, borde };
      });
      if (estado && !estado.visible) sinIndicador.push(estado.etiqueta);
    }
    expect(sinIndicador, `controles sin contorno ni sombra de foco: ${sinIndicador.join(', ')}`).toEqual([]);

    for (const campo of await page.locator('input:visible').all()) {
      const nombre = await campo.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label'));
      expect(nombre, 'campo con etiqueta asociada').toBeTruthy();
    }
  });

  test('landmarks: el login tiene región principal <main>', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('main')).toBeVisible();
  });
});
