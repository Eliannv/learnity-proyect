import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s4_res');
const pdfDir = carpetaPdfPropia();
let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let admin: Cuenta;
let ana: Cuenta;
let beto: Cuenta;
let curioso: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let cursoId = 0;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  ana = await cuentas.crearCuenta(['ESTUDIANTE']);
  beto = await cuentas.crearCuenta(['ESTUDIANTE']);
  curioso = await cuentas.crearCuenta(['ESTUDIANTE']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
  cursoId = (await c.cursoCompleto(docente)).idCurso;
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

describe('Sprint 4 · reseñas y valoraciones', () => {
  it('un curso sin publicar no tiene reseñas públicas', async () => {
    assert.equal((await srv.pedir(`/api/cursos/${cursoId}/resenas`)).status, 404);
    await c.enviarARevision(docente, cursoId);
    assert.equal((await c.como(admin, 'PUT', `/api/admin/cursos/${cursoId}/revision`, { decision: 'APROBAR' })).status, 200);
    const vacia = await srv.pedir(`/api/cursos/${cursoId}/resenas`);
    assert.equal(vacia.status, 200);
    assert.deepEqual(vacia.json.resumen, { promedio: null, total: 0, distribucion: [0, 0, 0, 0, 0] });
  });

  it('solo el estudiante inscrito reseña; valida estrellas y comentario', async () => {
    const ruta = `/api/cursos/${cursoId}/resena`;
    assert.equal((await srv.pedir(ruta, { metodo: 'PUT', cuerpo: { estrellas: 5 } })).status, 401);
    const sinInscripcion = await c.como(curioso, 'PUT', ruta, { estrellas: 5 });
    assert.equal(sinInscripcion.status, 403);
    assert.equal(sinInscripcion.json.error.codigo, 'NO_INSCRITO');
    assert.deepEqual((await c.como(curioso, 'GET', ruta)).json, { puedeResenar: false, resena: null, ocultada: false });

    for (const quien of [ana, beto]) {
      assert.equal((await c.como(quien, 'POST', `/api/cursos/${cursoId}/inscripcion`)).status, 201);
    }
    for (const malo of [{ estrellas: 0 }, { estrellas: 6 }, { estrellas: 4.5 }, { estrellas: 3, comentario: 'x'.repeat(1001) }, {}]) {
      assert.equal((await c.como(ana, 'PUT', ruta, malo)).status, 400, JSON.stringify(malo));
    }

    const guardada = await c.como(ana, 'PUT', ruta, { estrellas: 4, comentario: '  Muy claro.  ' });
    assert.equal(guardada.status, 200, guardada.texto);
    assert.equal(guardada.json.comentario, 'Muy claro.');
    assert.ok(!guardada.texto.includes(ana.correo), 'la reseña nunca expone el correo');
    const reemplazo = await c.como(ana, 'PUT', ruta, { estrellas: 5, comentario: 'Excelente <script>' });
    assert.equal(reemplazo.json.id, guardada.json.id, 'una reseña por inscripción');
    assert.equal((await c.como(beto, 'PUT', ruta, { estrellas: 2, comentario: '   ' })).json.comentario, null);
  });

  it('el resumen promedia, cuenta por estrellas y muestra primero las que tienen comentario', async () => {
    const lista = await srv.pedir(`/api/cursos/${cursoId}/resenas`);
    assert.deepEqual(lista.json.resumen, { promedio: 3.5, total: 2, distribucion: [0, 1, 0, 0, 1] });
    assert.equal(lista.json.items[0].comentario, 'Excelente <script>');
    assert.equal(lista.json.items[1].comentario, null);
    assert.match(lista.json.items[0].autor, /^\S.* \S\.$/);

    const detalle = await srv.pedir(`/api/cursos/${cursoId}`);
    assert.deepEqual(detalle.json.calificacion, { promedio: 3.5, total: 2 });
    // La tarjeta del catálogo trae la misma calificación que la ficha.
    const catalogo = await srv.pedir(`/api/cursos?q=${encodeURIComponent(detalle.json.titulo)}`);
    const item = catalogo.json.items.find((x: { id: number }) => x.id === cursoId);
    assert.deepEqual(item.calificacion, { promedio: 3.5, total: 2 });
    assert.equal(detalle.json.instructor.cursosPublicados, 1);
    assert.equal(detalle.json.instructor.estudiantes, 2);
  });

  it('el estudiante borra su reseña y el resumen se actualiza', async () => {
    const ruta = `/api/cursos/${cursoId}/resena`;
    assert.equal((await c.como(beto, 'DELETE', ruta)).status, 204);
    assert.equal((await c.como(beto, 'DELETE', ruta)).status, 404);
    const mia = await c.como(beto, 'GET', ruta);
    assert.deepEqual(mia.json, { puedeResenar: true, resena: null, ocultada: false });
    const lista = await srv.pedir(`/api/cursos/${cursoId}/resenas`);
    assert.deepEqual(lista.json.resumen, { promedio: 5, total: 1, distribucion: [0, 0, 0, 0, 1] });
  });
});
