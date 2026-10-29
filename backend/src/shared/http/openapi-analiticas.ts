// Contrato de Analíticas del docente. Mantener en paridad con modules/analiticas.
import { error, errorInterno, json, ref, seguridad } from './openapi-comun.js';

const entero = { type: 'integer', minimum: 0 };
const mes = { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}$' };
const dias = { type: 'number', nullable: true, minimum: 0, description: 'Dos decimales; null si nadie completó.' };

export const esquemasAnaliticas = {
  Analiticas: {
    type: 'object', required: ['cursos', 'resumen', 'actividad', 'conversion', 'embudo', 'porCurso'],
    properties: {
      cursos: { type: 'array', items: {
        type: 'object', required: ['id', 'titulo'], properties: { id: { type: 'integer' }, titulo: { type: 'string' } },
      } },
      resumen: {
        type: 'object', required: ['inscritos', 'completados', 'diasPromedioFinalizacion', 'diasMedianaFinalizacion'],
        properties: {
          inscritos: entero, completados: entero,
          diasPromedioFinalizacion: { ...dias, description: 'Días promedio entre inscribirse y completar.' },
          diasMedianaFinalizacion: dias,
        },
      },
      actividad: {
        type: 'array', minItems: 12, maxItems: 12, description: 'Últimos 12 meses, incluidos los que no tuvieron movimiento.',
        items: { type: 'object', required: ['mes', 'inscripciones', 'completados'], properties: {
          mes, inscripciones: entero, completados: entero,
        } },
      },
      conversion: {
        type: 'object', required: ['dias', 'visitas', 'inscripciones', 'tasaPct'],
        properties: {
          dias: { type: 'integer', minimum: 1 },
          visitas: { ...entero, description: 'Vistas de la ficha pública (cada carga cuenta; no son visitantes únicos).' },
          inscripciones: entero,
          tasaPct: { type: 'number', nullable: true, minimum: 0, description: 'inscripciones / visitas en %; null sin visitas.' },
        },
      },
      embudo: {
        type: 'array', nullable: true, description: 'Solo con un curso elegido: lecciones en el orden del temario.',
        items: { type: 'object', required: ['leccionId', 'modulo', 'titulo', 'tipo', 'completaron'], properties: {
          leccionId: { type: 'integer' }, modulo: { type: 'string' }, titulo: { type: 'string' },
          tipo: { type: 'string', enum: ['VIDEO', 'DOCUMENTO', 'EVALUACION'] }, completaron: entero,
        } },
      },
      porCurso: {
        type: 'array', nullable: true, description: 'Solo sin curso elegido.',
        items: { type: 'object', required: ['id', 'titulo', 'inscritos', 'completados'], properties: {
          id: { type: 'integer' }, titulo: { type: 'string' }, inscritos: entero, completados: entero,
        } },
      },
    },
  },
};

export const rutasAnaliticas = {
  '/docente/analiticas': {
    get: {
      tags: ['Analíticas'], summary: 'Rendimiento de los cursos propios: actividad, finalización, conversión y embudo',
      security: seguridad,
      parameters: [{ in: 'query', name: 'curso', description: 'Solo este curso propio; activa el embudo por lección.',
        schema: { type: 'integer', minimum: 1 } }],
      responses: {
        200: json(ref('Analiticas')), 400: error('Curso inválido'), 401: error('Sin sesión'),
        403: error('Sin rol DOCENTE'), 404: error('El curso no existe o no es propio'), 500: errorInterno,
      },
    },
  },
};
