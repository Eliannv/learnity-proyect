import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, iniciarSesion, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s3_aprendizaje');
const pdfDir = carpetaPdfPropia();
let f: Fixtures;
let srv: Servidor;
let estudiante: Cuenta;
let otroEstudiante: Cuenta;
let docente: Cuenta;
let otroDocente: Cuenta;
let admin: Cuenta;
let idCurso: number;
let idLeccion: number;
let c: ReturnType<typeof fabricaCursos>;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  estudiante = await cuentas.crearCuenta(['ESTUDIANTE']);
  otroEstudiante = await cuentas.crearCuenta(['ESTUDIANTE']);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  otroDocente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
  const completo = await c.cursoCompleto(docente);
  idCurso = completo.idCurso;
  idLeccion = completo.idLeccion;
  await c.enviarARevision(docente, idCurso);
  const aprobacion = await c.como(admin, 'PUT', `/api/admin/cursos/${idCurso}/revision`, { decision: 'APROBAR' });
  assert.equal(aprobacion.status, 200, aprobacion.texto);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    if (idCurso) {
      await f.query(
        'DELETE FROM progreso_leccion WHERE id_inscripcion IN (SELECT id_inscripcion FROM inscripcion WHERE id_curso = $1)',
        [idCurso],
      );
      await f.query('DELETE FROM inscripcion WHERE id_curso = $1', [idCurso]);
    }
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

describe('Sprint 3: inscripción y aprendizaje', () => {
  it('exige sesión y rol antes de revelar el curso', async () => {
    const anonimo = await srv.pedir(`/api/cursos/${idCurso}/inscripcion`, { metodo: 'POST' });
    assert.equal(anonimo.status, 401);
    const soloDocente = await fabricaCuentas(f, srv, marca).crearCuenta(['DOCENTE']);
    const sinRol = await c.como(soloDocente, 'POST', `/api/cursos/${idCurso}/inscripcion`);
    assert.equal(sinRol.status, 403);
    const borrador = await c.crearCurso(docente);
    const noPublicado = await c.como(estudiante, 'POST', `/api/cursos/${borrador}/inscripcion`);
    assert.equal(noPublicado.status, 404);
  });

  it('dos solicitudes simultáneas crean una sola inscripción y la repetición responde 200', async () => {
    const ruta = `/api/cursos/${idCurso}/inscripcion`;
    const [a, b] = await Promise.all([
      c.como(estudiante, 'POST', ruta), c.como(estudiante, 'POST', ruta),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal(a.json.id, b.json.id);
    const repetida = await c.como(estudiante, 'POST', ruta);
    assert.equal(repetida.status, 200);
    assert.equal(repetida.json.id, a.json.id);
    const { rows } = await f.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM inscripcion WHERE id_persona = $1 AND id_curso = $2',
      [estudiante.idPersona, idCurso],
    );
    assert.equal(rows[0]!.total, 1);
  });

  it('guarda la posición, completa el curso y la lectura posterior conserva el avance', async () => {
    const ruta = `/api/lecciones/${idLeccion}/progreso`;
    const posicion = await c.como(estudiante, 'PUT', ruta, { segundosVistos: 42 });
    assert.equal(posicion.status, 200, posicion.texto);
    assert.equal(posicion.json.segundosVistos, 42);
    assert.equal(posicion.json.progresoPct, 0);
    const completado = await c.como(estudiante, 'PUT', ruta, { completada: true });
    assert.equal(completado.status, 200, completado.texto);
    assert.equal(completado.json.progresoPct, 100);
    assert.equal(completado.json.estado, 'COMPLETADA');
    const concurrentes = await Promise.all([
      c.como(estudiante, 'PUT', ruta, { segundosVistos: 10 }),
      c.como(estudiante, 'PUT', ruta, { segundosVistos: 60 }),
    ]);
    assert.ok(concurrentes.every((r) => r.status === 200), concurrentes.map((r) => r.texto).join('\n'));
    const nuevoToken = await iniciarSesion(srv, estudiante.correo);
    const detalle = await srv.pedir(`/api/mi-aprendizaje/cursos/${idCurso}`, { token: nuevoToken });
    assert.equal(detalle.status, 200, detalle.texto);
    assert.equal(detalle.json.inscripcion.progresoPct, 100);
    assert.equal(detalle.json.modulos[0].lecciones[0].progreso.segundosVistos, 60);
    assert.equal(detalle.json.modulos[0].lecciones[0].progreso.completada, true);
    const lista = await srv.pedir('/api/mi-aprendizaje', { token: nuevoToken });
    assert.equal(lista.status, 200);
    assert.equal(lista.json.items[0].inscripcion.estado, 'COMPLETADA');
    const desmarcada = await c.como(estudiante, 'PUT', ruta, { completada: false });
    assert.equal(desmarcada.status, 200, desmarcada.texto);
    assert.equal(desmarcada.json.completada, false);
    assert.equal(desmarcada.json.progresoPct, 0);
    assert.equal(desmarcada.json.estado, 'ACTIVA');
    const retrocedida = await c.como(estudiante, 'PUT', ruta, { segundosVistos: 15 });
    assert.equal(retrocedida.status, 200, retrocedida.texto);
    assert.equal(retrocedida.json.segundosVistos, 15);
    const detalleRetrocedido = await srv.pedir(`/api/mi-aprendizaje/cursos/${idCurso}`, { token: nuevoToken });
    assert.equal(detalleRetrocedido.json.modulos[0].lecciones[0].progreso.segundosVistos, 15);
    assert.equal(detalleRetrocedido.json.modulos[0].lecciones[0].progreso.completada, false);
    await c.como(estudiante, 'PUT', ruta, { completada: true });
  });

  it('impide acceso ajeno y solo el docente propietario o ADMIN ve el seguimiento', async () => {
    const privado = await c.como(otroEstudiante, 'GET', `/api/mi-aprendizaje/cursos/${idCurso}`);
    assert.equal(privado.status, 404);
    const avance = await c.como(otroEstudiante, 'PUT', `/api/lecciones/${idLeccion}/progreso`, { completada: true });
    assert.equal(avance.status, 404);
    const ruta = `/api/docente/cursos/${idCurso}/estudiantes`;
    assert.equal((await c.como(otroDocente, 'GET', ruta)).status, 404);
    assert.equal((await c.como(otroEstudiante, 'GET', ruta)).status, 403);
    const propietario = await c.como(docente, 'GET', `${ruta}?pagina=1&limite=10`);
    assert.equal(propietario.status, 200, propietario.texto);
    assert.equal(propietario.json.total, 1);
    assert.equal(propietario.json.totalPaginas, 1);
    assert.equal(propietario.json.items[0].progresoPct, 100);
    assert.equal(propietario.json.items[0].correo, undefined);
    assert.equal((await c.como(admin, 'GET', ruta)).status, 200);
  });
});
