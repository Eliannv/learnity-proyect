// Contrato de Reseñas. Mantener en paridad con modules/resenas.
import { error, errorInterno, erroresCuerpoJson, idInvalido, idRuta, json, ref, seguridad } from './openapi-comun.js';

const fecha = { type: 'string', format: 'date-time' };
const sinInscripcion = error('Sin rol ESTUDIANTE, o no está inscrito en el curso publicado (NO_INSCRITO)');

export const esquemasResenas = {
  Resena: {
    type: 'object', required: ['id', 'autor', 'fotoUrl', 'estrellas', 'comentario', 'creadoEn', 'actualizadoEn'],
    properties: {
      id: { type: 'integer' },
      autor: { type: 'string', description: 'Nombre y la inicial del apellido; nunca el correo.' },
      fotoUrl: { type: 'string', nullable: true },
      estrellas: { type: 'integer', minimum: 1, maximum: 5 },
      comentario: { type: 'string', nullable: true },
      creadoEn: fecha, actualizadoEn: fecha,
    },
  },
  PaginaResenas: {
    type: 'object', required: ['resumen', 'items', 'pagina', 'limite', 'total', 'totalPaginas'],
    properties: {
      resumen: {
        type: 'object', required: ['promedio', 'total', 'distribucion'],
        properties: {
          promedio: { type: 'number', nullable: true, minimum: 1, maximum: 5, description: 'Un decimal; null sin reseñas.' },
          total: { type: 'integer', minimum: 0 },
          distribucion: {
            type: 'array', minItems: 5, maxItems: 5, items: { type: 'integer', minimum: 0 },
            description: 'Reseñas con 1, 2, 3, 4 y 5 estrellas, en ese orden.',
          },
        },
      },
      items: { type: 'array', items: ref('Resena') },
      pagina: { type: 'integer' }, limite: { type: 'integer' },
      total: { type: 'integer', minimum: 0 }, totalPaginas: { type: 'integer', minimum: 0 },
    },
  },
  MiResena: {
    type: 'object', required: ['puedeResenar', 'resena'],
    properties: {
      puedeResenar: { type: 'boolean', description: 'Inscrito en el curso publicado.' },
      resena: { nullable: true, allOf: [ref('Resena')] },
    },
  },
  DatosResena: {
    type: 'object', additionalProperties: false, required: ['estrellas'],
    properties: {
      estrellas: { type: 'integer', minimum: 1, maximum: 5 },
      comentario: { type: 'string', nullable: true, maxLength: 1000, description: 'Vacío o solo espacios se guarda como null.' },
    },
  },
};

export const rutasResenas = {
  '/cursos/{id}/resenas': {
    get: {
      tags: ['Reseñas'], summary: 'Reseñas públicas de un curso publicado, con su promedio y distribución',
      description: 'Primero las que tienen comentario y, dentro de ellas, las más recientes.',
      parameters: [idRuta,
        { in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, maximum: 10_000, default: 1 } },
        { in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } }],
      responses: {
        200: json(ref('PaginaResenas')),
        400: error('ID o paginación inválidos'), 404: error('El curso no existe o no está publicado'), 500: errorInterno,
      },
    },
  },
  '/cursos/{id}/resena': {
    get: {
      tags: ['Reseñas'], summary: 'Mi reseña del curso y si puedo escribirla', security: seguridad, parameters: [idRuta],
      responses: {
        200: json(ref('MiResena')), 400: error(idInvalido), 401: error('Sin sesión'), 403: error('Sin rol ESTUDIANTE'),
        500: errorInterno,
      },
    },
    put: {
      tags: ['Reseñas'], summary: 'Escribir o reemplazar mi reseña (una por inscripción)',
      description: 'Hasta 30 peticiones por IP y 15 minutos.',
      security: seguridad, parameters: [idRuta],
      requestBody: { required: true, content: { 'application/json': { schema: ref('DatosResena') } } },
      responses: {
        200: json(ref('Resena')),
        ...erroresCuerpoJson(`Estrellas fuera de 1 a 5, comentario de más de 1000 caracteres o ${idInvalido}`),
        401: error('Sin sesión'), 403: sinInscripcion, 429: error('Límite de peticiones'), 500: errorInterno,
      },
    },
    delete: {
      tags: ['Reseñas'], summary: 'Borrar mi reseña', security: seguridad, parameters: [idRuta],
      responses: {
        204: { description: 'Reseña borrada' }, 400: error(idInvalido), 401: error('Sin sesión'), 403: sinInscripcion,
        404: error('Todavía no hay reseña propia'), 500: errorInterno,
      },
    },
  },
};
