import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { pdfMinimo } from '../../backend/test/ayudas/archivos.js';
import { crearCategoria, crearCuenta, MARCA } from '../soporte/bd';
import { iniciarSesionPorUI, otroContexto } from '../soporte/ui';

const VIDEO_ID = 'M7lc1UVf-VE';

async function revisarAccesibilidad(pagina: Page): Promise<void> {
  const axe = await new AxeBuilder({ page: pagina as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('iframe').analyze();
  const violaciones = axe.violations.map((v) => `${v.id} · ${v.nodes[0]?.target.join(' ')} · ${v.help}`);
  expect(violaciones, violaciones.join('\n')).toEqual([]);
}

test('docente crea vídeos con PDF de apoyo, amplía el curso publicado con una evaluación y el estudiante la responde', async ({ page, context }) => {
  test.setTimeout(180_000);
  page.on('dialog', (dialogo) => void dialogo.accept());

  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-video');
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente-video');
  const estudiante = await crearCuenta(['ESTUDIANTE'], 'estudiante-video');
  const categoria = await crearCategoria(admin.idPersona, 'Tecnología');

  await iniciarSesionPorUI(page, docente.correo);
  await page.goto('/docente/cursos/nuevo/editar');
  await page.getByLabel('Título del curso').fill(`${MARCA} Curso de vídeo`);
  await page.getByLabel('Subtítulo breve').fill('Aprende con dos vídeos');
  await page.getByLabel('Descripción detallada').fill('Curso de prueba con dos vídeos de YouTube ordenados.');
  await page.getByLabel('Categoría').selectOption({ label: categoria });
  await page.getByLabel('Nivel de dificultad').selectOption('PRINCIPIANTE');
  await page.getByLabel('URL de imagen de portada').fill('/img/portada-prueba.jpg');
  await page.getByLabel('Objetivos de aprendizaje').fill('Comprender el tema\nAplicar los conceptos\nRevisar los ejemplos');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  await expect(page).toHaveURL(/\/docente\/cursos\/\d+\/editar$/);
  const idCurso = page.url().match(/cursos\/(\d+)\/editar/)![1]!;

  await page.getByRole('button', { name: /Módulos y contenido/ }).click();
  await page.getByRole('button', { name: /Agregar módulo/ }).click();
  await page.getByLabel('Título del módulo').fill('Fundamentos');
  await page.getByLabel('Posición en el curso').fill('1');
  await page.getByRole('button', { name: 'Crear módulo' }).click();
  const modulo = page.locator('details.modulo').first();
  await expect(modulo).toContainText('Fundamentos');

  await modulo.getByRole('button', { name: '+ Vídeo' }).click();
  await modulo.getByLabel('Título que verá el estudiante').fill('Primer vídeo');
  await modulo.getByLabel('Posición en el módulo').fill('1');
  await modulo.getByLabel(/Enlace del vídeo de YouTube/).fill(
    `https://www.youtube.com/watch?v=${VIDEO_ID}&list=${'a'.repeat(260)}`,
  );
  await modulo.getByRole('button', { name: 'Guardar vídeo' }).click();
  await expect(modulo).toContainText('Primer vídeo');
  await expect(modulo).toContainText('1 vídeos');

  await modulo.getByRole('button', { name: '+ Vídeo' }).click();
  await modulo.getByLabel('Título que verá el estudiante').fill('Segundo vídeo');
  await modulo.getByLabel('Posición en el módulo').fill('2');
  await modulo.getByLabel(/Enlace del vídeo de YouTube/).fill(`https://youtu.be/${VIDEO_ID}`);
  await modulo.getByRole('button', { name: 'Guardar vídeo' }).click();
  await expect(modulo).toContainText('2 vídeos');

  const primero = modulo.locator('.contenido-fila', { hasText: 'Primer vídeo' });
  await primero.getByRole('button', { name: 'Editar' }).click();
  await expect(modulo.locator('form.editor-integrado')).toBeVisible();
  await modulo.getByLabel('Título que verá el estudiante').fill('Primer vídeo actualizado');
  await modulo.getByRole('button', { name: 'Guardar vídeo' }).click();
  await expect(modulo).toContainText('Primer vídeo actualizado');

  // La vista del vídeo está siempre presente (sin botón «Cargar vídeo») y admite un PDF de apoyo.
  await expect(primero.locator('app-reproductor-youtube')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cargar vídeo' })).toHaveCount(0);
  await primero.locator('input[type=file]').setInputFiles({
    name: 'apoyo.pdf', mimeType: 'application/pdf', buffer: await pdfMinimo(2),
  });
  await expect(primero.getByText(/Material de apoyo: apoyo\.pdf/)).toBeVisible();

  await expect(page.getByRole('button', { name: 'Enviar a revisión' })).toBeEnabled();
  await page.getByRole('button', { name: 'Enviar a revisión' }).click();
  await expect(page.getByText('Curso enviado a revisión.')).toBeVisible();

  const { contexto: adminContexto, pagina: adminPagina } = await otroContexto(context);
  try {
    await iniciarSesionPorUI(adminPagina, admin.correo);
    await adminPagina.goto('/admin/revision');
    await adminPagina.locator('li.tarjeta', { hasText: MARCA }).getByRole('link', { name: 'Revisar curso' }).click();
    await expect(adminPagina).toHaveURL(new RegExp(`/admin/revision/${idCurso}$`));
    adminPagina.on('dialog', (dialogo) => void dialogo.accept());
    await adminPagina.getByRole('button', { name: 'Aprobar y publicar' }).click();
    await expect(adminPagina.getByText('Este curso ya no está pendiente de revisión.')).toBeVisible();
  } finally {
    await adminContexto.close();
  }

  // Ya publicado, el docente agrega un tercer vídeo y el curso sigue publicado, sin nueva revisión.
  await page.goto(`/docente/cursos/${idCurso}/editar`);
  await expect(page.locator('.aviso-publicado')).toBeVisible();
  await page.getByRole('button', { name: /Módulos y contenido/ }).click();
  const moduloPublicado = page.locator('details.modulo').first();
  await moduloPublicado.getByRole('button', { name: '+ Vídeo' }).click();
  await moduloPublicado.getByLabel('Título que verá el estudiante').fill('Tercer vídeo');
  await moduloPublicado.getByLabel('Posición en el módulo').fill('3');
  await moduloPublicado.getByLabel(/Enlace del vídeo de YouTube/).fill(`https://youtu.be/${VIDEO_ID}`);
  await moduloPublicado.getByRole('button', { name: 'Guardar vídeo' }).click();
  await expect(moduloPublicado).toContainText('3 vídeos');
  await expect(page.getByRole('heading', { name: 'Curso publicado' })).toBeVisible();

  // Y una evaluación de opción múltiple: 5 preguntas con la A como respuesta correcta.
  await moduloPublicado.getByRole('button', { name: '+ Evaluación' }).click();
  await moduloPublicado.getByLabel('Título que verá el estudiante').fill('Evaluación final');
  await moduloPublicado.getByLabel('Posición en el módulo').fill('4');
  await moduloPublicado.getByRole('button', { name: 'Guardar evaluación' }).click();
  const evaluacion = moduloPublicado.locator('.contenido-fila', { hasText: 'Evaluación final' });
  await expect(evaluacion.locator('fieldset.pregunta')).toHaveCount(5);
  await evaluacion.getByRole('button', { name: 'Guardar preguntas' }).click();
  await expect(evaluacion.getByText('Escribe el enunciado.').first()).toBeVisible();
  for (let i = 1; i <= 5; i++) {
    await evaluacion.getByLabel(`Enunciado de la pregunta ${i}`).fill(`¿Pregunta número ${i}?`);
    for (const letra of ['A', 'B', 'C', 'D']) {
      await evaluacion.getByLabel(`Opción ${letra} de la pregunta ${i}`, { exact: true })
        .fill(letra === 'A' ? `Correcta ${i}` : `Distractor ${letra}`);
    }
  }
  await evaluacion.getByRole('button', { name: 'Guardar preguntas' }).click();
  await expect(page.getByText('Preguntas guardadas.')).toBeVisible();
  await expect(evaluacion).toContainText('5 preguntas');
  await expect(page.getByRole('heading', { name: 'Curso publicado' })).toBeVisible();

  const { contexto: estudianteContexto, pagina: estudiantePagina } = await otroContexto(context);
  try {
    await iniciarSesionPorUI(estudiantePagina, estudiante.correo);
    await estudiantePagina.goto(`/cursos/${idCurso}`);
    await estudiantePagina.getByRole('button', { name: 'Inscribirme gratis' }).click();
    await expect(estudiantePagina).toHaveURL(new RegExp(`/aprender/${idCurso}/\\d+$`));
    await expect(estudiantePagina.getByRole('heading', { name: 'Primer vídeo actualizado' })).toBeVisible();
    await expect(estudiantePagina.locator('.temario-lateral').getByRole('link', { name: /Segundo vídeo/ })).toBeVisible();
    await expect(estudiantePagina.locator('.temario-lateral').getByRole('link', { name: /Tercer vídeo/ })).toBeVisible();
    // El vídeo se carga solo y su PDF de apoyo se descarga desde el temario («Recursos»).
    await expect(estudiantePagina.locator('app-reproductor-youtube')).toBeVisible();
    await expect(estudiantePagina.getByRole('button', { name: 'Cargar vídeo' })).toHaveCount(0);
    await expect(estudiantePagina.getByRole('button', { name: 'Descargar recurso de Primer vídeo actualizado' })).toBeVisible();
    await expect(estudiantePagina.getByText('Aprende con dos vídeos')).toBeVisible();
    await revisarAccesibilidad(estudiantePagina);

    // La evaluación: suspender no bloquea nada y se puede repetir hasta aprobar.
    await estudiantePagina.locator('.temario-lateral').getByRole('link', { name: /Evaluación final/ }).click();
    await expect(estudiantePagina.getByRole('heading', { name: 'Evaluación final', level: 2 })).toBeVisible();
    await expect(estudiantePagina.getByText(/Correcta|Distractor/).first()).toBeVisible();
    const enviar = estudiantePagina.getByRole('button', { name: 'Enviar respuestas' });
    await expect(enviar).toBeDisabled();
    for (let i = 1; i <= 5; i++) {
      // Dos aciertos y tres fallos: 40 %.
      await estudiantePagina.getByRole('group', { name: new RegExp(`Pregunta ${i} de 5`) })
        .getByLabel(i <= 2 ? `Correcta ${i}` : 'Distractor B').check();
    }
    await enviar.click();
    await expect(estudiantePagina.getByText('Esta vez no alcanzaste el 60 %.')).toBeVisible();
    await expect(estudiantePagina.getByText('2 de 5 respuestas correctas.')).toBeVisible();
    await expect(estudiantePagina.getByText('Pendiente de aprobar')).toBeVisible();
    await expect(estudiantePagina.locator('.temario-lateral').getByRole('link', { name: /Primer vídeo/ })).toBeVisible();
    await revisarAccesibilidad(estudiantePagina);

    await estudiantePagina.getByRole('button', { name: 'Intentar de nuevo' }).click();
    for (let i = 1; i <= 5; i++) {
      await estudiantePagina.getByRole('group', { name: new RegExp(`Pregunta ${i} de 5`) }).getByLabel(`Correcta ${i}`).check();
    }
    await enviar.click();
    await expect(estudiantePagina.getByText('¡Aprobaste la evaluación!')).toBeVisible();
    await expect(estudiantePagina.getByRole('img', { name: 'Evaluación aprobada' })).toBeVisible();
    await estudiantePagina.reload();
    await expect(estudiantePagina.getByText('Aprobada', { exact: true }).first()).toBeVisible();
    await revisarAccesibilidad(estudiantePagina);
  } finally {
    await estudianteContexto.close();
  }
});
