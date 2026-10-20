import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { crearCuenta } from '../soporte/bd';
import { DIR_BUZON } from '../soporte/entorno';
import { iniciarSesionPorUI } from '../soporte/ui';

interface CorreoBuzon { para: string; asunto: string; texto: string }

/** Lee del buzón local los correos enviados a una dirección. */
function correosPara(destino: string): CorreoBuzon[] {
  return readdirSync(DIR_BUZON)
    .filter((n) => n.endsWith('.json'))
    .map((n) => JSON.parse(readFileSync(path.join(DIR_BUZON, n), 'utf8')) as CorreoBuzon)
    .filter((c) => c.para === destino);
}

test.describe('Catálogo público y recuperación de contraseña', () => {
  test('catálogo: filtros sin resultados y curso inexistente muestran estados claros', async ({ page }) => {
    await page.goto('/cursos');
    await expect(page.getByRole('heading', { level: 1, name: 'Catálogo de cursos' })).toBeVisible();

    await page.goto('/cursos?q=zzz-sin-resultados-e2e');
    await expect(page.getByText('No hay cursos con esos filtros.')).toBeVisible();

    await page.goto('/cursos/99999999');
    await expect(page.getByRole('heading', { name: 'Curso no disponible' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver al catálogo' })).toBeVisible();
  });

  test('recuperación: respuesta uniforme, enlace del buzón de un solo uso y nueva contraseña', async ({ page }) => {
    const cuenta = await crearCuenta(['ESTUDIANTE'], 'recupera');

    // Un correo inexistente recibe exactamente la misma respuesta y no genera correo.
    await page.goto('/recuperar-contrasena');
    await page.getByLabel('Correo electrónico').fill(`nadie.${Date.now()}@qa-edge.test`);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    const aviso = 'Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña.';
    await expect(page.getByText(aviso)).toBeVisible();

    // Un correo real: misma respuesta y un correo en el buzón con el enlace.
    await page.goto('/recuperar-contrasena');
    await page.getByLabel('Correo electrónico').fill(cuenta.correo);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByText(aviso)).toBeVisible();

    await expect.poll(() => correosPara(cuenta.correo).length, { timeout: 15_000 }).toBeGreaterThan(0);
    const enlace = correosPara(cuenta.correo)[0]!.texto.match(/https?:\/\/\S+#token=\S+/)?.[0];
    expect(enlace, 'el correo trae el enlace de restablecimiento').toBeTruthy();

    const nueva = 'Otra-frase-larga-segura-2026';
    await page.goto(enlace!);
    await page.getByLabel('Nueva contraseña').fill(nueva);
    await page.getByLabel('Confirmar contraseña').fill(nueva);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByRole('status')).toBeVisible();

    // El enlace solo sirve una vez.
    await page.goto('about:blank'); // el mismo enlace con #token no recarga la página
    await page.goto(enlace!);
    await page.getByLabel('Nueva contraseña').fill(nueva + '-2');
    await page.getByLabel('Confirmar contraseña').fill(nueva + '-2');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    // La contraseña nueva entra.
    await iniciarSesionPorUI(page, cuenta.correo, nueva);
    await expect(page.getByRole('link', { name: /^Mi perfil,/ })).toBeVisible();
  });
});
