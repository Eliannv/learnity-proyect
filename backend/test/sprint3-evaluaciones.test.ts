import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s3_eval');
const pdfDir = carpetaPdfPropia();
let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let ajeno: Cuenta;
let admin: Cuenta;
let estudiante: Cuenta;
let noInscrito: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let cursoId = 0;
let moduloId = 0;
let documentoId = 0;
let leccionEvalId = 0;
let evaluacionId = 0;
let preguntaIds: number[] = [];

/** `n` preguntas cuya respuesta correcta es siempre la A. */
const cuestionario = (n: number, prefijo = 'Pregunta') => ({
  preguntas: Array.from({ length: n }, (_, i) => ({
    enunciado: `${prefijo} ${i + 1}`,
    opciones: ['Correcta', 'Falsa uno', 'Falsa dos', 'Falsa tres'],
    correcta: 'A',
  })),
});

/** Responde bien las `aciertos` primeras preguntas y mal el resto. */
const respuestas = (aciertos: number) => ({
  respuestas: preguntaIds.map((preguntaId, i) => ({ preguntaId, opcion: i < aciertos ? 'A' : 'B' })),
});

const leccionDe = (curso: any, id: number) =>
  (curso.modulos as any[]).flatMap((m) => m.lecciones).find((l: any) => l.id === id);

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  ajeno = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  estudiante = await cuentas.crearCuenta(['ESTUDIANTE']);
  noInscrito = await cuentas.crearCuenta(['ESTUDIANTE']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
  const completo = await c.cursoCompleto(docente);
  cursoId = completo.idCurso;
  moduloId = completo.idModulo;
  documentoId = completo.idLeccion;
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

describe('Sprint 3: evaluaciones del docente y del estudiante', () => {
  it('el docente crea una lección EVALUACION que exige entre 5 y 10 preguntas', async () => {
    const creada = await c.como(docente, 'POST', `/api/modulos/${moduloId}/lecciones`, {
      titulo: 'Evaluación del módulo', orden: 2, tipo: 'EVALUACION',
    });
    assert.equal(creada.status, 201, creada.texto);
    leccionEvalId = creada.json.modulos[0].lecciones.find((l: any) => l.orden === 2).id;
    assert.equal(leccionDe(creada.json, leccionEvalId).preguntas, 0);
    assert.ok(creada.json.validacion.problemas.some((p: any) => p.campo === 'modulos.0.lecciones.1.preguntas'));

    const vacio = await c.como(docente, 'GET', `/api/docente/lecciones/${leccionEvalId}/evaluacion`);
    assert.equal(vacio.status, 200, vacio.texto);
    assert.deepEqual(vacio.json, { leccionId: leccionEvalId, porcentajeAprobacion: 60, preguntas: [] });

    const ruta = `/api/lecciones/${leccionEvalId}/evaluacion`;
    assert.equal((await c.como(docente, 'PUT', ruta, cuestionario(4))).status, 400);
    assert.equal((await c.como(docente, 'PUT', ruta, cuestionario(11))).status, 400);
    const tresOpciones = cuestionario(5);
    tresOpciones.preguntas[0]!.opciones.pop();
    assert.equal((await c.como(docente, 'PUT', ruta, tresOpciones)).status, 400);
    assert.equal((await c.como(docente, 'PUT', ruta, { ...cuestionario(5), puntaje: 100 })).status, 400);
    assert.equal((await c.como(ajeno, 'PUT', ruta, cuestionario(5))).status, 403);
    const enDocumento = await c.como(docente, 'PUT', `/api/lecciones/${documentoId}/evaluacion`, cuestionario(5));
    assert.equal(enDocumento.status, 400, enDocumento.texto);
    assert.equal((await c.como(estudiante, 'GET', `/api/docente/lecciones/${leccionEvalId}/evaluacion`)).status, 403);
  });

  it('guarda el cuestionario, lo devuelve con la respuesta correcta y completa el curso', async () => {
    const guardado = await c.como(docente, 'PUT', `/api/lecciones/${leccionEvalId}/evaluacion`, cuestionario(5));
    assert.equal(guardado.status, 200, guardado.texto);
    assert.equal(leccionDe(guardado.json, leccionEvalId).preguntas, 5);
    assert.deepEqual(guardado.json.validacion, { completo: true, problemas: [] });

    for (const quien of [docente, admin]) {
      const leido = await c.como(quien, 'GET', `/api/docente/lecciones/${leccionEvalId}/evaluacion`);
      assert.equal(leido.status, 200, leido.texto);
      assert.equal(leido.json.preguntas.length, 5);
      assert.equal(leido.json.preguntas[0].correcta, 'A');
      assert.deepEqual(leido.json.preguntas[0].opciones.map((o: any) => o.letra), ['A', 'B', 'C', 'D']);
    }
    assert.equal((await c.como(ajeno, 'GET', `/api/docente/lecciones/${leccionEvalId}/evaluacion`)).status, 403);

    await c.enviarARevision(docente, cursoId);
    const aprobado = await c.como(admin, 'PUT', `/api/admin/cursos/${cursoId}/revision`, { decision: 'APROBAR' });
    assert.equal(aprobado.status, 200, aprobado.texto);
  });

  it('el estudiante inscrito ve la evaluación en su temario, sin las respuestas correctas', async () => {
    assert.equal((await c.como(estudiante, 'POST', `/api/cursos/${cursoId}/inscripcion`)).status, 201);
    const detalle = await c.como(estudiante, 'GET', `/api/mi-aprendizaje/cursos/${cursoId}`);
    assert.equal(detalle.status, 200, detalle.texto);
    assert.equal(detalle.json.totalLecciones, 2);
    const item = leccionDe(detalle.json, leccionEvalId);
    assert.equal(item.tipo, 'EVALUACION');
    evaluacionId = item.evaluacionId;
    assert.ok(evaluacionId > 0);

    const evaluacion = await c.como(estudiante, 'GET', `/api/evaluaciones/${evaluacionId}`);
    assert.equal(evaluacion.status, 200, evaluacion.texto);
    // Ninguna clave de la respuesta revela la opción correcta (las opciones de prueba sí se llaman «Correcta»).
    assert.doesNotMatch(evaluacion.texto, /"(es_?)?correcta"\s*:/i);
    assert.equal(evaluacion.json.preguntas.length, 5);
    assert.deepEqual(evaluacion.json.resumen, { intentos: 0, mejorPuntaje: null, ultimoPuntaje: null, aprobada: false });
    preguntaIds = evaluacion.json.preguntas.map((p: any) => p.id);

    assert.equal((await c.como(noInscrito, 'GET', `/api/evaluaciones/${evaluacionId}`)).status, 404);
    assert.equal((await c.como(docente, 'GET', `/api/evaluaciones/${evaluacionId}`)).status, 404);
    assert.equal((await c.como(noInscrito, 'POST', `/api/evaluaciones/${evaluacionId}/intentos`, respuestas(5))).status, 404);
  });

  it('rechaza intentos incompletos, repetidos, de otra pregunta o con puntaje del cliente', async () => {
    const ruta = `/api/evaluaciones/${evaluacionId}/intentos`;
    const incompleto = respuestas(5);
    incompleto.respuestas.pop();
    assert.equal((await c.como(estudiante, 'POST', ruta, incompleto)).status, 400);
    const repetido = respuestas(5);
    repetido.respuestas[4] = repetido.respuestas[0]!;
    assert.equal((await c.como(estudiante, 'POST', ruta, repetido)).status, 400);
    const ajena = respuestas(5);
    ajena.respuestas[0] = { preguntaId: 2_000_000_000, opcion: 'A' };
    assert.equal((await c.como(estudiante, 'POST', ruta, ajena)).status, 400);
    assert.equal((await c.como(estudiante, 'POST', ruta, { ...respuestas(0), puntaje: 100 })).status, 400);
    const { rows } = await f.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM intento_evaluacion WHERE id_evaluacion = $1', [evaluacionId]);
    assert.equal(rows[0]!.n, 0);
  });

  it('califica en el servidor: 2/5 suspende sin bloquear y 3/5 (60 %) aprueba y completa la lección', async () => {
    const ruta = `/api/evaluaciones/${evaluacionId}/intentos`;
    const suspenso = await c.como(estudiante, 'POST', ruta, respuestas(2));
    assert.equal(suspenso.status, 201, suspenso.texto);
    assert.equal(suspenso.json.intento.puntaje, 40);
    assert.equal(suspenso.json.intento.aprobado, false);
    assert.equal(suspenso.json.respuestas.filter((r: any) => r.correcta).length, 2);
    assert.equal(suspenso.json.progresoPct, 0);

    const aMano = await c.como(estudiante, 'PUT', `/api/lecciones/${leccionEvalId}/progreso`, { completada: true });
    assert.equal(aMano.status, 400, aMano.texto);
    // Suspender no bloquea el resto del curso.
    const otra = await c.como(estudiante, 'PUT', `/api/lecciones/${documentoId}/progreso`, { completada: true });
    assert.equal(otra.status, 200, otra.texto);
    assert.equal(otra.json.progresoPct, 50);

    const aprobado = await c.como(estudiante, 'POST', ruta, respuestas(3));
    assert.equal(aprobado.status, 201, aprobado.texto);
    assert.equal(aprobado.json.intento.puntaje, 60);
    assert.equal(aprobado.json.intento.aprobado, true);
    assert.deepEqual(aprobado.json.resumen, { intentos: 2, mejorPuntaje: 60, ultimoPuntaje: 60, aprobada: true });
    assert.equal(aprobado.json.progresoPct, 100);
    assert.equal(aprobado.json.estado, 'COMPLETADA');

    // Un intento peor después no deshace la aprobación ni la lección completada.
    const peor = await c.como(estudiante, 'POST', ruta, respuestas(0));
    assert.equal(peor.status, 201, peor.texto);
    assert.deepEqual(peor.json.resumen, { intentos: 3, mejorPuntaje: 60, ultimoPuntaje: 0, aprobada: true });
    const detalle = await c.como(estudiante, 'GET', `/api/mi-aprendizaje/cursos/${cursoId}`);
    assert.equal(leccionDe(detalle.json, leccionEvalId).progreso.completada, true);
    assert.equal(detalle.json.inscripcion.progresoPct, 100);
  });

  it('el docente edita las preguntas del curso publicado sin perder los intentos', async () => {
    const editado = await c.como(docente, 'PUT', `/api/lecciones/${leccionEvalId}/evaluacion`, cuestionario(6, 'Nueva'));
    assert.equal(editado.status, 200, editado.texto);
    assert.equal(editado.json.estado, 'PUBLICADO');
    const evaluacion = await c.como(estudiante, 'GET', `/api/evaluaciones/${evaluacionId}`);
    assert.equal(evaluacion.status, 200, evaluacion.texto);
    assert.equal(evaluacion.json.preguntas[0].enunciado, 'Nueva 1');
    assert.equal(evaluacion.json.resumen.intentos, 3);
    assert.equal(evaluacion.json.resumen.aprobada, true);
  });
});
