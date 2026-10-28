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
    const estudiante = await crearCuenta(['ESTUDIANTE'], 'estudiante');
    const categoria = await crearCategoria(admin.idPersona, 'Redes');

    // 1. El docente crea el borrador.
    await iniciarSesionPorUI(page, docente.correo);
    await page.goto('/docente/cursos/nuevo/editar');
    await expect(page.getByRole('heading', { name: 'Crear curso' })).toBeVisible();
    await page.getByLabel('Título del curso').fill(TITULO);
    await page.getByLabel(/Subtítulo/).fill('Subtítulo de prueba E2E');
    await page.getByLabel('Descripción detallada').fill('Descripción del curso de prueba E2E con contenido suficiente.');
    await page.getByLabel('Categoría').selectOption({ label: categoria });
    await page.getByLabel('Nivel de dificultad').selectOption('INTERMEDIO');
    await page.getByLabel('URL de imagen de portada').fill('/img/portada-mi-curso.jpg');
    await page.getByLabel(/Objetivos/).fill('Objetivo uno\nObjetivo dos\nObjetivo tres');
    await page.getByRole('button', { name: 'Crear borrador' }).click();
    await expect(page).toHaveURL(/\/docente\/cursos\/\d+\/editar$/);
    const idCurso = page.url().match(/cursos\/(\d+)\/editar/)![1]!;
    await page.getByRole('button', { name: /Módulos y contenido/ }).click();

    // 2. Módulo y lección PDF.
    await page.getByRole('button', { name: /Agregar módulo/ }).click();
    await page.getByLabel('Título del módulo').fill('Módulo uno');
    await page.getByLabel('Posición en el curso').fill('1');
    await page.getByRole('button', { name: 'Crear módulo' }).click();
    const modulo = page.locator('details.modulo').first();
    await expect(modulo).toContainText('Módulo uno');

    await modulo.getByRole('button', { name: '+ PDF' }).click();
    await modulo.getByLabel('Título que verá el estudiante').fill('Apunte de redes');
    await modulo.getByLabel('Posición en el módulo').fill('1');
    await modulo.getByRole('button', { name: 'Guardar documento' }).click();
    await expect(modulo).toContainText('Apunte de redes');

    // 3. Subida con indicador de progreso: se retrasa la petición para poder observarlo.
    await page.route('**/api/lecciones/*/archivo', async (ruta) => {
      await new Promise((r) => setTimeout(r, 2_000));
      await ruta.continue();
    });
    await page.locator('input[type=file][accept*="application/pdf"]').setInputFiles({
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
    await page.getByRole('dialog').getByRole('button', { name: 'Enviar a revisión' }).click();
    await expect(page.getByText('Este curso no permite cambios en su estado actual.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Agregar módulo' })).toHaveCount(0);
    await expect(page.getByText(/Subir PDF|Reemplazar PDF/)).toHaveCount(0);
    await expect(page.getByLabel('Título del curso')).toBeDisabled();

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
      await pagina.getByRole('dialog').getByRole('button', { name: 'Aprobar y publicar' }).click();
      await expect(pagina.getByText('Este curso ya no está pendiente de revisión.')).toBeVisible();
    } finally {
      await contexto.close();
    }

    // 8. El docente lo ve PUBLICADO y lo sigue editando sin volver a revisión (Sprint 3);
    //    el catálogo público lo muestra como texto.
    await page.goto('/docente/cursos');
    const mio = page.locator('li.tarjeta', { hasText: MARCA });
    await expect(mio.getByText('Publicado', { exact: true })).toBeVisible();
    await expect(mio.locator('.portada-curso')).toBeVisible();
    await mio.getByRole('link', { name: 'Editar curso' }).click();
    await expect(page).toHaveURL(new RegExp(`/docente/cursos/${idCurso}/editar$`));
    await expect(page.locator('.aviso-publicado')).toBeVisible();
    await expect(page.getByText('Este curso no permite cambios en su estado actual.')).toHaveCount(0);
    await page.getByLabel(/Subtítulo/).fill('Subtítulo ampliado después de publicar');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Datos guardados.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Curso publicado' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toHaveCount(0);
    await page.getByRole('button', { name: /Módulos y contenido/ }).click();
    await expect(page.getByText(/Reemplazar PDF/)).toBeVisible();

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

    // 9. Un estudiante se inscribe, abre el PDF y conserva el avance tras recargar.
    const { contexto: contextoEstudiante, pagina: paginaEstudiante } = await otroContexto(context);
    try {
      await iniciarSesionPorUI(paginaEstudiante, estudiante.correo);
      await paginaEstudiante.goto(`/cursos/${idCurso}`);
      await paginaEstudiante.getByRole('button', { name: 'Inscribirme gratis' }).click();
      await expect(paginaEstudiante).toHaveURL(new RegExp(`/aprender/${idCurso}/\\d+$`));
      await expect(paginaEstudiante.getByRole('link', { name: 'Descargar PDF' })).toBeVisible();
      // La lección se marca con la casilla del temario lateral.
      await paginaEstudiante.getByRole('button', { name: 'Completar lección Apunte de redes' }).click();
      await expect(paginaEstudiante.getByRole('button', { name: 'Desmarcar lección Apunte de redes' })).toBeVisible();
      await paginaEstudiante.reload();
      await expect(paginaEstudiante.getByRole('button', { name: 'Desmarcar lección Apunte de redes' })).toBeVisible();
      await expect(paginaEstudiante.getByText('100% completado')).toBeVisible();
      await paginaEstudiante.goto('/mi-aprendizaje');
      await expect(paginaEstudiante.getByRole('heading', { name: 'Mi aprendizaje' })).toBeVisible();
      await expect(paginaEstudiante.getByText(TITULO).first()).toBeVisible();
    } finally {
      await contextoEstudiante.close();
    }

    // 10. El docente ve una inscripción y el progreso guardado.
    await page.goto(`/docente/estudiantes?curso=${idCurso}`);
    await expect(page.getByRole('heading', { name: 'Estudiantes de mis cursos' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Estudiantes inscritos' }).getByText('100 %')).toBeVisible();

    expect(dialogos, 'ningún alert/prompt de la página').toEqual([]);
  });
});
