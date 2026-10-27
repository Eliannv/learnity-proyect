// Contrato de Evaluaciones del estudiante. Mantener en paridad con modules/evaluaciones.
// El docente edita las preguntas desde Gestión de cursos (`/lecciones/{id}/evaluacion`).
import { error, errorInterno, erroresCuerpoJson, idInvalido, idRuta, json, ref, seguridad } from './openapi-comun.js';

const letra = { type: 'string', enum: ['A', 'B', 'C', 'D'] };
const puntaje = { type: 'number', minimum: 0, maximum: 100, description: 'Porcentaje con hasta dos decimales.' };

export const esquemasEvaluaciones = {
  ResumenIntentos: {
    type: 'object', required: ['intentos', 'mejorPuntaje', 'ultimoPuntaje', 'aprobada'],
    properties: {
      intentos: { type: 'integer', minimum: 0 },
      mejorPuntaje: { ...puntaje, nullable: true }, ultimoPuntaje: { ...puntaje, nullable: true },
      aprobada: { type: 'boolean', description: 'Aprobada en al menos un intento.' },
    },
  },
  EvaluacionEstudiante: {
    type: 'object', required: ['id', 'leccionId', 'titulo', 'porcentajeAprobacion', 'preguntas', 'resumen'],
    description: 'Nunca incluye cuál es la opción correcta.',
    properties: {
      id: { type: 'integer' }, leccionId: { type: 'integer' }, titulo: { type: 'string' },
      porcentajeAprobacion: { type: 'integer', minimum: 1, maximum: 100 },
      preguntas: { type: 'array', items: { type: 'object', required: ['id', 'orden', 'enunciado', 'opciones'], properties: {
        id: { type: 'integer' }, orden: { type: 'integer' }, enunciado: { type: 'string' },
        opciones: { type: 'array', items: ref('OpcionEvaluacion') },
      } } },
      resumen: ref('ResumenIntentos'),
    },
  },
  ResultadoIntento: {
    type: 'object', required: ['intento', 'respuestas', 'resumen', 'progresoPct', 'estado'],
    properties: {
      intento: { type: 'object', required: ['id', 'puntaje', 'aprobado', 'correctas', 'total', 'realizadoEn'], properties: {
        id: { type: 'integer' }, puntaje, aprobado: { type: 'boolean' },
        correctas: { type: 'integer', minimum: 0 }, total: { type: 'integer', minimum: 1 },
        realizadoEn: { type: 'string', format: 'date-time' },
      } },
      respuestas: {
        type: 'array', description: 'Si cada respuesta fue correcta; no revela la opción correcta de las falladas.',
        items: { type: 'object', required: ['preguntaId', 'opcion', 'correcta'], properties: {
          preguntaId: { type: 'integer' }, opcion: letra, correcta: { type: 'boolean' },
        } },
      },
      resumen: ref('ResumenIntentos'),
      progresoPct: { type: 'integer', minimum: 0, maximum: 100 },
      estado: { type: 'string', enum: ['ACTIVA', 'COMPLETADA'] },
    },
  },
};

export const rutasEvaluaciones = {
  '/evaluaciones/{id}': {
    get: {
      tags: ['Evaluaciones'], summary: 'Preguntas de una evaluación de un curso inscrito, sin las respuestas correctas',
      security: seguridad, parameters: [idRuta],
      responses: {
        200: json(ref('EvaluacionEstudiante')),
        400: error(idInvalido), 401: error('Sin sesión'), 403: error('Sin rol ESTUDIANTE'),
        404: error('Evaluación inexistente o incompleta, curso no publicado o estudiante no inscrito'), 500: errorInterno,
      },
    },
  },
  '/evaluaciones/{id}/intentos': {
    post: {
      tags: ['Evaluaciones'], summary: 'Responder una evaluación: el servidor califica y guarda el intento',
      description: 'Intentos ilimitados. Aprueba con `porcentajeAprobacion` (60 % por defecto) y entonces marca la lección como ' +
        'completada. Suspender no bloquea el resto del curso. Hasta 60 peticiones por IP y 15 minutos.',
      security: seguridad, parameters: [idRuta],
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', additionalProperties: false, required: ['respuestas'], properties: {
          respuestas: { type: 'array', minItems: 1, maxItems: 10, items: {
            type: 'object', additionalProperties: false, required: ['preguntaId', 'opcion'], properties: {
              preguntaId: { type: 'integer', minimum: 1 }, opcion: letra,
            },
          } },
        },
      } } } },
      responses: {
        201: json(ref('ResultadoIntento'), 'Intento calificado y guardado'),
        ...erroresCuerpoJson(`Falta alguna pregunta, una pregunta repetida o de otra evaluación, o ${idInvalido}`),
        401: error('Sin sesión'), 403: error('Sin rol ESTUDIANTE'),
        404: error('Evaluación inexistente o incompleta, curso no publicado o estudiante no inscrito'),
        429: error('Límite de peticiones'), 500: errorInterno,
      },
    },
  },
};
