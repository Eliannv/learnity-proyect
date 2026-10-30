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
