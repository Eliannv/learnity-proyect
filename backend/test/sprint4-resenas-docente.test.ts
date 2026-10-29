import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

// Gestión de reseñas por el docente, moderación del administrador y analíticas (migración 031).

const marca = crearMarca('s4_rdoc');
const pdfDir = carpetaPdfPropia();
let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let otroDocente: Cuenta;
let admin: Cuenta;
let ana: Cuenta;
let beto: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let cursoId = 0;
let leccionId = 0;
let cursoAjeno = 0;
let resenaAna = 0;
let resenaBeto = 0;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  otroDocente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  ana = await cuentas.crearCuenta(['ESTUDIANTE']);
  beto = await cuentas.crearCuenta(['ESTUDIANTE']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
  for (const [cuenta, guardar] of [[docente, true], [otroDocente, false]] as const) {
    const curso = await c.cursoCompleto(cuenta);
    await c.enviarARevision(cuenta, curso.idCurso);
    const aprobado = await c.como(admin, 'PUT', `/api/admin/cursos/${curso.idCurso}/revision`, { decision: 'APROBAR' });
    assert.equal(aprobado.status, 200, aprobado.texto);
    if (guardar) {
      cursoId = curso.idCurso;
      leccionId = curso.idLeccion;
    } else {
      cursoAjeno = curso.idCurso;
    }
  }
  for (const quien of [ana, beto]) {
    assert.equal((await c.como(quien, 'POST', `/api/cursos/${cursoId}/inscripcion`)).status, 201);
  }
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

const miResena = (_cuenta: Cuenta) => `/api/cursos/${cursoId}/resena`;

describe('Sprint 4 · auditoría de reseñas (nivel A)', () => {
  it('guarda el avance al publicar y no lo cambia aunque el estudiante siga avanzando', async () => {
    const r = await c.como(ana, 'PUT', miResena(ana), { estrellas: 2, comentario: 'Le falta práctica.' });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.editado, false);
    assert.equal(r.json.respuesta, null);
    resenaAna = r.json.id;

    const avance = await c.como(ana, 'PUT', `/api/lecciones/${leccionId}/progreso`, { completada: true });
    assert.equal(avance.status, 200, avance.texto);
    assert.equal(avance.json.progresoPct, 100);

    const editada = await c.como(ana, 'PUT', miResena(ana), { estrellas: 4, comentario: 'Mejoró con los ejemplos.' });
    assert.equal(editada.json.id, resenaAna);
    assert.equal(editada.json.editado, true, 'cambiar estrellas o comentario la marca como editada');

    const bandeja = await c.como(docente, 'GET', '/api/docente/resenas');
    const vista = bandeja.json.items.find((i: { id: number }) => i.id === resenaAna);
    assert.equal(vista.progresoAlResenar, 0, 'el avance es el de la publicación, no el actual');
    assert.equal(vista.estrellasOriginales, 2);
    assert.equal(vista.estrellas, 4);
    assert.ok(vista.editadoEn);
  });

  it('borrar es lógico: deja de contar en el promedio, se conserva y al republicar empieza de nuevo', async () => {
    const r = await c.como(beto, 'PUT', miResena(beto), { estrellas: 1, comentario: 'No me gustó.' });
    resenaBeto = r.json.id;
    assert.equal((await srv.pedir(`/api/cursos/${cursoId}/resenas`)).json.resumen.total, 2);

    assert.equal((await c.como(beto, 'DELETE', miResena(beto))).status, 204);
    const lista = await srv.pedir(`/api/cursos/${cursoId}/resenas`);
    assert.deepEqual(lista.json.resumen, { promedio: 4, total: 1, distribucion: [0, 0, 0, 1, 0] });
    assert.equal((await srv.pedir(`/api/cursos/${cursoId}`)).json.calificacion.total, 1);
    assert.deepEqual((await c.como(beto, 'GET', miResena(beto))).json.resena, null);
    const historia = await c.como(admin, 'GET', `/api/admin/resenas/${resenaBeto}/historial`);
    assert.deepEqual(historia.json.map((h: { accion: string }) => h.accion), ['CREADA', 'ELIMINADA'],
      'la reseña se conserva para reportes y moderación');

    const otra = await c.como(beto, 'PUT', miResena(beto), { estrellas: 3, comentario: null });
    assert.equal(otra.json.id, resenaBeto, 'republicar reutiliza la fila de la inscripción');
    assert.equal(otra.json.editado, false, 'republicar no cuenta como edición');
  });

  it('la aplicación ya no puede borrar reseñas físicamente', async () => {
    const r = await f.query<{ puede: boolean }>(
      "SELECT has_table_privilege('learnity_app', 'resena', 'DELETE') AS puede");
    assert.equal(r.rows[0]?.puede, false);
  });
});

describe('Sprint 4 · bandeja del docente', () => {
  it('lista solo sus reseñas, con resumen, evolución y filtros', async () => {
    const todas = await c.como(docente, 'GET', '/api/docente/resenas');
    assert.equal(todas.status, 200, todas.texto);
    assert.deepEqual(todas.json.cursos.map((x: { id: number }) => x.id), [cursoId]);
    assert.equal(todas.json.total, 2);
    assert.equal(todas.json.resumen.sinResponder, 2);
    assert.equal(todas.json.evolucion.length, 1);
    assert.equal(todas.json.evolucion[0].promedioAcumulado, 3.5);

    const filtros: [string, number][] = [
      ['estrellas=4', 1], ['comentario=sin', 1], ['comentario=con', 1], ['respuesta=respondidas', 0],
      [`curso=${cursoId}&estrellas=3`, 1],
    ];
    for (const [consulta, esperado] of filtros) {
      const r = await c.como(docente, 'GET', `/api/docente/resenas?${consulta}`);
      assert.equal(r.json.total, esperado, consulta);
    }
    assert.equal((await c.como(docente, 'GET', `/api/docente/resenas?curso=${cursoAjeno}`)).status, 404);
    assert.equal((await c.como(docente, 'GET', '/api/docente/resenas?estrellas=9')).status, 400);
    assert.equal((await c.como(ana, 'GET', '/api/docente/resenas')).status, 403);
    assert.equal((await c.como(otroDocente, 'GET', '/api/docente/resenas')).json.total, 0);
  });

  it('responde públicamente; otro docente no puede tocar la reseña', async () => {
    const ruta = `/api/docente/resenas/${resenaAna}/respuesta`;
    assert.equal((await c.como(otroDocente, 'PUT', ruta, { texto: 'Hola' })).status, 404);
    assert.equal((await c.como(docente, 'PUT', ruta, { texto: '   ' })).status, 400);
    const r = await c.como(docente, 'PUT', ruta, { texto: '¡Gracias por la sugerencia!' });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.respuesta.texto, '¡Gracias por la sugerencia!');

    const publica = await srv.pedir(`/api/cursos/${cursoId}/resenas`);
    const conRespuesta = publica.json.items.find((i: { id: number }) => i.id === resenaAna);
    assert.equal(conRespuesta.respuesta.texto, '¡Gracias por la sugerencia!');
    assert.equal(conRespuesta.editado, true);
    assert.equal((await c.como(docente, 'GET', '/api/docente/resenas?respuesta=sin-responder')).json.total, 1);
  });

  it('reporta al administrador una sola vez mientras siga pendiente', async () => {
    const ruta = `/api/docente/resenas/${resenaBeto}/reporte`;
    assert.equal((await c.como(docente, 'POST', ruta, { motivo: 'INSULTO' })).status, 400);
    const r = await c.como(docente, 'POST', ruta, { motivo: 'OFENSIVO', detalle: 'Lenguaje inapropiado.' });
    assert.equal(r.status, 201, r.texto);
    assert.deepEqual(r.json.reporte, { estado: 'PENDIENTE', motivo: 'OFENSIVO' });
    const repetido = await c.como(docente, 'POST', ruta, { motivo: 'SPAM' });
    assert.equal(repetido.status, 409);
    assert.equal(repetido.json.error.codigo, 'REPORTE_PENDIENTE');
    assert.equal((await c.como(otroDocente, 'POST', ruta, { motivo: 'SPAM' })).status, 404);
  });

  it('la valoración global y «Mis cursos» cuentan solo reseñas vigentes', async () => {
    assert.deepEqual((await c.como(docente, 'GET', '/api/docente/valoracion')).json, { promedio: 3.5, total: 2 });
    const mis = await c.como(docente, 'GET', '/api/docente/cursos');
    const curso = mis.json.items.find((x: { id: number }) => x.id === cursoId);
    assert.equal(curso.estudiantes, 2);
    assert.deepEqual(curso.calificacion, { promedio: 3.5, total: 2 });
    const detalle = await srv.pedir(`/api/cursos/${cursoId}`);
    assert.deepEqual(detalle.json.instructor.calificacion, { promedio: 3.5, total: 2 });
  });
});

describe('Sprint 4 · moderación del administrador (nivel B)', () => {
  it('ve el reporte con el historial completo y su autor', async () => {
    assert.equal((await c.como(docente, 'GET', '/api/admin/resenas/reportes')).status, 403);
    const r = await c.como(admin, 'GET', '/api/admin/resenas/reportes');
    assert.equal(r.status, 200, r.texto);
    const reporte = r.json.find((x: { resena: { id: number } }) => x.resena.id === resenaBeto);
    assert.equal(reporte.motivo, 'OFENSIVO');
    assert.deepEqual(reporte.historial.map((h: { accion: string }) => h.accion), ['CREADA', 'ELIMINADA', 'REPUBLICADA']);
    assert.equal(reporte.historial[0].actor.id, beto.idPersona);
    assert.equal(reporte.historial[0].estrellasNueva, 1);

    const historial = await c.como(admin, 'GET', `/api/admin/resenas/${resenaAna}/historial`);
    assert.deepEqual(historial.json.map((h: { accion: string }) => h.accion), ['CREADA', 'EDITADA', 'RESPONDIDA_POR_DOCENTE']);
    assert.equal(historial.json[1].estrellasAnterior, 2);
    assert.equal(historial.json[1].estrellasNueva, 4);
    assert.equal(historial.json[2].actor.id, docente.idPersona);
  });

  it('ocultar la reseña la borra lógicamente; un reporte resuelto no se resuelve dos veces', async () => {
    const reporte = (await c.como(admin, 'GET', '/api/admin/resenas/reportes')).json
      .find((x: { resena: { id: number } }) => x.resena.id === resenaBeto);
    const ruta = `/api/admin/resenas/reportes/${reporte.id}`;
    assert.equal((await c.como(admin, 'PUT', ruta, { decision: 'BORRAR' })).status, 400);
    assert.equal((await c.como(admin, 'PUT', ruta, { decision: 'OCULTAR' })).status, 204);
    assert.equal((await c.como(admin, 'PUT', ruta, { decision: 'DESESTIMAR' })).status, 404);

    assert.equal((await srv.pedir(`/api/cursos/${cursoId}/resenas`)).json.resumen.total, 1);
    const ocultados = await c.como(admin, 'GET', '/api/admin/resenas/reportes?estado=OCULTADA');
    const resuelto = ocultados.json.find((x: { id: number }) => x.id === reporte.id);
    assert.ok(resuelto.resena.eliminadaEn);
    assert.equal(resuelto.historial.at(-1).accion, 'ELIMINADA');
    assert.equal(resuelto.historial.at(-1).actor.id, admin.idPersona);
  });
});

describe('Sprint 4 · acceso total del administrador', () => {
  it('lista todas las reseñas, también las ocultas, con su historial; solo ADMIN', async () => {
    assert.equal((await c.como(docente, 'GET', '/api/admin/resenas')).status, 403);
    const todas = await c.como(admin, 'GET', '/api/admin/resenas?limite=50');
    assert.equal(todas.status, 200, todas.texto);
    const deBeto = todas.json.items.find((r: { id: number }) => r.id === resenaBeto);
    assert.ok(deBeto.eliminadaEn, 'la ocultada aparece con su fecha de borrado');
    assert.equal(deBeto.historial.at(-1).accion, 'ELIMINADA');
    const deAna = todas.json.items.find((r: { id: number }) => r.id === resenaAna);
    assert.equal(deAna.eliminadaEn, null);
    assert.equal(deAna.respuesta.texto, '¡Gracias por la sugerencia!');

    const borradas = await c.como(admin, 'GET', '/api/admin/resenas?estado=borradas&limite=50');
    assert.ok(borradas.json.items.every((r: { eliminadaEn: string | null }) => r.eliminadaEn !== null));
    assert.ok(borradas.json.items.some((r: { id: number }) => r.id === resenaBeto));
    assert.equal((await c.como(admin, 'GET', '/api/admin/resenas?estado=otra')).status, 400);
  });
});

describe('Sprint 4 · seguimiento, exportación y analíticas del docente', () => {
  it('el seguimiento muestra la valoración del curso y la calificación de cada estudiante', async () => {
    const r = await c.como(docente, 'GET', `/api/docente/cursos/${cursoId}/estudiantes`);
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual(r.json.resumen.valoracion, { promedio: 4, total: 1 });
    const porNombre = new Map(r.json.items.map((i: { idPersona: number; estrellas: number | null }) => [i.idPersona, i.estrellas]));
    assert.equal(porNombre.get(ana.idPersona), 4);
    assert.equal(porNombre.get(beto.idPersona), null, 'la reseña oculta no cuenta');
  });

  it('exporta a CSV para Excel y neutraliza fórmulas', async () => {
    await c.como(ana, 'PUT', miResena(ana), { estrellas: 4, comentario: '=HIPERVINCULO("http://x")' });
    const r = await c.como(docente, 'GET', `/api/docente/cursos/${cursoId}/estudiantes/exportar`);
    assert.equal(r.status, 200, r.texto);
    assert.match(r.headers.get('content-type') ?? '', /^text\/csv/);
    assert.match(r.headers.get('content-disposition') ?? '', /^attachment; filename="estudiantes-[a-z0-9-]+\.csv"$/);
    assert.ok(r.texto.startsWith('Estudiante;Estado;'), 'el BOM no se ve en el texto decodificado');
    assert.match(r.texto, /;4;"'=HIPERVINCULO\(""http:\/\/x""\)";/);
    assert.equal(r.texto.trim().split('\r\n').length, 3, 'encabezado y dos inscritos');
    assert.equal((await c.como(otroDocente, 'GET', `/api/docente/cursos/${cursoId}/estudiantes/exportar`)).status, 404);
  });

  it('calcula actividad, finalización, conversión y el embudo por lección', async () => {
    for (let i = 0; i < 4; i++) await srv.pedir(`/api/cursos/${cursoId}`);
    const general = await c.como(docente, 'GET', '/api/docente/analiticas');
    assert.equal(general.status, 200, general.texto);
    assert.equal(general.json.embudo, null);
    assert.equal(general.json.porCurso[0].inscritos, 2);
    assert.equal(general.json.actividad.length, 12);
    const esteMes = general.json.actividad.at(-1);
    assert.deepEqual([esteMes.inscripciones, esteMes.completados], [2, 1]);

    const curso = await c.como(docente, 'GET', `/api/docente/analiticas?curso=${cursoId}`);
    assert.equal(curso.json.resumen.inscritos, 2);
    assert.equal(curso.json.resumen.completados, 1);
    assert.equal(typeof curso.json.resumen.diasPromedioFinalizacion, 'number');
    assert.ok(curso.json.conversion.visitas >= 4);
    assert.equal(curso.json.conversion.inscripciones, 2);
    assert.deepEqual(curso.json.embudo.map((l: { leccionId: number; completaron: number }) => [l.leccionId, l.completaron]),
      [[leccionId, 1]]);
    assert.equal(curso.json.porCurso, null);

    assert.equal((await c.como(docente, 'GET', `/api/docente/analiticas?curso=${cursoAjeno}`)).status, 404);
    assert.equal((await c.como(ana, 'GET', '/api/docente/analiticas')).status, 403);
  });
});
