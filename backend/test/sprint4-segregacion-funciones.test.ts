import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

// Segregación de funciones: una cuenta ESTUDIANTE + DOCENTE + ADMIN no juzga sus propios cursos, no modera las
// reseñas de sus cursos ni las que escribió, y no revoca su propia solicitud. Otro administrador sí puede.

const marca = crearMarca('s4_sod');
const pdfDir = carpetaPdfPropia();
const MOTIVO_SOLICITUD = 'Enseño programación web desde hace años y quiero publicar cursos prácticos aquí.';
const NO_CURSO = 'No puedes revisar ni cambiar el estado administrativo de tu propio curso. Otro administrador debe hacerlo.';
const NO_RESENA = 'No puedes moderar reseñas de tus propios cursos ni tus propias reseñas. Otro administrador debe hacerlo.';
let f: Fixtures;
let srv: Servidor;
let jefe: Cuenta;
let otroAdmin: Cuenta;
let docente: Cuenta;
let alumna: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let idSolicitud = 0;
let cursoPropio = 0;
let resenaEnPropio = 0;
let resenaDelJefe = 0;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  otroAdmin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  alumna = await cuentas.crearCuenta(['ESTUDIANTE']);
  jefe = await cuentas.crearCuenta(['ESTUDIANTE']);

  // El jefe llega a docente por una solicitud aprobada por otro administrador y luego recibe el rol ADMIN.
  const s = await srv.pedir('/api/solicitudes-docente', {
    metodo: 'POST', token: jefe.token, cuerpo: { especialidad: 'Programación web', motivo: MOTIVO_SOLICITUD } });
  assert.equal(s.status, 201, s.texto);
  idSolicitud = s.json.id;
  const ok = await srv.pedir(`/api/admin/solicitudes/${idSolicitud}`, {
    metodo: 'PUT', token: otroAdmin.token, cuerpo: { decision: 'APROBAR' } });
  assert.equal(ok.status, 200, ok.texto);
  await f.query(
    `INSERT INTO usuario_rol (id_usuario, id_rol, asignado_por) SELECT $1, id_rol, $2 FROM rol WHERE nombre = 'ADMIN'`,
    [jefe.idUsuario, otroAdmin.idPersona],
  );

  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, otroAdmin.idPersona]);
  c = fabricaCursos(srv, marca, () => rows[0]!.id);

  const propio = await c.cursoCompleto(jefe);
  await c.enviarARevision(jefe, propio.idCurso);
  cursoPropio = propio.idCurso;

  // Un curso ajeno (de otro docente) en el que el jefe, como estudiante, deja su propia reseña.
  const ajeno = await c.cursoCompleto(docente);
  await c.enviarARevision(docente, ajeno.idCurso);
  assert.equal((await c.como(otroAdmin, 'PUT', `/api/admin/cursos/${ajeno.idCurso}/revision`, { decision: 'APROBAR' })).status, 200);
  assert.equal((await c.como(jefe, 'POST', `/api/cursos/${ajeno.idCurso}/inscripcion`)).status, 201);
  resenaDelJefe = (await c.como(jefe, 'PUT', `/api/cursos/${ajeno.idCurso}/resena`, { estrellas: 5, comentario: `Mía ${marca}.` })).json.id;
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

const prohibido = (r: { status: number; texto: string; json: { error?: { mensaje: string } } }, mensaje: string) => {
  assert.equal(r.status, 403, r.texto);
  assert.equal(r.json.error!.mensaje, mensaje);
};

describe('Segregación de funciones · cursos propios', () => {
  it('no aprueba ni rechaza su propio curso; el detalle de revisión lo marca como propio', async () => {
    prohibido(await c.como(jefe, 'PUT', `/api/admin/cursos/${cursoPropio}/revision`, { decision: 'APROBAR' }), NO_CURSO);
    prohibido(await c.como(jefe, 'PUT', `/api/admin/cursos/${cursoPropio}/revision`, { decision: 'RECHAZAR', motivo: 'No me gusta.' }), NO_CURSO);
    assert.equal((await c.como(jefe, 'GET', `/api/admin/cursos/${cursoPropio}`)).json.propio, true);
    assert.equal((await c.como(otroAdmin, 'GET', `/api/admin/cursos/${cursoPropio}`)).json.propio, false);

    const aprobado = await c.como(otroAdmin, 'PUT', `/api/admin/cursos/${cursoPropio}/revision`, { decision: 'APROBAR' });
    assert.equal(aprobado.status, 200, aprobado.texto);
  });

  it('no suspende ni reactiva su propio curso publicado', async () => {
    const cuerpo = { motivo: 'Contenido inapropiado en el módulo 1.', confirmo: true };
    prohibido(await c.como(jefe, 'POST', `/api/admin/cursos/${cursoPropio}/suspension`, cuerpo), NO_CURSO);
    assert.equal((await c.como(otroAdmin, 'POST', `/api/admin/cursos/${cursoPropio}/suspension`, cuerpo)).status, 200);
    prohibido(await c.como(jefe, 'DELETE', `/api/admin/cursos/${cursoPropio}/suspension`), NO_CURSO);
    assert.equal((await c.como(otroAdmin, 'DELETE', `/api/admin/cursos/${cursoPropio}/suspension`)).status, 200);
  });
});

describe('Segregación de funciones · reseñas', () => {
  before(async () => {
    assert.equal((await c.como(alumna, 'POST', `/api/cursos/${cursoPropio}/inscripcion`)).status, 201);
    const r = await c.como(alumna, 'PUT', `/api/cursos/${cursoPropio}/resena`, { estrellas: 1, comentario: `Malo ${marca}.` });
    assert.equal(r.status, 200, r.texto);
    resenaEnPropio = r.json.id;
  });

  it('no oculta, restaura ni retira la respuesta en reseñas de su curso; las ve marcadas como propias', async () => {
    const motivo = { motivo: 'Lenguaje ofensivo hacia el docente.' };
    prohibido(await c.como(jefe, 'POST', `/api/admin/resenas/${resenaEnPropio}/ocultacion`, motivo), NO_RESENA);
    assert.equal((await c.como(jefe, 'PUT', `/api/docente/resenas/${resenaEnPropio}/respuesta`, { texto: 'Gracias.' })).status, 200);
    prohibido(await c.como(jefe, 'DELETE', `/api/admin/resenas/${resenaEnPropio}/respuesta`), NO_RESENA);

    const lista = await c.como(jefe, 'GET', `/api/admin/resenas?curso=${cursoPropio}`);
    assert.equal(lista.json.items.find((x: { id: number }) => x.id === resenaEnPropio).propia, true);
    const ajena = await c.como(otroAdmin, 'GET', `/api/admin/resenas?curso=${cursoPropio}`);
    assert.equal(ajena.json.items.find((x: { id: number }) => x.id === resenaEnPropio).propia, false);

    assert.equal((await c.como(otroAdmin, 'POST', `/api/admin/resenas/${resenaEnPropio}/ocultacion`, motivo)).status, 200);
    prohibido(await c.como(jefe, 'DELETE', `/api/admin/resenas/${resenaEnPropio}/ocultacion`), NO_RESENA);
    assert.equal((await c.como(otroAdmin, 'DELETE', `/api/admin/resenas/${resenaEnPropio}/ocultacion`)).status, 200);
  });

  it('no resuelve un reporte sobre una reseña de su curso', async () => {
    const reporte = await c.como(jefe, 'POST', `/api/docente/resenas/${resenaEnPropio}/reporte`, { motivo: 'OFENSIVO' });
    assert.equal(reporte.status, 201, reporte.texto);
    const pendiente = (await c.como(jefe, 'GET', '/api/admin/resenas/reportes')).json
      .find((x: { resena: { id: number } }) => x.resena.id === resenaEnPropio);
    assert.equal(pendiente.propia, true);
    prohibido(await c.como(jefe, 'PUT', `/api/admin/resenas/reportes/${pendiente.id}`, { decision: 'DESESTIMAR' }), NO_RESENA);
    prohibido(await c.como(jefe, 'PUT', `/api/admin/resenas/reportes/${pendiente.id}`, { decision: 'OCULTAR' }), NO_RESENA);
    assert.equal((await c.como(otroAdmin, 'PUT', `/api/admin/resenas/reportes/${pendiente.id}`, { decision: 'DESESTIMAR' })).status, 204);
  });

  it('no modera la reseña que escribió como estudiante en un curso ajeno', async () => {
    prohibido(await c.como(jefe, 'POST', `/api/admin/resenas/${resenaDelJefe}/ocultacion`, { motivo: 'Me arrepentí de publicarla.' }), NO_RESENA);
  });
});

describe('Segregación de funciones · solicitudes', () => {
  it('no revoca su propia solicitud aprobada', async () => {
    const r = await srv.pedir(`/api/admin/solicitudes/${idSolicitud}/revocacion`, {
      metodo: 'POST', token: jefe.token, cuerpo: { motivo: 'Quiero dejar de ser docente por un tiempo.' } });
    prohibido(r, 'No puedes revocar tu propia solicitud.');
  });
});
