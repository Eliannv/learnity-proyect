import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { pdfMinimo } from '../../backend/test/ayudas/archivos.js';
import { crearCategoria, crearCuenta, MARCA } from '../soporte/bd';
import { iniciarSesionPorUI, otroContexto, PAYLOAD_XSS, xssEjecutado } from '../soporte/ui';

const TITULO = `${MARCA} Curso ${PAYLOAD_XSS}`;

function vigilarDialogos(page: Page, registro: string[]): void {
  page.on('dialog', async (d) => {
    if (d.type() === 'confirm') {
      await d.accept();
    } else {
      registro.push(`${d.type()}: ${d.message()}`);
      await d.dismiss();
    }
  });
}

test.describe('E2E-04 / E2E-07: docente crea curso con PDF, admin lo publica y el catálogo lo muestra', () => {
  test('recorrido completo con XSS en el título, subida con progreso, descarga y bloqueo por estado', async ({ page, context }) => {
    test.setTimeout(180_000);
    const dialogos: string[] = [];
    vigilarDialogos(page, dialogos);

    const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin');
    const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente');
    const categoria = await crearCategoria(admin.idPersona, 'Redes');

    // 1. El docente crea el borrador.
    await iniciarSesionPorUI(page, docente.correo);
    await page.goto('/docente/cursos/nuevo/editar');
    await expect(page.getByRole('heading', { name: 'Crear curso' })).toBeVisible();
    await page.getByLabel(/^Título \(máximo 150/).fill(TITULO);
    await page.getByLabel(/^Subtítulo/).fill('Subtítulo de prueba E2E');
    await page.getByLabel(/^Descripción/).fill('Descripción del curso de prueba E2E con contenido suficiente.');
    await page.getByLabel('Categoría').selectOption({ label: categoria });
    await page.getByLabel('Nivel').selectOption('INTERMEDIO');
    await page.getByLabel('URL de portada').fill('/img/portada-mi-curso.jpg');
    await page.getByLabel(/^Objetivos/).fill('Objetivo uno\nObjetivo dos\nObjetivo tres');
    await page.getByRole('button', { name: 'Crear borrador' }).click();
    await expect(page.getByRole('heading', { name: 'Contenido del curso' })).toBeVisible();
    await expect(page).toHaveURL(/\/docente\/cursos\/\d+\/editar$/);
    const idCurso = page.url().match(/cursos\/(\d+)\/editar/)![1]!;

    // 2. Módulo y lección PDF.
    await page.getByRole('button', { name: 'Agregar módulo' }).click();
    await page.getByLabel(/^Título \(obligatorio/).fill('Módulo uno');
    await page.getByLabel(/^Orden/).fill('1');
    await page.getByRole('button', { name: 'Guardar módulo' }).click();
    await expect(page.getByText(/1\. Módulo uno/)).toBeVisible();

    await page.getByRole('button', { name: 'Agregar lección PDF' }).click();
    await page.getByLabel(/^Título \(obligatorio/).fill('Apunte de redes');
    await page.getByLabel(/^Orden/).fill('1');
    await page.getByRole('button', { name: 'Guardar lección' }).click();
    await expect(page.getByText(/1\. Apunte de redes/)).toBeVisible();

    // 3. Subida con indicador de progreso: se retrasa la petición para poder observarlo.
    await page.route('**/api/lecciones/*/archivo', async (ruta) => {
      await new Promise((r) => setTimeout(r, 2_000));
      await ruta.continue();
    });
    await page.locator('input[type=file]').setInputFiles({
      name: 'apunte.pdf',
      mimeType: 'application/pdf',
      buffer: await pdfMinimo(2),
    });
    await expect(page.getByRole('progressbar', { name: 'Progreso de subida del PDF' })).toBeVisible();
    await expect(page.getByText(/PDF asociado: apunte\.pdf/)).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await page.unroute('**/api/lecciones/*/archivo');

    // 4. Descarga del PDF propio.
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar PDF' }).click(),
    ]);
    expect(descarga.suggestedFilename()).toBe('apunte.pdf');
    const ruta = await descarga.path();
    expect(readFileSync(ruta).subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // 5. El título con HTML se ve como texto en el editor.
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await xssEjecutado(page)).toBe(false);

    // 6. Envío a revisión: el editor queda bloqueado.
    await page.getByRole('button', { name: 'Enviar a revisión' }).click();
    await expect(page.getByText('Este curso no permite cambios en su estado actual.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Agregar módulo' })).toHaveCount(0);
    await expect(page.getByText(/Subir PDF|Reemplazar PDF/)).toHaveCount(0);
    await expect(page.getByLabel(/^Título \(máximo 150/)).toBeDisabled();

    // 7. El administrador revisa y aprueba.
    const { contexto, pagina } = await otroContexto(context);
    try {
      vigilarDialogos(pagina, dialogos);
      await iniciarSesionPorUI(pagina, admin.correo);
      await pagina.goto('/admin/revision');
      const tarjeta = pagina.locator('li.tarjeta', { hasText: MARCA });
      await expect(tarjeta).toHaveCount(1);
      await tarjeta.getByRole('link', { name: 'Revisar curso' }).click();
      await expect(pagina).toHaveURL(new RegExp(`/admin/revision/${idCurso}$`));
      await expect(pagina.locator('img[src="x"]')).toHaveCount(0);
      expect(await xssEjecutado(pagina)).toBe(false);
      await pagina.getByRole('button', { name: 'Aprobar y publicar' }).click();
      await expect(pagina.getByText('Este curso ya no está pendiente de revisión.')).toBeVisible();
    } finally {
      await contexto.close();
    }

    // 8. El docente lo ve PUBLICADO y bloqueado; el catálogo público lo muestra como texto.
    await page.goto('/docente/cursos');
    const mio = page.locator('li.tarjeta', { hasText: MARCA });
    await expect(mio.getByText('Publicado', { exact: true })).toBeVisible();
    await page.goto(`/docente/cursos/${idCurso}/editar`);
    await expect(page.getByText('Este curso no permite cambios en su estado actual.')).toBeVisible();
    await expect(page.getByText(/Subir PDF|Reemplazar PDF/)).toHaveCount(0);

    const { contexto: anonimo, pagina: visitante } = await otroContexto(context);
    try {
      vigilarDialogos(visitante, dialogos);
      await visitante.goto(`/cursos?q=${encodeURIComponent(MARCA)}`);
      await expect(visitante.getByText(MARCA).first()).toBeVisible();
      await expect(visitante.getByText('<img src=x', { exact: false }).first()).toBeVisible();
      await expect(visitante.locator('img[src="x"]')).toHaveCount(0);

      await visitante.goto(`/cursos/${idCurso}`);
      await expect(visitante.getByRole('heading', { level: 1 })).toContainText('<img src=x');
      await expect(visitante.locator('img[src="x"]')).toHaveCount(0);
      expect(await xssEjecutado(visitante)).toBe(false);
    } finally {
      await anonimo.close();
    }

    expect(dialogos, 'ningún alert/prompt de la página').toEqual([]);
  });
});
