import AxeBuilder from '@axe-core/playwright';
import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';
import { pdfMinimo } from '../../backend/test/ayudas/archivos.js';
import { CONTRASENA_PRUEBA, crearCategoria, crearCuenta, MARCA } from '../soporte/bd';
import { URL_API, URL_WEB } from '../soporte/entorno';
import { iniciarSesionPorUI, otroContexto } from '../soporte/ui';

/** PNG de 1×1 válido para la foto de perfil. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
/** ZIP mínimo válido: solo el registro de fin de directorio central. */
const ZIP = Buffer.from([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]);

async function revisarAccesibilidad(pagina: Page): Promise<void> {
  const axe = await new AxeBuilder({ page: pagina as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('iframe').analyze();
  const violaciones = axe.violations.map((v) => `${v.id} · ${v.nodes[0]?.target.join(' ')} · ${v.help}`);
  expect(violaciones, violaciones.join('\n')).toEqual([]);
}

/** Cliente de la API con la sesión de una cuenta: prepara datos sin repetir pantallas ya probadas. */
async function api(correo: string): Promise<{
  ctx: APIRequestContext; token: string; pedir: (m: string, ruta: string, datos?: object) => Promise<any>;
}> {
  const ctx = await request.newContext({ baseURL: URL_API, extraHTTPHeaders: { Origin: URL_WEB } });
  const login = await ctx.post('/api/auth/login', { data: { correo, contrasena: CONTRASENA_PRUEBA } });
  expect(login.ok(), await login.text()).toBeTruthy();
  const token = (await login.json()).accessToken as string;
  const pedir = async (metodo: string, ruta: string, datos?: object) => {
    const r = await ctx.fetch(ruta, { method: metodo, data: datos, headers: { Authorization: `Bearer ${token}` } });
    expect(r.ok(), `${metodo} ${ruta}: ${await r.text()}`).toBeTruthy();
    return r.json();
  };
  return { ctx, token, pedir };
}

test('cierre del MVP: categorías y usuarios del administrador, recursos, instructor, reseñas y foto de perfil', async ({ page, context }) => {
  test.setTimeout(180_000);
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-cierre');
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente-cierre');
  const estudiante = await crearCuenta(['ESTUDIANTE'], 'estudiante-cierre');
  const aspirante = await crearCuenta(['ESTUDIANTE'], 'aspirante-cierre');
  const categoria = await crearCategoria(admin.idPersona, 'Electrónica');

  // 1. El administrador crea una categoría, la desactiva (con confirmación) y la reactiva.
  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/categorias');
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  const formulario = page.getByRole('dialog', { name: 'Nueva categoría' });
  await formulario.getByLabel('Nombre').fill(`${MARCA} Robótica`);
  await formulario.getByRole('button', { name: 'Crear categoría' }).click();
  await expect(page.getByText(`Categoría «${MARCA} Robótica» creada.`)).toBeVisible();
  const fila = page.getByRole('row', { name: new RegExp(`${MARCA} Robótica`) });
  await fila.getByRole('button', { name: `Desactivar ${MARCA} Robótica` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Desactivar categoría' }).click();
  await expect(fila.getByText('Inactiva')).toBeVisible();
  await fila.getByRole('button', { name: `Activar ${MARCA} Robótica` }).click();
  await expect(fila.getByText('Activa', { exact: true })).toBeVisible();
  await revisarAccesibilidad(page);

  // 2. Gestión de usuarios con datos reales: buscar y asignar el rol Docente.
  await page.goto('/admin/usuarios');
  await page.getByRole('searchbox', { name: 'Buscar por nombre o correo' }).fill(aspirante.correo);
  const persona = page.getByRole('row', { name: new RegExp(aspirante.correo.replace(/[.+]/g, '\\$&')) });
  await expect(persona).toHaveCount(1);
  await persona.getByRole('button', { name: /^Editar roles de/ }).click();
  const roles = page.getByRole('dialog');
  await expect(roles.getByRole('checkbox', { name: /Estudiante/ })).toBeDisabled();
  await roles.getByRole('checkbox', { name: /Docente/ }).check();
  await roles.getByRole('button', { name: 'Guardar roles' }).click();
  await expect(persona.getByText('Docente', { exact: true })).toBeVisible();
  await revisarAccesibilidad(page);

  // 3. Curso publicado preparado por la API (las pantallas de creación ya las cubren 05 y 08).
  const { ctx: ctxDocente, token: tokenDocente, pedir: comoDocente } = await api(docente.correo);
  const categorias = await (await ctxDocente.get('/api/categorias')).json();
  const idCategoria = categorias.find((c: { nombre: string }) => c.nombre === categoria).id;
  const curso = await comoDocente('POST', '/api/cursos', {
    titulo: `${MARCA} Curso con reseñas`, subtitulo: 'Circuitos desde cero', descripcion: 'Curso de prueba E2E.',
    categoriaId: idCategoria, nivel: 'PRINCIPIANTE', portadaUrl: '/img/portada-prueba.jpg',
    objetivos: ['Leer esquemas', 'Medir voltajes', 'Montar un circuito'],
  });
  const conModulo = await comoDocente('POST', `/api/cursos/${curso.id}/modulos`, { titulo: 'Fundamentos', orden: 1 });
  const conLeccion = await comoDocente('POST', `/api/modulos/${conModulo.modulos[0].id}/lecciones`, {
    titulo: 'Ley de Ohm', orden: 1, tipo: 'DOCUMENTO',
  });
  const leccionId = conLeccion.modulos[0].lecciones[0].id;
  const subida = await ctxDocente.post(`/api/lecciones/${leccionId}/archivo`, {
    headers: { Authorization: `Bearer ${tokenDocente}` },
    multipart: { archivo: { name: 'ohm.pdf', mimeType: 'application/pdf', buffer: await pdfMinimo(1) } },
  });
  expect(subida.ok(), await subida.text()).toBeTruthy();
  await comoDocente('POST', `/api/cursos/${curso.id}/enviar-revision`);
  const { ctx: ctxAdmin, pedir: comoAdmin } = await api(admin.correo);
  await comoAdmin('PUT', `/api/admin/cursos/${curso.id}/revision`, { decision: 'APROBAR' });
  await Promise.all([ctxDocente.dispose(), ctxAdmin.dispose()]);

  // 4. El docente añade un ZIP con el código como recurso descargable.
  const { contexto: ctxPaginaDocente, pagina: paginaDocente } = await otroContexto(context);
  try {
    await iniciarSesionPorUI(paginaDocente, docente.correo);
    await paginaDocente.goto(`/docente/cursos/${curso.id}/editar`);
    await paginaDocente.getByRole('button', { name: /Módulos y contenido/ }).click();
    await paginaDocente.getByLabel('Añadir un recurso a Ley de Ohm').setInputFiles({
      name: 'codigo-ohm.zip', mimeType: 'application/zip', buffer: ZIP,
    });
    await expect(paginaDocente.getByText('«codigo-ohm.zip» añadido a la lección.')).toBeVisible();
    await expect(paginaDocente.getByText('Recursos descargables 1/5')).toBeVisible();
  } finally {
    await ctxPaginaDocente.close();
  }

  // 5. El estudiante ve al instructor, se inscribe, descarga el recurso, deja su reseña y sube su foto.
  const { contexto: ctxEstudiante, pagina: alumna } = await otroContexto(context);
  try {
    await iniciarSesionPorUI(alumna, estudiante.correo);
    await alumna.goto(`/cursos/${curso.id}`);
    const instructor = alumna.getByRole('region', { name: 'Tu docente' });
    await expect(instructor).toContainText('1 curso publicado');
    await expect(alumna.getByText('Sin reseñas todavía')).toBeVisible();

    await alumna.getByRole('button', { name: 'Inscribirme gratis' }).click();
    await expect(alumna).toHaveURL(new RegExp(`/aprender/${curso.id}/${leccionId}$`));
    const recursos = alumna.getByRole('region', { name: 'Recursos de esta lección' });
    await expect(recursos).toContainText('codigo-ohm');
    const [descarga] = await Promise.all([
      // Chromium sin interfaz también «descarga» el PDF del visor de la lección: esperar la del recurso.
      alumna.waitForEvent('download', { predicate: (d) => d.suggestedFilename().endsWith('.zip') }),
      recursos.getByRole('button', { name: 'Descargar codigo-ohm' }).click(),
    ]);
    expect(descarga.suggestedFilename()).toBe('codigo-ohm.zip');

    await alumna.goto(`/cursos/${curso.id}`);
    await alumna.getByRole('button', { name: 'Escribir una reseña' }).click();
    await alumna.getByRole('radio', { name: /^4 estrellas/ }).check();
    await alumna.getByLabel(/Tu comentario/).fill('Explicaciones claras y ejemplos prácticos.');
    await alumna.getByRole('button', { name: 'Publicar reseña' }).click();
    await expect(alumna.getByText('Gracias por tu reseña.')).toBeVisible();
    await expect(alumna.getByRole('region', { name: 'Reseñas de estudiantes' })).toContainText('Explicaciones claras y ejemplos prácticos.');
    await expect(alumna.getByRole('link', { name: /\(1 reseña\)/ })).toBeVisible();
    await revisarAccesibilidad(alumna);

    await alumna.goto('/perfil');
    await alumna.locator('app-foto-perfil input[type=file]').setInputFiles({ name: 'yo.png', mimeType: 'image/png', buffer: PNG });
    await alumna.getByRole('button', { name: 'Guardar foto' }).click();
    await expect(alumna.getByText('Foto de perfil actualizada.')).toBeVisible();
    await expect(alumna.locator('app-menu-cuenta img.foto').first()).toHaveAttribute('src', /^\/api\/fotos\/[0-9a-f-]{36}\.png$/);
  } finally {
    await ctxEstudiante.close();
  }
});
