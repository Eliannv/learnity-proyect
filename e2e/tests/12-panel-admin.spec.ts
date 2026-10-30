import AxeBuilder from '@axe-core/playwright';
import { test, expect, request, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { conFixtures, CONTRASENA_PRUEBA, crearCuenta, MARCA } from '../soporte/bd';
import { CONTRASENA_UI, DIR_BUZON, RAIZ_TMP, URL_API, URL_WEB } from '../soporte/entorno';
import { correoNuevo, iniciarSesionPorUI, otroContexto } from '../soporte/ui';

// Panel de administración (Sprint 4): accesos, cuentas bloqueadas, alta por invitación y ficha de la cuenta.

async function revisarAccesibilidad(pagina: Page): Promise<void> {
  const axe = await new AxeBuilder({ page: pagina as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('iframe').analyze();
  const violaciones = axe.violations.map((v) => `${v.id} · ${v.nodes[0]?.target.join(' ')} · ${v.help}`);
  expect(violaciones, violaciones.join('\n')).toEqual([]);
}

const captura = (pagina: Page, nombre: string) =>
  pagina.screenshot({ path: path.join(RAIZ_TMP, 'capturas', `${nombre}.png`), fullPage: true });

test('el administrador ve los accesos fallidos y desbloquea una cuenta bloqueada', async ({ page }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-accesos');
  const ana = await crearCuenta(['ESTUDIANTE'], 'ana-bloqueo');

  // Cinco contraseñas incorrectas seguidas bloquean la cuenta 15 minutos.
  const api = await request.newContext({ baseURL: URL_API, extraHTTPHeaders: { Origin: URL_WEB } });
  for (let i = 0; i < 5; i++) {
    const r = await api.post('/api/auth/login', { data: { correo: ana.correo, contrasena: 'clave-equivocada-123' } });
    expect(r.status()).toBe(401);
  }
  await api.dispose();

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/accesos');
  await expect(page.getByRole('heading', { name: 'Accesos', level: 1 })).toBeVisible();

  const bloqueadas = page.locator('section.bloqueadas');
  await expect(bloqueadas.getByText(ana.correo)).toBeVisible();
  await expect(bloqueadas.getByText('5 intentos')).toBeVisible();

  await page.getByRole('tab', { name: 'Solo fallidos' }).click();
  await page.getByLabel('Buscar por correo o nombre').fill(ana.correo);
  const filas = page.locator('table.tabla tbody tr');
  await expect(filas).toHaveCount(5);
  await expect(filas.first()).toContainText('Contraseña incorrecta');
  await expect(filas.first()).toContainText('Fallo');
  await revisarAccesibilidad(page);
  await captura(page, 'admin-accesos');

  await bloqueadas.getByRole('button', { name: /Desbloquear la cuenta de/ }).click();
  await expect(page.getByText(/desbloqueada\. Ya puede iniciar sesión\./)).toBeVisible();
  await expect(bloqueadas.getByText('Ninguna cuenta está bloqueada')).toBeVisible();

  // Con la cuenta desbloqueada, Ana entra con su contraseña y el acceso aparece como éxito.
  const ctx = await request.newContext({ baseURL: URL_API, extraHTTPHeaders: { Origin: URL_WEB } });
  expect((await ctx.post('/api/auth/login', { data: { correo: ana.correo, contrasena: CONTRASENA_PRUEBA } })).status()).toBe(200);
  await ctx.dispose();
  await page.getByRole('tab', { name: 'Todos' }).click();
  await expect(filas.first()).toContainText('Éxito');
});

interface CorreoBuzon { para: string; asunto: string; texto: string }
const correosPara = (destino: string): CorreoBuzon[] => readdirSync(DIR_BUZON)
  .filter((n) => n.endsWith('.json'))
  .map((n) => JSON.parse(readFileSync(path.join(DIR_BUZON, n), 'utf8')) as CorreoBuzon)
  .filter((c) => c.para === destino);

test('el administrador crea una cuenta por invitación, revisa su ficha y cierra sus sesiones', async ({ page, context }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-alta');
  const correo = correoNuevo('invitada');

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/usuarios');
  await page.getByRole('button', { name: 'Crear usuario' }).click();
  const modal = page.getByRole('dialog', { name: 'Crear usuario' });
  await modal.getByLabel('Nombres').fill(MARCA);
  await modal.getByLabel('Apellidos').fill('Invitada');
  await modal.getByLabel('Correo').fill(correo);
  await modal.getByText('Docente', { exact: true }).click();
  await modal.getByLabel('Especialidad del docente').fill('Matemáticas');
  await revisarAccesibilidad(page);
  await modal.getByRole('button', { name: 'Crear y enviar invitación' }).click();
  await expect(page.getByText(`Le enviamos la invitación a ${correo}`)).toBeVisible();

  // La persona abre el enlace del correo, crea su contraseña y entra.
  await expect.poll(() => correosPara(correo).length, { timeout: 15_000 }).toBeGreaterThan(0);
  const enlace = correosPara(correo)[0]!.texto.match(/https?:\/\/\S+#token=\S+&invitacion=1/)?.[0];
  expect(enlace, 'el correo trae el enlace de invitación').toBeTruthy();
  const { contexto, pagina } = await otroContexto(context);
  await pagina.goto(enlace!);
  await expect(pagina.getByRole('heading', { name: 'Crea tu contraseña' })).toBeVisible();
  await pagina.getByLabel('Nueva contraseña').fill(CONTRASENA_UI);
  await pagina.getByLabel('Confirmar contraseña').fill(CONTRASENA_UI);
  await pagina.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(pagina.getByRole('status')).toBeVisible();
  await iniciarSesionPorUI(pagina, correo, CONTRASENA_UI);

  // Su ficha muestra la sesión abierta; el administrador la cierra.
  await page.getByLabel('Buscar por nombre o correo').fill(correo);
  await page.getByRole('button', { name: `Ver la ficha de ${MARCA} Invitada` }).click();
  const ficha = page.getByRole('dialog', { name: `Ficha de ${MARCA} Invitada` });
  await expect(ficha.getByText('Sesiones abiertas (1)')).toBeVisible();
  await expect(ficha.getByText('Matemáticas')).toBeVisible();
  await revisarAccesibilidad(page);
  await captura(page, 'admin-ficha-usuario');
  await ficha.getByRole('button', { name: 'Cerrar todas las sesiones' }).click();
  await page.getByRole('dialog', { name: /Cerrar las sesiones de/ }).getByRole('button', { name: 'Cerrar sesiones' }).click();
  await expect(ficha.getByText('Sesiones abiertas (0)')).toBeVisible();

  // En su navegador, la siguiente navegación ya no tiene sesión.
  await pagina.goto('/perfil');
  await expect(pagina).toHaveURL(/\/login/);
  await contexto.close();
});

test('el administrador revoca el rol docente de una solicitud aprobada y la persona ve el motivo', async ({ page, context }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-revoca');
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente-revocado');
  // Apellido propio: las cuentas de prueba llevan sus roles como apellidos y otras specs también aprueban solicitudes.
  await conFixtures(async (f) => {
    await f.query("UPDATE persona SET apellidos = 'Revocado' WHERE id_persona = $1", [docente.idPersona]);
    await f.query(
      `INSERT INTO solicitud_docente (id_persona, especialidad, motivo, estado, revisada_por, revisada_en)
       VALUES ($1, 'Programación web', $2, 'APROBADA', $3, now())`,
      [docente.idPersona, 'Quiero enseñar programación web a estudiantes que empiezan desde cero en la carrera.', admin.idPersona]);
  });

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/solicitudes');
  await page.getByRole('tab', { name: 'Aprobadas' }).click();
  await page.getByRole('button', { name: new RegExp(`${MARCA} Revocado`) }).click();
  await page.getByRole('button', { name: 'Revocar rol docente' }).click();
  const modal = page.getByRole('dialog', { name: /¿Revocar el rol docente de/ });
  await expect(modal.getByText('No tiene cursos publicados.')).toBeVisible();
  await modal.getByLabel(/Motivo/).fill('Publicó material que infringe derechos de autor.');
  await revisarAccesibilidad(page);
  await modal.getByRole('button', { name: 'Revocar rol docente' }).click();
  await expect(page.getByText(/ya no es docente\./)).toBeVisible();
  await page.getByRole('tab', { name: 'Revocadas' }).click();
  await expect(page.getByText('Motivo: Publicó material que infringe derechos de autor.')).toBeVisible();

  const { contexto, pagina } = await otroContexto(context);
  await iniciarSesionPorUI(pagina, docente.correo);
  await pagina.goto('/perfil');
  await expect(pagina.getByText('Tu rol de docente fue retirado')).toBeVisible();
  await expect(pagina.getByText('Publicó material que infringe derechos de autor.')).toBeVisible();
  await contexto.close();
});

test('el administrador suspende un curso publicado y lo reactiva; la alumna inscrita ve el aviso (D2)', async ({ page, context }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-suspende');
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente-suspendido');
  const alumna = await crearCuenta(['ESTUDIANTE'], 'alumna-suspendido');
  const titulo = `${MARCA} Curso a suspender`;
  await conFixtures(async (f) => {
    const { rows: [cat] } = await f.query<{ id: number }>(
      'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [`${MARCA} Suspensión`, admin.idPersona]);
    const { rows: [curso] } = await f.query<{ id: number }>(
      `INSERT INTO curso (id_docente, id_categoria, titulo, estado, revisado_por, publicado_en)
       VALUES ($1, $2, $3, 'PUBLICADO', $4, now()) RETURNING id_curso AS id`,
      [docente.idDocente, cat!.id, titulo, admin.idPersona]);
    await f.query('INSERT INTO inscripcion (id_persona, id_curso, progreso_pct) VALUES ($1, $2, 30)', [alumna.idPersona, curso!.id]);
  });

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/revision');
  await page.getByRole('tab', { name: /Publicados/ }).click();
  await expect(page).toHaveURL(/estado=PUBLICADO/);
  const tarjeta = page.locator('li.tarjeta', { hasText: titulo });
  await expect(tarjeta.getByText('1 inscrito')).toBeVisible();
  await tarjeta.getByRole('link', { name: 'Ver curso' }).click();

  const suspender = page.getByRole('button', { name: 'Suspender curso' });
  await expect(suspender).toBeDisabled();
  await page.getByLabel(/Motivo de la suspensión/).fill('Contenido inapropiado en el módulo 1.');
  await page.getByLabel(/Confirmo/).check();
  await revisarAccesibilidad(page);
  await suspender.click();
  await expect(page.getByText(/Suspendido el .*Motivo: Contenido inapropiado en el módulo 1\./)).toBeVisible();
  await captura(page, 'admin-curso-suspendido');

  // La alumna conserva el curso en Mi aprendizaje, marcado y sin poder abrirlo.
  const { contexto, pagina } = await otroContexto(context);
  await iniciarSesionPorUI(pagina, alumna.correo);
  await pagina.goto('/mi-aprendizaje');
  const suya = pagina.locator('article.curso', { hasText: titulo });
  await expect(suya.getByText('Curso suspendido.')).toBeVisible();
  await expect(suya.getByRole('button')).toHaveCount(0);
  await expect(suya.getByText('30% completado')).toBeVisible();

  // Volver lleva a la pestaña de suspendidos; desde el detalle se reactiva.
  await page.getByRole('link', { name: '← Revisión de cursos' }).click();
  await expect(page).toHaveURL(/estado=SUSPENDIDO/);
  await page.locator('li.tarjeta', { hasText: titulo }).getByRole('link', { name: 'Ver curso' }).click();
  await page.getByRole('button', { name: 'Reactivar curso' }).click();
  await page.getByRole('dialog', { name: '¿Reactivar este curso?' }).getByRole('button', { name: 'Reactivar curso' }).click();
  await expect(page.getByText('Curso reactivado: vuelve a estar publicado.')).toBeVisible();

  await pagina.reload();
  await expect(pagina.locator('article.curso', { hasText: titulo }).getByRole('button', { name: /Continuar|Empezar/ })).toBeVisible();
  await contexto.close();
});

test('el administrador elige el ícono de una categoría y, al desactivarla, mueve sus cursos a otra', async ({ page }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-categorias');
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente-categorias');
  const origen = `${MARCA} Fotografía`;
  const destino = `${MARCA} Imagen`;
  const titulo = `${MARCA} Luz natural`;
  await conFixtures(async (f) => {
    const { rows: [o] } = await f.query<{ id: number }>(
      'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [origen, admin.idPersona]);
    await f.query('INSERT INTO categoria (nombre, creada_por, icono) VALUES ($1, $2, $3)', [destino, admin.idPersona, 'palette']);
    await f.query(
      `INSERT INTO curso (id_docente, id_categoria, titulo, estado, revisado_por, publicado_en)
       VALUES ($1, $2, $3, 'PUBLICADO', $4, now())`, [docente.idDocente, o!.id, titulo, admin.idPersona]);
  });

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/categorias');
  await page.getByRole('button', { name: `Editar ${origen}` }).click();
  const editar = page.getByRole('dialog', { name: 'Editar categoría' });
  // El selector es un grupo de radios: se recorre con las flechas del teclado.
  await editar.getByRole('radio', { name: 'Etiquetas (genérico)' }).focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight'); // de «tags» a «camera» (posición 13)
  await expect(editar.getByRole('radio', { name: 'Cámara' })).toBeChecked();
  await revisarAccesibilidad(page);
  await editar.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Categoría guardada.')).toBeVisible();

  // El catálogo público ya dibuja el ícono elegido en la portada del curso.
  await page.goto(`/cursos?q=${encodeURIComponent(titulo)}`);
  await expect(page.locator('app-tarjeta-curso', { hasText: titulo }).locator('lucide-icon svg.lucide-camera')).toBeVisible();

  await page.goto('/admin/categorias');
  await page.getByRole('button', { name: `Desactivar ${origen}` }).click();
  const desactivar = page.getByRole('dialog', { name: new RegExp(`Desactivar «${origen}»`) });
  await expect(desactivar.getByText('1 curso')).toBeVisible();
  await desactivar.getByText('Moverlos todos a otra categoría activa').click();
  await desactivar.getByLabel('Categoría de destino').selectOption({ label: destino });
  await revisarAccesibilidad(page);
  await desactivar.getByRole('button', { name: 'Mover cursos y desactivar' }).click();
  await expect(page.getByText(`«${origen}» desactivada. Su curso pasó a «${destino}».`)).toBeVisible();
  const fila = page.getByRole('row', { name: new RegExp(destino) });
  await expect(fila.getByRole('cell').nth(1)).toHaveText('1');
});

test('el administrador busca una reseña, la oculta con motivo, retira la respuesta y la restaura; la alumna no puede republicarla', async ({ page, context }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-resenas');
  const docente = await crearCuenta(['ESTUDIANTE', 'DOCENTE'], 'docente-resenas');
  const alumna = await crearCuenta(['ESTUDIANTE'], 'alumna-resenas');
  const comentario = `${MARCA} Visiten mi canal para aprender gratis.`;
  let cursoId = 0;
  await conFixtures(async (f) => {
    const { rows: [cat] } = await f.query<{ id: number }>(
      'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [`${MARCA} Moderación`, admin.idPersona]);
    const { rows: [curso] } = await f.query<{ id: number }>(
      `INSERT INTO curso (id_docente, id_categoria, titulo, estado, revisado_por, publicado_en)
       VALUES ($1, $2, $3, 'PUBLICADO', $4, now()) RETURNING id_curso AS id`,
      [docente.idDocente, cat!.id, `${MARCA} Curso con reseñas`, admin.idPersona]);
    cursoId = curso!.id;
    await f.query('INSERT INTO inscripcion (id_persona, id_curso) VALUES ($1, $2)', [alumna.idPersona, cursoId]);
  });
  // La reseña y la respuesta se crean por la API, como en la aplicación (las fixtures no escriben en resena).
  const ctx = await request.newContext({ baseURL: URL_API, extraHTTPHeaders: { Origin: URL_WEB } });
  const como = async (correo: string, metodo: string, ruta: string, datos: object) => {
    const login = await ctx.post('/api/auth/login', { data: { correo, contrasena: CONTRASENA_PRUEBA } });
    const token = (await login.json()).accessToken as string;
    const r = await ctx.fetch(ruta, { method: metodo, data: datos, headers: { Authorization: `Bearer ${token}` } });
    expect(r.ok(), await r.text()).toBeTruthy();
    return r.json();
  };
  const resena = await como(alumna.correo, 'PUT', `/api/cursos/${cursoId}/resena`, { estrellas: 2, comentario });
  await como(docente.correo, 'PUT', `/api/docente/resenas/${resena.id}/respuesta`, { texto: 'Respuesta con datos personales.' });
  await ctx.dispose();

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/resenas');
  await page.getByLabel('Buscar en comentarios y respuestas').fill(MARCA);
  const tarjeta = page.getByRole('article').filter({ hasText: comentario });
  await expect(page.getByText('1 reseña ·')).toBeVisible();
  await expect(tarjeta).toContainText('Publicada');

  await tarjeta.getByRole('button', { name: 'Ocultar reseña' }).click();
  const modal = page.getByRole('dialog', { name: 'Ocultar reseña' });
  await modal.getByLabel(/Motivo/).fill('Publicidad de un canal externo.');
  await revisarAccesibilidad(page);
  await modal.getByRole('button', { name: 'Ocultar reseña' }).click();
  await expect(page.getByText('Reseña ocultada. Ya no se ve en el curso.')).toBeVisible();
  await expect(tarjeta).toContainText('Motivo: Publicidad de un canal externo.');
  await captura(page, 'admin-resena-ocultada');

  // La alumna ve el aviso (sin el motivo interno) y ya no puede editarla ni volver a publicarla.
  const { contexto, pagina } = await otroContexto(context);
  await iniciarSesionPorUI(pagina, alumna.correo);
  await pagina.goto(`/cursos/${cursoId}`);
  const resenas = pagina.getByRole('region', { name: 'Reseñas de estudiantes' });
  await expect(resenas).toContainText('Tu reseña fue ocultada por moderación.');
  await expect(resenas).not.toContainText(comentario);
  await expect(resenas).not.toContainText('Publicidad de un canal externo.');
  await expect(resenas.getByRole('button', { name: /Editar|Escribir una reseña/ })).toHaveCount(0);

  await tarjeta.getByRole('button', { name: 'Retirar respuesta del docente' }).click();
  await page.getByRole('dialog', { name: '¿Retirar la respuesta del docente?' }).getByRole('button', { name: 'Retirar respuesta' }).click();
  await expect(page.getByText('Respuesta del docente retirada.')).toBeVisible();
  await expect(tarjeta).not.toContainText('Respuesta con datos personales.');

  await tarjeta.getByRole('button', { name: 'Restaurar reseña' }).click();
  await page.getByRole('dialog', { name: '¿Restaurar esta reseña?' }).getByRole('button', { name: 'Restaurar reseña' }).click();
  await expect(page.getByText('Reseña restaurada.')).toBeVisible();
  await tarjeta.getByText(/Historial completo/).click();
  await expect(tarjeta).toContainText('Ocultó la reseña');
  await expect(tarjeta).toContainText('Retiró la respuesta del docente');
  await expect(tarjeta).toContainText('Restauró la reseña');

  await pagina.reload();
  await expect(resenas).toContainText(comentario);
  await expect(resenas).not.toContainText('Respuesta con datos personales.');
  await expect(resenas.getByRole('button', { name: 'Editar' })).toBeVisible();
  await contexto.close();
});

test('el administrador revisa la auditoría con su diff y el estado de la base, y cierra sesiones (ajena y propia)', async ({ page, context }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-auditoria');
  const alumna = await crearCuenta(['ESTUDIANTE'], 'alumna-sesiones');
  const categoria = `${MARCA} Auditada`;

  // Un cambio con actor: el administrador crea y renombra una categoría por la API.
  const ctx = await request.newContext({ baseURL: URL_API, extraHTTPHeaders: { Origin: URL_WEB } });
  const login = await ctx.post('/api/auth/login', { data: { correo: admin.correo, contrasena: CONTRASENA_PRUEBA } });
  const token = (await login.json()).accessToken as string;
  const creada = await ctx.post('/api/admin/categorias', { data: { nombre: categoria }, headers: { Authorization: `Bearer ${token}` } });
  expect(creada.ok(), await creada.text()).toBeTruthy();
  const { id } = await creada.json();
  const editada = await ctx.put(`/api/admin/categorias/${id}`, {
    data: { nombre: `${categoria} 2`, descripcion: null, activa: true }, headers: { Authorization: `Bearer ${token}` },
  });
  expect(editada.ok(), await editada.text()).toBeTruthy();
  await ctx.dispose();

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin/auditoria');
  await page.getByLabel('Tabla').selectOption('categoria');
  await page.getByLabel('Operación').selectOption('UPDATE');
  const fila = page.getByRole('row').filter({ hasText: admin.correo }).filter({ hasText: String(id) }).first();
  await expect(fila).toContainText('learnity_app');
  await revisarAccesibilidad(page);
  await fila.getByRole('button', { name: /Ver el detalle/ }).click();
  const detalle = page.getByRole('dialog', { name: /^Cambio \d+ · categoria$/ });
  await expect(detalle.getByRole('heading', { name: 'Datos antes y después' })).toBeVisible();
  const nombre = detalle.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /nombre/ }) });
  await expect(nombre.locator('td.antes')).toContainText(`Valor anterior: ${categoria}`);
  await expect(nombre.locator('td.despues')).toContainText(`Valor nuevo: ${categoria} 2`);
  await revisarAccesibilidad(page);
  await captura(page, 'admin-auditoria-diff');
  await detalle.getByRole('button', { name: 'Cerrar' }).click();

  // Sesiones: la alumna tiene una abierta y el administrador la cierra.
  const { contexto, pagina } = await otroContexto(context);
  await iniciarSesionPorUI(pagina, alumna.correo);
  await page.goto('/admin/sesiones');
  await expect(page.getByText('PostgreSQL')).toBeVisible();
  await page.getByLabel('Buscar sesiones por nombre o correo').fill(alumna.correo);
  const deAlumna = page.getByRole('row').filter({ hasText: alumna.correo });
  await expect(deAlumna).toHaveCount(1);
  await revisarAccesibilidad(page);
  await deAlumna.getByRole('button', { name: /Cerrar la sesión de/ }).click();
  await page.getByRole('dialog', { name: '¿Cerrar esta sesión?' }).getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByText(/Sesión de .* cerrada\./)).toBeVisible();
  await pagina.goto('/mi-aprendizaje');
  await expect(pagina).toHaveURL(/\/login/);
  await contexto.close();

  // La propia se marca, avisa distinto y, al cerrarla, saca al administrador.
  await page.getByLabel('Buscar sesiones por nombre o correo').fill(admin.correo);
  const propia = page.getByRole('row').filter({ hasText: 'Tu sesión actual' });
  await expect(propia).toHaveCount(1);
  await propia.getByRole('button', { name: /Cerrar tu sesión actual/ }).click();
  await page.getByRole('dialog', { name: '¿Cerrar tu sesión actual?' }).getByRole('button', { name: 'Cerrar mi sesión' }).click();
  await expect(page).toHaveURL(/\/login|\/$/);
  await page.goto('/admin/sesiones');
  await expect(page).toHaveURL(/\/login/);
});

test('el administrador ejecuta el análisis de alertas, sigue la evidencia y marca una alerta como atendida', async ({ page }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-alertas');
  const alumna = await crearCuenta(['ESTUDIANTE'], 'alumna-alertas');
  const inicio = await conFixtures(async (f) => {
    const { rows: [ahora] } = await f.query<{ t: Date }>('SELECT now() AS t');
    for (let m = 10; m >= 1; m--) {
      await f.query(
        `INSERT INTO evento_acceso (id_usuario, correo, paso, exito, motivo, agente, ocurrido_en)
         VALUES ($1, $2, 'CLAVE', false, 'CLAVE_INCORRECTA', 'E2E/1.0', now() - make_interval(mins => $3))`,
        [alumna.idUsuario, alumna.correo, m]);
    }
    return ahora!.t;
  });

  try {
    await iniciarSesionPorUI(page, admin.correo);
    await page.goto('/admin/alertas');
    await page.getByRole('button', { name: 'Ejecutar análisis ahora' }).click();
    await expect(page.getByText(/Análisis completado/)).toBeVisible();
    // learnity_test acumula avisos de las demás suites: se filtra como lo haría el administrador.
    await page.getByLabel('Tipo').selectOption('INTENTOS_FALLIDOS');
    const alerta = page.getByRole('article').filter({ hasText: alumna.correo });
    await expect(alerta).toContainText('Alta');
    await expect(alerta).toContainText('Intentos fallidos de inicio de sesión');
    await revisarAccesibilidad(page);
    await captura(page, 'admin-alertas');

    // La evidencia lleva al registro de accesos ya filtrado por la cuenta.
    await alerta.getByRole('link', { name: /10 accesos fallidos en el registro/ }).click();
    await expect(page).toHaveURL(/\/admin\/accesos\?q=/);
    await expect(page.getByLabel('Buscar por correo o nombre')).toHaveValue(alumna.correo);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/alertas/);

    // Un cambio de privilegios enlaza a su registro en el visor de auditoría.
    await page.getByLabel('Tipo').selectOption('CAMBIO_PRIVILEGIOS');
    const rol = page.getByRole('article').filter({ hasText: 'Cambio de privilegios' }).first();
    await rol.getByRole('link', { name: /Ver el cambio \d+ en la auditoría/ }).first().click();
    await expect(page.getByRole('dialog', { name: /^Cambio \d+ · usuario_rol$/ })).toBeVisible();
    await page.goBack();

    await page.getByLabel('Tipo').selectOption('INTENTOS_FALLIDOS');
    await page.getByRole('article').filter({ hasText: alumna.correo }).getByRole('button', { name: 'Marcar atendida' }).click();
    const modal = page.getByRole('dialog', { name: 'Marcar alerta como atendida' });
    await modal.getByLabel(/Nota/).fill('Hablé con la alumna: olvidó su contraseña.');
    await revisarAccesibilidad(page);
    await modal.getByRole('button', { name: 'Marcar atendida' }).click();
    await expect(page.getByText('Alerta marcada como atendida.')).toBeVisible();
    await expect(page.getByRole('article').filter({ hasText: alumna.correo })).toHaveCount(0);
    await page.getByRole('tab', { name: /Todas/ }).click();
    await expect(page.getByRole('article').filter({ hasText: alumna.correo }))
      .toContainText('Nota: Hablé con la alumna: olvidó su contraseña.');
  } finally {
    await conFixtures((f) => f.query('DELETE FROM alerta_seguridad WHERE detectada_en >= $1', [inicio]));
  }
});

test('el panel abre en el Resumen con la atención rápida enlazada, y en el móvil «Más» lleva a todas las secciones', async ({ page }) => {
  const admin = await crearCuenta(['ESTUDIANTE', 'ADMIN'], 'admin-resumen');
  const aspirante = await crearCuenta(['ESTUDIANTE'], 'aspirante-resumen');
  await conFixtures((f) => f.query(
    `INSERT INTO solicitud_docente (id_persona, especialidad, motivo)
     VALUES ($1, 'Historia', 'Quiero enseñar historia universal con recursos visuales y lecturas guiadas para todos.')`,
    [aspirante.idPersona]));

  await iniciarSesionPorUI(page, admin.correo);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/resumen$/);
  await expect(page.getByRole('heading', { name: 'Resumen', level: 1 })).toBeVisible();
  const solicitudes = page.getByRole('link', { name: /^Solicitudes de docente: [1-9]\d* pendientes? de decidir/ });
  await expect(solicitudes).toHaveClass(/con-casos/);
  await expect(page.getByRole('heading', { name: 'Indicadores globales de la plataforma' })).toBeVisible();
  await revisarAccesibilidad(page);
  await captura(page, 'admin-resumen');
  await solicitudes.click();
  await expect(page).toHaveURL(/\/admin\/solicitudes/);

  // Teléfono: cuatro pestañas y «Más» con el resto de secciones del menú lateral.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/resumen');
  const barra = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(barra.getByRole('link')).toHaveText(['Resumen', 'Usuarios', 'Cursos', 'Alertas']);
  const mas = barra.getByRole('button', { name: 'Más' });
  await mas.click();
  await expect(mas).toHaveAttribute('aria-expanded', 'true');
  const panel = page.getByRole('navigation', { name: 'Más secciones' });
  await expect(panel.getByRole('link')).toHaveText(
    ['Mi perfil', 'Solicitudes de docente', 'Categorías', 'Reseñas', 'Accesos', 'Auditoría', 'Sesiones y base de datos']);
  await revisarAccesibilidad(page);
  await captura(page, 'admin-movil-mas');
  await panel.getByRole('link', { name: 'Auditoría' }).click();
  await expect(page).toHaveURL(/\/admin\/auditoria/);
  await expect(panel).toHaveCount(0);
  await expect(mas).toHaveClass(/activo/);
  await mas.click();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(mas).toBeFocused();
});
