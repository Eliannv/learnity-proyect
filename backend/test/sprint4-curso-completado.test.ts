import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s4_comp');
let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let admin: Cuenta;
let estudiante: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let cursoId = 0;
let leccionVideoId = 0;
let leccionEvalId = 0;
let evaluacionId = 0;
let preguntaIds: number[] = [];

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  estudiante = await cuentas.crearCuenta(['ESTUDIANTE']);

  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);

  // Crear un curso borrador con 1 módulo
  const idCurso = await c.crearCurso(docente);
  const idModulo = await c.crearModulo(docente, idCurso);
  cursoId = idCurso;

  // Añadir 1 lección de VIDEO válida
  const rVideo = await c.como(docente, 'POST', `/api/modulos/${idModulo}/lecciones`, {
    titulo: 'Lección de video',
    orden: 1,
    tipo: 'VIDEO',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  });
  assert.equal(rVideo.status, 201, rVideo.texto);
  leccionVideoId = rVideo.json.modulos[0].lecciones.find((l: any) => l.tipo === 'VIDEO').id;

  // Añadir 1 lección de EVALUACION con 5 preguntas
  const rEval = await c.como(docente, 'POST', `/api/modulos/${idModulo}/lecciones`, {
    titulo: 'Evaluación final',
    orden: 2,
    tipo: 'EVALUACION',
  });
  assert.equal(rEval.status, 201, rEval.texto);
  leccionEvalId = rEval.json.modulos[0].lecciones.find((l: any) => l.tipo === 'EVALUACION').id;

  const rCuestionario = await c.como(docente, 'PUT', `/api/lecciones/${leccionEvalId}/evaluacion`, {
    preguntas: Array.from({ length: 5 }, (_, i) => ({
      enunciado: `Pregunta ${i + 1}`,
      opciones: ['Correcta', 'Falsa uno', 'Falsa dos', 'Falsa tres'],
      correcta: 'A',
    })),
  });
  assert.equal(rCuestionario.status, 200, rCuestionario.texto);

  // Publicar el curso mediante admin
  const rEnviar = await c.como(docente, 'POST', `/api/cursos/${cursoId}/enviar-revision`);
  assert.equal(rEnviar.status, 200, rEnviar.texto);
  const rAprobar = await c.como(admin, 'PUT', `/api/admin/cursos/${cursoId}/revision`, {
    decision: 'APROBAR',
  });
  assert.equal(rAprobar.status, 200, rAprobar.texto);

  // Inscribir al estudiante
  const rInscripcion = await c.como(estudiante, 'POST', `/api/cursos/${cursoId}/inscripcion`);
  assert.equal(rInscripcion.status, 201, rInscripcion.texto);

  // Obtener preguntas de la evaluación
  const rDetalleCurso = await c.como(estudiante, 'GET', `/api/mi-aprendizaje/cursos/${cursoId}`);
  assert.equal(rDetalleCurso.status, 200, rDetalleCurso.texto);
  const leccionEv = rDetalleCurso.json.modulos[0].lecciones.find((l: any) => l.id === leccionEvalId);
  evaluacionId = leccionEv.evaluacionId;

  const rPreguntas = await c.como(estudiante, 'GET', `/api/evaluaciones/${evaluacionId}`);
  assert.equal(rPreguntas.status, 200, rPreguntas.texto);
  preguntaIds = rPreguntas.json.preguntas.map((p: any) => p.id);
});

after(async () => {
  try {
    await limpiarMarca(f, marca);
    await srv?.cerrar();
    await f?.cerrar();
  } catch {
    // Limpieza de prueba
  }
});

describe('Sprint 4 · Regla unificada de Curso Completado', () => {
  it('no permite marcar la lección de evaluación a mano con PUT /progreso (400)', async () => {
    const rAMano = await c.como(estudiante, 'PUT', `/api/lecciones/${leccionEvalId}/progreso`, {
      completada: true,
    });
    assert.equal(rAMano.status, 400);
    assert.match(rAMano.json.error.mensaje, /no se marca a mano/i);
  });

  it('completar solo las lecciones regulares deja el curso en ACTIVA y 50% de progreso', async () => {
    const rVideo = await c.como(estudiante, 'PUT', `/api/lecciones/${leccionVideoId}/progreso`, {
      completada: true,
    });
    assert.equal(rVideo.status, 200);
    assert.equal(rVideo.json.completada, true);
    assert.equal(rVideo.json.progresoPct, 50);
    assert.equal(rVideo.json.estado, 'ACTIVA');
  });

  it('un intento reprobado de evaluación (< 60%) mantiene el curso en ACTIVA y 50%', async () => {
    // 2 aciertos de 5 = 40% (reprobado, mínimo es 60%)
    const respuestasReprobadas = preguntaIds.map((id, i) => ({
      preguntaId: id,
      opcion: i < 2 ? 'A' : 'B',
    }));

    const rReprobado = await c.como(estudiante, 'POST', `/api/evaluaciones/${evaluacionId}/intentos`, {
      respuestas: respuestasReprobadas,
    });
    assert.equal(rReprobado.status, 201);
    assert.equal(rReprobado.json.intento.aprobado, false);
    assert.equal(rReprobado.json.progresoPct, 50);
    assert.equal(rReprobado.json.estado, 'ACTIVA');
  });

  it('al aprobar la evaluación (>= 60%), el curso alcanza 100% y estado COMPLETADA', async () => {
    // 4 aciertos de 5 = 80% (aprobado)
    const respuestasAprobadas = preguntaIds.map((id, i) => ({
      preguntaId: id,
      opcion: i < 4 ? 'A' : 'B',
    }));

    const rAprobado = await c.como(estudiante, 'POST', `/api/evaluaciones/${evaluacionId}/intentos`, {
      respuestas: respuestasAprobadas,
    });
    assert.equal(rAprobado.status, 201);
    assert.equal(rAprobado.json.intento.aprobado, true);
    assert.equal(rAprobado.json.progresoPct, 100);
    assert.equal(rAprobado.json.estado, 'COMPLETADA');

    // Verificar en la lista de Mi Aprendizaje
    const rMiAprendizaje = await c.como(estudiante, 'GET', '/api/mi-aprendizaje');
    assert.equal(rMiAprendizaje.status, 200);
    const cursoInscrito = rMiAprendizaje.json.items.find((i: any) => i.curso.id === cursoId);
    assert.ok(cursoInscrito);
    assert.equal(cursoInscrito.inscripcion.progresoPct, 100);
    assert.equal(cursoInscrito.inscripcion.estado, 'COMPLETADA');
    assert.ok(cursoInscrito.inscripcion.completadoEn);
  });
});
