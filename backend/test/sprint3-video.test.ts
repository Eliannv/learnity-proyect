import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s3_video');
const pdfDir = carpetaPdfPropia();
const videoId = 'dQw4w9WgXcQ';
let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let ajeno: Cuenta;
let admin: Cuenta;
let estudiante: Cuenta;
let otroEstudiante: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let cursoId = 0;
let documentoId = 0;
let archivoId = 0;
let moduloId = 0;
let vistaId = 0;
let privadoId = 0;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  ajeno = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  estudiante = await cuentas.crearCuenta(['ESTUDIANTE']);
  otroEstudiante = await cuentas.crearCuenta(['ESTUDIANTE']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
  const completo = await c.cursoCompleto(docente);
  cursoId = completo.idCurso;
  moduloId = completo.idModulo;
  documentoId = completo.idLeccion;
  archivoId = completo.idArchivo;
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    if (cursoId) {
      await f.query(
        'DELETE FROM progreso_leccion WHERE id_inscripcion IN (SELECT id_inscripcion FROM inscripcion WHERE id_curso = $1)',
        [cursoId],
      );
      await f.query('DELETE FROM inscripcion WHERE id_curso = $1', [cursoId]);
    }
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

describe('Sprint 3: VIDEO YouTube y PDF del estudiante', () => {
  it('permite varias lecciones de vídeo en un módulo y enviar un curso sin PDF', async () => {
    const idCurso = await c.crearCurso(docente);
    const idModulo = await c.crearModulo(docente, idCurso);
    for (const orden of [1, 2]) {
      const creado = await c.como(docente, 'POST', `/api/modulos/${idModulo}/lecciones`, {
        titulo: `Vídeo ${orden}`, orden, tipo: 'VIDEO',
        youtubeUrl: `https://youtu.be/${videoId}`,
      });
      assert.equal(creado.status, 201, creado.texto);
      assert.equal(creado.json.modulos[0].lecciones.length, orden);
    }
    const enviado = await c.como(docente, 'POST', `/api/cursos/${idCurso}/enviar-revision`);
    assert.equal(enviado.status, 200, enviado.texto);
    assert.deepEqual(enviado.json.validacion, { completo: true, problemas: [] });
  });

  it('valida la URL, crea VIDEO sin MP4 y aplica propiedad y estado editable', async () => {
    const ruta = `/api/modulos/${moduloId}/lecciones`;
    const invalido = await c.como(docente, 'POST', ruta, {
      titulo: 'Video inseguro', orden: 2, tipo: 'VIDEO', youtubeUrl: `https://youtube.com.evil.test/watch?v=${videoId}`,
    });
    assert.equal(invalido.status, 400, invalido.texto);
    const ajenoResultado = await c.como(ajeno, 'POST', ruta, {
      titulo: 'No autorizado', orden: 2, tipo: 'VIDEO', youtubeUrl: videoId,
    });
    assert.equal(ajenoResultado.status, 403, ajenoResultado.texto);
    const vista = await c.como(docente, 'POST', ruta, {
      titulo: 'Vista previa', orden: 2, tipo: 'VIDEO',
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}&t=10`,
    });
    assert.equal(vista.status, 201, vista.texto);
    vistaId = vista.json.modulos[0].lecciones.find((l: { orden: number }) => l.orden === 2).id;
    const leccion = vista.json.modulos[0].lecciones.find((l: { id: number }) => l.id === vistaId);
    assert.equal(leccion.youtubeVideoId, videoId);
    assert.equal('vistaPrevia' in leccion, false);
    assert.equal(leccion.archivo, null);
    const privado = await c.como(docente, 'POST', ruta, {
      titulo: 'Video privado', orden: 3, tipo: 'VIDEO', youtubeUrl: `https://youtu.be/${videoId}`,
    });
    assert.equal(privado.status, 201, privado.texto);
    privadoId = privado.json.modulos[0].lecciones.find((l: { orden: number }) => l.orden === 3).id;
    const editado = await c.como(docente, 'PUT', `/api/lecciones/${privadoId}`, {
      titulo: 'Video privado actualizado', orden: 3, tipo: 'VIDEO', youtubeUrl: videoId,
    });
    assert.equal(editado.status, 200, editado.texto);
    await c.enviarARevision(docente, cursoId);
    const aprobado = await c.como(admin, 'PUT', `/api/admin/cursos/${cursoId}/revision`, { decision: 'APROBAR' });
    assert.equal(aprobado.status, 200, aprobado.texto);
    // Sprint 3: el curso publicado se sigue editando y no vuelve a revisión.
    const publicado = await c.como(docente, 'PUT', `/api/lecciones/${vistaId}`, {
      titulo: 'Vista previa', orden: 2, tipo: 'VIDEO', youtubeUrl: videoId,
    });
    assert.equal(publicado.status, 200, publicado.texto);
    assert.equal(publicado.json.estado, 'PUBLICADO');
  });

  it('sin muestras públicas: vídeo y PDF exigen inscripción y vínculo con su curso', async () => {
    // La ruta de vista previa ya no existe para ninguna lección.
    for (const id of [vistaId, privadoId, documentoId]) {
      assert.equal((await srv.pedir(`/api/lecciones/${id}/video-preview`)).status, 404);
    }
    const rutaPdf = `/api/archivos/${archivoId}`;
    assert.equal((await srv.pedir(rutaPdf)).status, 401);
    assert.equal((await c.como(estudiante, 'GET', rutaPdf)).status, 403);
    assert.equal((await c.como(otroEstudiante, 'GET', rutaPdf)).status, 403);
    const inscripcion = await c.como(estudiante, 'POST', `/api/cursos/${cursoId}/inscripcion`);
    assert.equal(inscripcion.status, 201, inscripcion.texto);
    const pdf = await c.como(estudiante, 'GET', rutaPdf);
    assert.equal(pdf.status, 200, pdf.texto.slice(0, 100));
    assert.match(pdf.headers.get('content-type') ?? '', /application\/pdf/);
    assert.equal(pdf.headers.get('cache-control'), 'private, no-store');
    assert.equal((await c.como(otroEstudiante, 'GET', rutaPdf)).status, 403);
  });
});
