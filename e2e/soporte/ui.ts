// Pasos de interfaz reutilizados por varias specs.
import { expect, type BrowserContext, type Page } from '@playwright/test';
import { CONTRASENA_UI, URL_WEB } from './entorno';
import { CONTRASENA_PRUEBA, MARCA } from './bd';

let n = 0;
/** Correo único de la ejecución para cuentas creadas desde la interfaz. */
export function correoNuevo(etiqueta: string): string {
  return `${MARCA}.${etiqueta}ui${++n}x${Math.random().toString(36).slice(2, 7)}@qa-edge.test`.toLowerCase();
}

/** Registro por la interfaz. Nombres = marca para que la limpieza encuentre la cuenta. */
export async function registrarPorUI(page: Page, correo: string, apellidos = 'Estudiante'): Promise<void> {
  await page.goto('/registro');
  await page.getByLabel('Nombres').fill(MARCA);
  await page.getByLabel('Apellidos').fill(apellidos);
  await page.getByLabel('Correo electrónico').fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(CONTRASENA_UI);
  await page.getByLabel('Confirmar contraseña').fill(CONTRASENA_UI);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).not.toHaveURL(/\/registro/);
}

/** Inicio de sesión por la interfaz (cuentas creadas por SQL con CONTRASENA_PRUEBA). */
export async function iniciarSesionPorUI(page: Page, correo: string, contrasena = CONTRASENA_PRUEBA): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Cierre de sesión por el menú de la cuenta (se abre con el foco, como lo haría el teclado). */
export async function cerrarSesionPorUI(page: Page): Promise<void> {
  await page.getByRole('link', { name: /^Mi perfil,/ }).focus();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  // Al salir la app vuelve al inicio público, donde reaparece "Iniciar sesión".
  await expect(page.getByRole('link', { name: 'Iniciar sesión' }).first()).toBeVisible();
}

/** Todo lo que guardan localStorage y sessionStorage, para comprobar que no hay tokens. */
export async function contenidoDeAlmacenamiento(page: Page): Promise<string> {
  return page.evaluate(() => {
    const volcar = (s: Storage) => Object.keys(s).map((k) => `${k}=${s.getItem(k)}`);
    return JSON.stringify([...volcar(localStorage), ...volcar(sessionStorage)]);
  });
}

/** Contexto nuevo (otra persona) con la misma configuración base. */
export async function otroContexto(context: BrowserContext): Promise<{ contexto: BrowserContext; pagina: Page }> {
  const contexto = await context.browser()!.newContext({ baseURL: URL_WEB, locale: 'es-EC' });
  return { contexto, pagina: await contexto.newPage() };
}

/** Marca de XSS: si algún payload se ejecuta, define window.__xss. */
export const PAYLOAD_XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
export async function xssEjecutado(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __xss?: number }).__xss !== undefined);
}
