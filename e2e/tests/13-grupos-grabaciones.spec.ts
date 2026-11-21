import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { conFixtures, CONTRASENA_PRUEBA, crearCategoria, crearCuenta, MARCA } from '../soporte/bd';
import { iniciarSesionPorUI, otroContexto } from '../soporte/ui';

test('un docente asigna una grabación a un grupo y solo sus miembros la reproducen', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(120_000);
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-grupo');
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente-grupo');
  const a = await crearCuenta(['ESTUDIANTE'], 'miembro-grupo');
  const b = await crearCuenta(['ESTUDIANTE'], 'externo-grupo');
  const categoria = await crearCategoria(admin.idPersona, 'Taller de grupos');
  const cat = await conFixtures(
    async (f) =>
      (await f.query('SELECT id_categoria AS id FROM categoria WHERE nombre=$1', [categoria])).rows[0]!.id,
  );
  async function token(correo: string) {
    const r = await request.post('/api/auth/login', { data: { correo, contrasena: CONTRASENA_PRUEBA } });
    expect(r.ok()).toBeTruthy();
    return (await r.json()).accessToken as string;
  }
  async function api(cliente: APIRequestContext, acceso: string, method: string, url: string, data?: object) {
    const r = await cliente.fetch('/api' + url, {
      method,
      data,
      headers: { authorization: 'Bearer ' + acceso },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  }
  const t = await token(docente.correo),
    ad = await token(admin.correo);
  const titulo = MARCA + ' Taller de grabaciones';
  const curso = (
    await api(request, t, 'POST', '/cursos', {
      titulo,
      subtitulo: 'Taller de prueba',
      descripcion: 'Taller de grupos y material privado.',
      categoriaId: cat,
      nivel: 'PRINCIPIANTE',
      portadaUrl: '/img/portada-prueba.jpg',
      objetivos: ['Crear', 'Asignar', 'Reproducir'],
      requisitos: [],
    })
  ).id;
  const modulo = (await api(request, t, 'POST', `/cursos/${curso}/modulos`, { titulo: 'Taller', orden: 1 }))
    .modulos[0].id;
  await api(request, t, 'POST', `/modulos/${modulo}/lecciones`, {
    titulo: 'Bienvenida general',
    orden: 1,
    tipo: 'VIDEO',
    youtubeUrl: 'M7lc1UVf-VE',
  });
  await api(request, t, 'POST', `/cursos/${curso}/enviar-revision`);
  await api(request, ad, 'PUT', `/admin/cursos/${curso}/revision`, { decision: 'APROBAR' });
  const ta = await token(a.correo),
    tb = await token(b.correo);
  await api(request, ta, 'POST', `/cursos/${curso}/inscripcion`);
  await api(request, tb, 'POST', `/cursos/${curso}/inscripcion`);
  // La lista muestra nombres; hacemos inequívoco el nombre de la cuenta de prueba.
  await conFixtures((f) =>
    f.query("UPDATE persona SET apellidos='Integrante del taller' WHERE id_persona=$1", [a.idPersona]),
  );
  await iniciarSesionPorUI(page, docente.correo);
  await page.goto(`/docente/estudiantes?curso=${curso}`);
  const grupos = page.getByRole('region', { name: 'Grupos del curso' });
  await grupos.getByLabel('Nombre del grupo').fill('Grupo A');
  await grupos.getByRole('checkbox', { name: /Integrante del taller/ }).check();
  await grupos.getByRole('button', { name: 'Crear grupo' }).click();
  await expect(grupos.getByRole('option', { name: 'Grupo A (1)' })).toBeAttached();
  await page.goto(`/docente/cursos/${curso}/editar`);
  await page.getByRole('button', { name: /Módulos y contenido/ }).click();
  const arbol = page.locator('details.modulo').first();
  await arbol.getByRole('button', { name: '+ Vídeo' }).click();
  await arbol.getByLabel('Título que verá el estudiante').fill('Tutoría del grupo A');
  await arbol.getByLabel('Posición en el módulo').fill('2');
  await arbol.getByLabel('Fuente del vídeo').selectOption('ARCHIVO');
  await arbol.getByLabel('Quién puede verlo').selectOption({ label: 'Solo el grupo · Grupo A' });
  await arbol
    .locator('input[accept*="video/mp4"]')
    .setInputFiles(path.resolve(__dirname, '../../backend/test/fixtures/grabacion-h264.mp4'));
  await arbol.getByRole('button', { name: 'Guardar vídeo' }).click();
  await expect(arbol.locator('app-reproductor-privado video')).toBeVisible();
  const aula = await api(request, ta, 'GET', `/mi-aprendizaje/cursos/${curso}`);
  const id = aula.modulos[0].lecciones.find((l: { titulo: string }) => l.titulo === 'Tutoría del grupo A').id;
  const autorizado = await otroContexto(context);
  const excluido = await otroContexto(context);
  try {
    await iniciarSesionPorUI(autorizado.pagina, a.correo);
    await autorizado.pagina.goto(`/aprender/${curso}/${id}`);
    const video = autorizado.pagina.locator('app-reproductor-privado video');
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
    const guardado = autorizado.pagina.waitForResponse(
      (r) =>
        r.url().endsWith('/lecciones/' + id + '/progreso') &&
        r.request().method() === 'PUT' &&
        r.request().postDataJSON()?.segundosVistos === 2 &&
        r.ok(),
    );
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = 2;
    });
    await guardado;
    await autorizado.pagina.setViewportSize({ width: 390, height: 844 });
    await autorizado.pagina.reload();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => Math.floor(v.currentTime))).toBe(2);
    expect(await video.evaluate((v) => v.getBoundingClientRect().width)).toBeLessThanOrEqual(390);
    await autorizado.pagina.setViewportSize({ width: 1280, height: 800 });
    await video.evaluate(async (v: HTMLVideoElement) => {
      v.muted = true;
      await v.play();
    });
    await expect(
      autorizado.pagina.getByRole('button', { name: 'Desmarcar lección Tutoría del grupo A' }),
    ).toBeVisible();
    await iniciarSesionPorUI(excluido.pagina, b.correo);
    await excluido.pagina.goto(`/aprender/${curso}/${id}`);
    await expect(excluido.pagina.getByRole('link', { name: /Bienvenida general/ })).toBeVisible();
    await expect(excluido.pagina.getByText('Tutoría del grupo A')).toHaveCount(0);
    await page.goto(`/docente/estudiantes?curso=${curso}`);
    await grupos.getByRole('combobox').selectOption({ label: 'Grupo A (1)' });
    await grupos.getByRole('checkbox', { name: /Integrante del taller/ }).uncheck();
    await grupos.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(grupos.getByRole('option', { name: 'Grupo A (0)' })).toBeAttached();
    const lectura = await autorizado.pagina.request.get(`/api/lecciones/${id}/video`, {
      headers: { Range: 'bytes=0-15' },
    });
    expect(lectura.status()).toBe(404);
  } finally {
    await autorizado.contexto.close();
    await excluido.contexto.close();
  }
});
