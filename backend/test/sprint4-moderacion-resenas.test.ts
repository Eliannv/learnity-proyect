import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

// Lote 6 del panel de administración (migración 036): ocultación propia de las reseñas, corrección de la
// republicación de una reseña ocultada, ocultar y restaurar desde «Todas», retirar la respuesta del docente
// y filtros por curso, estrellas y texto.

const marca = crearMarca('s4_mod');
const pdfDir = carpetaPdfPropia();
let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let admin: Cuenta;
let ana: Cuenta;
let beto: Cuenta;
let caro: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let cursoId = 0;
let otroCursoId = 0;
let resenaAna = 0;
let resenaBeto = 0;
let resenaCaro = 0;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  ana = await cuentas.crearCuenta(['ESTUDIANTE']);
  beto = await cuentas.crearCuenta(['ESTUDIANTE']);
  caro = await cuentas.crearCuenta(['ESTUDIANTE']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
  for (const destino of ['principal', 'otro'] as const) {
    const curso = await c.cursoCompleto(docente);
    await c.enviarARevision(docente, curso.idCurso);
    const aprobado = await c.como(admin, 'PUT', `/api/admin/cursos/${curso.idCurso}/revision`, { decision: 'APROBAR' });
    assert.equal(aprobado.status, 200, aprobado.texto);
    if (destino === 'principal') cursoId = curso.idCurso;
    else otroCursoId = curso.idCurso;
  }
  for (const quien of [ana, beto]) {
    assert.equal((await c.como(quien, 'POST', `/api/cursos/${cursoId}/inscripcion`)).status, 201);
  }
  assert.equal((await c.como(caro, 'POST', `/api/cursos/${otroCursoId}/inscripcion`)).status, 201);

  const publicar = async (quien: Cuenta, curso: number, estrellas: number, comentario: string) => {
    const r = await c.como(quien, 'PUT', `/api/cursos/${curso}/resena`, { estrellas, comentario });
    assert.equal(r.status, 200, r.texto);
    return r.json.id as number;
  };
  resenaAna = await publicar(ana, cursoId, 5, `Excelente curso ${marca} con ejemplos al 100%.`);
  resenaBeto = await publicar(beto, cursoId, 1, `Contenido ofensivo ${marca}.`);
  resenaCaro = await publicar(caro, otroCursoId, 4, `Muy útil ${marca}.`);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

const totalPublico = async (curso: number) => (await srv.pedir(`/api/cursos/${curso}/resenas`)).json.resumen.total;
const ocultacion = (id: number) => `/api/admin/resenas/${id}/ocultacion`;
const acciones = (historial: { accion: string }[]) => historial.map((h) => h.accion);

describe('Lote 6 · el estudiante no puede deshacer la ocultación', () => {
  it('ocultada por un reporte: no puede editarla, republicarla ni borrarla y republicarla', async () => {
    const reporte = await c.como(docente, 'POST', `/api/docente/resenas/${resenaBeto}/reporte`, { motivo: 'OFENSIVO' });
    assert.equal(reporte.status, 201, reporte.texto);
    const pendiente = (await c.como(admin, 'GET', '/api/admin/resenas/reportes')).json
      .find((x: { resena: { id: number } }) => x.resena.id === resenaBeto);
    assert.equal((await c.como(admin, 'PUT', `/api/admin/resenas/reportes/${pendiente.id}`, { decision: 'OCULTAR' })).status, 204);
    assert.equal(await totalPublico(cursoId), 1);

    const mia = await c.como(beto, 'GET', `/api/cursos/${cursoId}/resena`);
    assert.deepEqual(mia.json, { puedeResenar: false, resena: null, ocultada: true }, 'el estudiante no ve el motivo');

    const editar = await c.como(beto, 'PUT', `/api/cursos/${cursoId}/resena`, { estrellas: 5, comentario: 'Cambié de opinión.' });
    assert.equal(editar.status, 409, editar.texto);
    assert.equal(editar.json.error.codigo, 'RESENA_OCULTADA');

    // El hueco de la Fase 1: borrar y volver a publicar dejaba eliminado_en = NULL y la reseña volvía al curso.
    const borrar = await c.como(beto, 'DELETE', `/api/cursos/${cursoId}/resena`);
    assert.equal(borrar.status, 204, borrar.texto);
    const republicar = await c.como(beto, 'PUT', `/api/cursos/${cursoId}/resena`, { estrellas: 5, comentario: null });
    assert.equal(republicar.status, 409);
    assert.equal(await totalPublico(cursoId), 1, 'sigue sin verse en el curso');

    const ocultas = await c.como(admin, 'GET', `/api/admin/resenas?estado=ocultadas&curso=${cursoId}`);
    const deBeto = ocultas.json.items.find((r: { id: number }) => r.id === resenaBeto);
    assert.ok(deBeto.ocultacion, 'sigue oculta');
    assert.equal(deBeto.estrellas, 1, 'los intentos rechazados no cambiaron la reseña');
  });

  it('la reseña ocultada no cuenta para el docente ni en el seguimiento', async () => {
    const bandeja = await c.como(docente, 'GET', `/api/docente/resenas?curso=${cursoId}`);
    assert.deepEqual(bandeja.json.items.map((r: { id: number }) => r.id), [resenaAna]);
    assert.equal(bandeja.json.resumen.total, 1);
    const seguimiento = await c.como(docente, 'GET', `/api/docente/cursos/${cursoId}/estudiantes`);
    assert.equal(seguimiento.status, 200, seguimiento.texto);
    assert.deepEqual(seguimiento.json.resumen.valoracion, { promedio: 5, total: 1 });
    const detalle = await srv.pedir(`/api/cursos/${cursoId}`);
    assert.equal(detalle.json.calificacion.total, 1);
    const lista = await srv.pedir(`/api/cursos?q=${encodeURIComponent(detalle.json.titulo)}`);
    const item = lista.json.items.find((x: { id: number }) => x.id === cursoId);
    assert.equal(item.calificacion.total, 1, 'la reseña ocultada tampoco cuenta en el catálogo');
  });
});

describe('Lote 6 · ocultar y restaurar desde «Todas las reseñas»', () => {
  it('oculta sin reporte previo, con motivo, actor e historial; sus reportes pendientes quedan resueltos', async () => {
    assert.equal((await c.como(docente, 'POST', ocultacion(resenaCaro), { motivo: 'Spam' })).status, 403);
    assert.equal((await c.como(admin, 'POST', ocultacion(resenaCaro), { motivo: '   ' })).status, 400);
    assert.equal((await c.como(admin, 'POST', ocultacion(resenaCaro), { motivo: 'x'.repeat(301) })).status, 400);
    assert.equal((await c.como(admin, 'POST', ocultacion(2_147_483_000), { motivo: 'Spam' })).status, 404);

    const reporte = await c.como(docente, 'POST', `/api/docente/resenas/${resenaCaro}/reporte`, { motivo: 'SPAM' });
    assert.equal(reporte.status, 201, reporte.texto);

    const r = await c.como(admin, 'POST', ocultacion(resenaCaro), { motivo: 'Publicidad de otra plataforma.' });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.ocultacion.motivo, 'Publicidad de otra plataforma.');
    assert.equal(r.json.ocultacion.por.id, admin.idPersona);
    assert.equal(r.json.reportesPendientes, 0, 'el reporte pendiente quedó resuelto');
    assert.deepEqual(acciones(r.json.historial), ['CREADA', 'OCULTADA']);
    assert.equal(r.json.historial[1].actor.id, admin.idPersona);
    assert.equal(r.json.historial[1].motivo, 'Publicidad de otra plataforma.');
    assert.equal(await totalPublico(otroCursoId), 0);

    const ocultados = await c.como(admin, 'GET', '/api/admin/resenas/reportes?estado=OCULTADA');
    assert.ok(ocultados.json.some((x: { resena: { id: number } }) => x.resena.id === resenaCaro));

    const otraVez = await c.como(admin, 'POST', ocultacion(resenaCaro), { motivo: 'Otra vez.' });
    assert.equal(otraVez.status, 409);
    assert.equal(otraVez.json.error.codigo, 'RESENA_YA_OCULTADA');

    const auditoria = await f.query<{ actor: number }>(
      `SELECT id_persona_actor AS actor FROM auditoria_cambio
        WHERE tabla = 'resena' AND (despues ->> 'id_resena')::int = $1 AND 'ocultada_en' = ANY (columnas_cambiadas)`,
      [resenaCaro]);
    assert.deepEqual(auditoria.rows.map((x) => x.actor), [admin.idPersona]);
  });

  it('restaura la reseña: vuelve al curso, queda en el historial y el estudiante puede editarla', async () => {
    assert.equal((await c.como(docente, 'DELETE', ocultacion(resenaCaro))).status, 403);
    const r = await c.como(admin, 'DELETE', ocultacion(resenaCaro));
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.ocultacion, null);
    assert.deepEqual(acciones(r.json.historial), ['CREADA', 'OCULTADA', 'RESTAURADA']);
    assert.equal(await totalPublico(otroCursoId), 1);

    const otraVez = await c.como(admin, 'DELETE', ocultacion(resenaCaro));
    assert.equal(otraVez.status, 409);
    assert.equal(otraVez.json.error.codigo, 'RESENA_NO_OCULTADA');

    const mia = await c.como(caro, 'GET', `/api/cursos/${otroCursoId}/resena`);
    assert.equal(mia.json.ocultada, false);
    assert.equal(mia.json.resena.id, resenaCaro);
    const editada = await c.como(caro, 'PUT', `/api/cursos/${otroCursoId}/resena`, { estrellas: 3, comentario: `Bien ${marca}.` });
    assert.equal(editada.status, 200, editada.texto);
  });
});

describe('Lote 6 · retirar la respuesta del docente', () => {
  it('el administrador la retira con su autoría; el docente que retira la suya sigue como antes', async () => {
    const ruta = `/api/admin/resenas/${resenaAna}/respuesta`;
    const sinRespuesta = await c.como(admin, 'DELETE', ruta);
    assert.equal(sinRespuesta.status, 409);
    assert.equal(sinRespuesta.json.error.codigo, 'SIN_RESPUESTA');

    const responder = (texto: string) =>
      c.como(docente, 'PUT', `/api/docente/resenas/${resenaAna}/respuesta`, { texto });
    assert.equal((await responder('Gracias, con contenido inapropiado.')).status, 200);
    assert.equal((await c.como(docente, 'DELETE', ruta)).status, 403);

    const r = await c.como(admin, 'DELETE', ruta);
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.respuesta, null);
    assert.equal(r.json.historial.at(-1).accion, 'RESPUESTA_RETIRADA');
    assert.equal(r.json.historial.at(-1).actor.id, admin.idPersona);
    const publica = (await srv.pedir(`/api/cursos/${cursoId}/resenas`)).json.items
      .find((x: { id: number }) => x.id === resenaAna);
    assert.equal(publica.respuesta, null);

    assert.equal((await responder('Gracias por tu reseña.')).status, 200);
    assert.equal((await c.como(docente, 'DELETE', `/api/docente/resenas/${resenaAna}/respuesta`)).status, 200);
    const historial = (await c.como(admin, 'GET', `/api/admin/resenas/${resenaAna}/historial`)).json;
    assert.deepEqual(acciones(historial).slice(-2), ['RESPONDIDA_POR_DOCENTE', 'RESPONDIDA_POR_DOCENTE'],
      'si la retira el propio docente no es una retirada de moderación');
    assert.equal((await responder('Gracias por los ejemplos.')).status, 200);
  });
});

describe('Lote 6 · filtros de «Todas las reseñas»', () => {
  const ids = async (consulta: string) => {
    const r = await c.como(admin, 'GET', `/api/admin/resenas?limite=50&${consulta}`);
    assert.equal(r.status, 200, r.texto);
    return r.json.items.map((x: { id: number }) => x.id).sort((a: number, b: number) => a - b);
  };

  it('por curso, estrellas, estado y texto en el comentario o la respuesta, sin distinguir mayúsculas', async () => {
    const q = encodeURIComponent(marca.toUpperCase());
    assert.deepEqual(await ids(`q=${q}`), [resenaAna, resenaBeto, resenaCaro].sort((a, b) => a - b));
    assert.deepEqual(await ids(`q=${q}&curso=${cursoId}`), [resenaAna, resenaBeto].sort((a, b) => a - b));
    assert.deepEqual(await ids(`q=${q}&estrellas=1`), [resenaBeto]);
    assert.deepEqual(await ids(`q=${q}&estado=ocultadas`), [resenaBeto]);
    assert.deepEqual(await ids(`q=${q}&estado=vigentes`), [resenaAna, resenaCaro].sort((a, b) => a - b));
    assert.deepEqual(await ids(`curso=${cursoId}&q=${encodeURIComponent('GRACIAS POR LOS EJEMPLOS')}`), [resenaAna],
      'busca también en la respuesta del docente');
  });

  it('los comodines se buscan como texto y la respuesta trae los cursos con reseñas', async () => {
    assert.deepEqual(await ids(`curso=${cursoId}&q=${encodeURIComponent('100%')}`), [resenaAna]);
    assert.deepEqual(await ids(`curso=${cursoId}&q=${encodeURIComponent('%%%')}`), []);
    assert.deepEqual(await ids(`curso=${cursoId}&q=${encodeURIComponent('Excelente_curso')}`), [],
      'sin escapar, «_» encontraría «Excelente curso»');
    const r = await c.como(admin, 'GET', `/api/admin/resenas?curso=${cursoId}`);
    const cursos = r.json.cursos.map((x: { id: number }) => x.id);
    assert.ok(cursos.includes(cursoId) && cursos.includes(otroCursoId));
    assert.equal((await c.como(admin, 'GET', `/api/admin/resenas?q=${'a'.repeat(101)}`)).status, 400);
    assert.equal((await c.como(admin, 'GET', '/api/admin/resenas?estrellas=6')).status, 400);
    assert.equal((await c.como(admin, 'GET', '/api/admin/resenas?curso=abc')).status, 400);
  });
});
