import AxeBuilder from '@axe-core/playwright';
import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';
import { pdfMinimo } from '../../backend/test/ayudas/archivos.js';
import { CONTRASENA_PRUEBA, crearCategoria, crearCuenta, MARCA } from '../soporte/bd';
import { RAIZ_TMP, URL_API, URL_WEB } from '../soporte/entorno';
import { iniciarSesionPorUI, otroContexto } from '../soporte/ui';
import path from 'node:path';

async function revisarAccesibilidad(pagina: Page): Promise<void> {
  const axe = await new AxeBuilder({ page: pagina as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('iframe').analyze();
  const violaciones = axe.violations.map((v) => `${v.id} · ${v.nodes[0]?.target.join(' ')} · ${v.help}`);
  expect(violaciones, violaciones.join('\n')).toEqual([]);
}

/** Capturas para revisar el diseño a ojo (no forman parte de la aserción). */
const captura = (pagina: Page, nombre: string) =>
  pagina.screenshot({ path: path.join(RAIZ_TMP, 'capturas', `${nombre}.png`), fullPage: true });

async function api(correo: string): Promise<{ ctx: APIRequestContext; pedir: (m: string, ruta: string, datos?: object) => Promise<any>; token: string }> {
  const ctx = await request.newContext({ baseURL: URL_API, extraHTTPHeaders: { Origin: URL_WEB } });
  const login = await ctx.post('/api/auth/login', { data: { correo, contrasena: CONTRASENA_PRUEBA } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const token = (await login.json()).accessToken as string;
  const pedir = async (metodo: string, ruta: string, datos?: object) => {
    const r = await ctx.fetch(ruta, { method: metodo, data: datos, headers: { Authorization: `Bearer ${token}` } });
    expect(r.ok(), `${metodo} ${ruta}: ${await r.text()}`).toBeTruthy();
    return r.status() === 204 ? null : r.json();
  };
  return { ctx, pedir, token };
}

test('el docente gestiona sus reseñas, exporta, ve analíticas y el administrador modera', async ({ page, context }) => {
  test.setTimeout(180_000);
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-resenas');
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente-resenas');
  const ana = await crearCuenta(['ESTUDIANTE'], 'ana-resenas');
  const beto = await crearCuenta(['ESTUDIANTE'], 'beto-resenas');
  const categoria = await crearCategoria(admin.idPersona, 'Física');

  // Curso publicado con una lección PDF y dos reseñas, preparado por la API.
  const comoDocente = await api(docente.correo);
  const categorias = await (await comoDocente.ctx.get('/api/categorias')).json();
  const curso = await comoDocente.pedir('POST', '/api/cursos', {
    titulo: `${MARCA} Física con reseñas`, subtitulo: 'Movimiento y fuerzas', descripcion: 'Curso de prueba E2E.',
    categoriaId: categorias.find((c: { nombre: string }) => c.nombre === categoria).id, nivel: 'PRINCIPIANTE',
    portadaUrl: '/img/portada-prueba.jpg', objetivos: ['Medir', 'Calcular', 'Experimentar'],
  });
  const conModulo = await comoDocente.pedir('POST', `/api/cursos/${curso.id}/modulos`, { titulo: 'Cinemática', orden: 1 });
  const conLeccion = await comoDocente.pedir('POST', `/api/modulos/${conModulo.modulos[0].id}/lecciones`, {
    titulo: 'Velocidad', orden: 1, tipo: 'DOCUMENTO',
  });
  const leccionId = conLeccion.modulos[0].lecciones[0].id;
  const subida = await comoDocente.ctx.post(`/api/lecciones/${leccionId}/archivo`, {
    headers: { Authorization: `Bearer ${comoDocente.token}` },
    multipart: { archivo: { name: 'velocidad.pdf', mimeType: 'application/pdf', buffer: await pdfMinimo(1) } },
  });
  expect(subida.ok(), await subida.text()).toBeTruthy();
  await comoDocente.pedir('POST', `/api/cursos/${curso.id}/enviar-revision`);
  const comoAdmin = await api(admin.correo);
  await comoAdmin.pedir('PUT', `/api/admin/cursos/${curso.id}/revision`, { decision: 'APROBAR' });
  for (const [cuenta, estrellas, comentario] of [[ana, 2, 'Le faltan ejemplos.'], [beto, 1, 'Pésimo, una estafa total.']] as const) {
    const est = await api(cuenta.correo);
    await est.pedir('POST', `/api/cursos/${curso.id}/inscripcion`);
    await est.pedir('PUT', `/api/cursos/${curso.id}/resena`, { estrellas, comentario });
    if (cuenta === ana) {
      await est.pedir('PUT', `/api/lecciones/${leccionId}/progreso`, { completada: true });
      await est.pedir('PUT', `/api/cursos/${curso.id}/resena`, { estrellas: 4, comentario: 'Mejoró con los ejemplos.' });
    }
    await est.ctx.dispose();
  }
  await Promise.all([comoDocente.ctx.dispose(), comoAdmin.ctx.dispose()]);

  // 1. Mis cursos y Estudiantes muestran inscritos y valoración (desde fe327cc el indicador se llama «Valoración» y la
  //    vista ya no exporta a CSV): el resumen del curso y la calificación de cada inscrito en la tabla.
  await iniciarSesionPorUI(page, docente.correo);
  await page.goto('/docente/cursos');
  const tarjeta = page.getByRole('listitem').filter({ hasText: `${MARCA} Física con reseñas` });
  await expect(tarjeta).toContainText('2 estudiantes');
  await expect(tarjeta).toContainText('(2 reseñas)');
  await page.goto(`/docente/estudiantes?curso=${curso.id}`);
  const resumen = page.getByRole('group', { name: 'Resumen del curso' });
  await expect(resumen).toContainText('Valoración');
  await expect(resumen).toContainText(/2[.,]5 de 5/);
  await expect(resumen).toContainText('2 reseñas');
  const inscritos = page.getByRole('region', { name: 'Estudiantes inscritos' });
  await expect(inscritos.getByRole('row')).toHaveCount(3);
  await expect(inscritos.getByRole('img', { name: '4 de 5 estrellas' })).toBeVisible();
  await expect(inscritos.getByRole('img', { name: '1 de 5 estrellas' })).toBeVisible();
  await revisarAccesibilidad(page);

  // 2. Bandeja: avance al reseñar, edición «antes / ahora», responder y reportar.
  await page.goto('/docente/resenas');
  const deAna = page.getByRole('article', { name: /Reseña de .*ana-resenas|Reseña de/ }).filter({ hasText: 'Mejoró con los ejemplos.' });
  await expect(deAna).toContainText('Calificó con 4 estrellas al llevar el 0 % del curso');
  await expect(deAna).toContainText('Reseña editada (antes 2 estrellas, ahora 4 estrellas)');
  await deAna.getByRole('button', { name: 'Responder' }).click();
  await deAna.getByLabel('Tu respuesta pública').fill('¡Gracias! Añadí más ejemplos resueltos.');
  await deAna.getByRole('button', { name: 'Publicar respuesta' }).click();
  await expect(page.getByText('Respuesta publicada.')).toBeVisible();
  await expect(deAna).toContainText('Tu respuesta');

  const deBeto = page.getByRole('article').filter({ hasText: 'Pésimo, una estafa total.' });
  await deBeto.getByRole('button', { name: 'Reportar' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Reportar reseña' });
  await dialogo.getByRole('radio', { name: /Lenguaje ofensivo/ }).check();
  await dialogo.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(deBeto).toContainText('Reportada · en revisión');
  await page.getByLabel('Respuesta').selectOption('sin-responder');
  await expect(page.getByRole('heading', { name: /^1 reseña/ })).toBeVisible();
  await captura(page, '10-bandeja-resenas');
  await revisarAccesibilidad(page);

  // 3. Analíticas del curso: embudo por lección y conversión.
  await page.goto(`/docente/analiticas?curso=${curso.id}`);
  await expect(page.getByRole('heading', { name: 'Retención por lección' })).toBeVisible();
  await expect(page.locator('.embudo li').first()).toContainText('50 %');
  await expect(page.getByText(/2 inscripciones de \d+ vistas/)).toBeVisible();
  await captura(page, '10-analiticas');
  await revisarAccesibilidad(page);

  // 4. El perfil muestra la valoración global y la ficha pública la respuesta del docente.
  await page.goto('/docente/perfil');
  await expect(page.getByText(/Valoración como docente · 2 reseñas/)).toBeVisible();

  // 5. El administrador ve el historial y oculta la reseña ofensiva.
  const { contexto: ctxAdmin, pagina: paginaAdmin } = await otroContexto(context);
  try {
    await iniciarSesionPorUI(paginaAdmin, admin.correo);
    await paginaAdmin.goto('/admin/resenas');
    // Acceso total: la reseña también aparece en «Todas las reseñas», con su reporte pendiente.
    await expect(paginaAdmin.getByRole('article').filter({ hasText: 'Pésimo, una estafa total.' })).toContainText('Reporte pendiente');
    await paginaAdmin.getByRole('tab', { name: 'Reportes pendientes' }).click();
    const reporte = paginaAdmin.getByRole('article').filter({ hasText: 'Pésimo, una estafa total.' });
    await reporte.getByText(/Historial completo/).click();
    await expect(reporte).toContainText('Publicó la reseña');
    await revisarAccesibilidad(paginaAdmin);
    await captura(paginaAdmin, '10-moderacion');
    await reporte.getByRole('button', { name: 'Ocultar reseña' }).click();
    await paginaAdmin.getByRole('dialog').getByRole('button', { name: 'Ocultar reseña' }).click();
    await expect(paginaAdmin.getByText('Reseña ocultada.')).toBeVisible();
  } finally {
    await ctxAdmin.close();
  }

  await page.goto(`/cursos/${curso.id}`);
  const publicas = page.getByRole('region', { name: 'Reseñas de estudiantes' });
  await expect(publicas).toContainText('Respuesta del docente');
  await expect(publicas).toContainText('Editada');
  await expect(publicas).not.toContainText('Pésimo, una estafa total.');
  await expect(page.getByRole('link', { name: /\(1 reseña\)/ })).toBeVisible();
});
