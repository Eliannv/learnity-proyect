// Contrato de Reseñas. Mantener en paridad con modules/resenas.
import { error, errorInterno, erroresCuerpoJson, idInvalido, idRuta, json, ref, seguridad } from './openapi-comun.js';

const fecha = { type: 'string', format: 'date-time' };
const fechaNula = { ...fecha, nullable: true };
const cursoRef = { type: 'object', required: ['id', 'titulo'], properties: { id: { type: 'integer' }, titulo: { type: 'string' } } };
const cursoDocenteOpcion = {
  type: 'object',
  required: ['id', 'titulo'],
  properties: {
    id: { type: 'integer' },
    titulo: { type: 'string' },
    estado: { type: 'string', nullable: true },
    portadaUrl: { type: 'string', nullable: true },
    iconoCategoria: { type: 'string', nullable: true },
  },
};
const respuesta = {
  type: 'object', nullable: true, required: ['texto', 'fecha'], description: 'Respuesta pública del docente; null si no respondió.',
  properties: { texto: { type: 'string', maxLength: 1000 }, fecha },
};
const motivo = { type: 'string', enum: ['SPAM', 'OFENSIVO', 'OTRO'] };
const estadoReporte = { type: 'string', enum: ['PENDIENTE', 'OCULTADA', 'DESESTIMADA'] };
const resumen = {
  type: 'object', required: ['promedio', 'total', 'distribucion'],
  properties: {
    promedio: { type: 'number', nullable: true, minimum: 1, maximum: 5, description: 'Un decimal; null sin reseñas.' },
    total: { type: 'integer', minimum: 0 },
    distribucion: {
      type: 'array', minItems: 5, maxItems: 5, items: { type: 'integer', minimum: 0 },
      description: 'Reseñas con 1, 2, 3, 4 y 5 estrellas, en ese orden.',
    },
  },
};
const ocultacion = {
  type: 'object', nullable: true, required: ['fecha', 'motivo', 'por'],
  description: 'Ocultación por un administrador; null si la reseña no está oculta.',
  properties: {
    fecha, motivo: { type: 'string', maxLength: 300 },
    por: {
      type: 'object', nullable: true, required: ['id', 'nombre'], description: 'null si se borró la cuenta del administrador.',
      properties: { id: { type: 'integer' }, nombre: { type: 'string' } },
    },
  },
};
const idResena = { in: 'path', name: 'id', required: true, description: 'ID de la reseña', schema: { type: 'integer', minimum: 1 } };
const resenaAjena = error('La reseña no existe, está borrada o no es de un curso propio');
const sinInscripcion = error('Sin rol ESTUDIANTE, o no está inscrito en el curso publicado (NO_INSCRITO)');

export const esquemasResenas = {
  Resena: {
    type: 'object',
    required: ['id', 'autor', 'fotoUrl', 'estrellas', 'comentario', 'creadoEn', 'actualizadoEn', 'editado', 'respuesta'],
    properties: {
      id: { type: 'integer' },
      autor: { type: 'string', description: 'Nombre y la inicial del apellido; nunca el correo.' },
      fotoUrl: { type: 'string', nullable: true },
      estrellas: { type: 'integer', minimum: 1, maximum: 5 },
      comentario: { type: 'string', nullable: true },
      creadoEn: fecha, actualizadoEn: fecha,
      editado: { type: 'boolean', description: 'Cambió estrellas o comentario después de publicarla.' },
      respuesta,
    },
  },
  PaginaResenas: {
    type: 'object', required: ['resumen', 'items', 'pagina', 'limite', 'total', 'totalPaginas'],
    properties: {
      resumen,
      items: { type: 'array', items: ref('Resena') },
      pagina: { type: 'integer' }, limite: { type: 'integer' },
      total: { type: 'integer', minimum: 0 }, totalPaginas: { type: 'integer', minimum: 0 },
    },
  },
  MiResena: {
    type: 'object', required: ['puedeResenar', 'resena', 'ocultada'],
    properties: {
      puedeResenar: { type: 'boolean', description: 'Inscrito en el curso publicado y su reseña no está ocultada.' },
      resena: { nullable: true, allOf: [ref('Resena')] },
      ocultada: {
        type: 'boolean',
        description: 'Un administrador ocultó su reseña: no puede editarla ni republicarla. El motivo es interno.',
      },
    },
  },
  DatosResena: {
    type: 'object', additionalProperties: false, required: ['estrellas'],
    properties: {
      estrellas: { type: 'integer', minimum: 1, maximum: 5 },
      comentario: { type: 'string', nullable: true, maxLength: 1000, description: 'Vacío o solo espacios se guarda como null.' },
    },
  },
  ResenaDocente: {
    type: 'object', description: 'Reseña de un curso propio vista por el docente: sin IPs ni detalles técnicos de auditoría.',
    required: ['id', 'curso', 'estudiante', 'fotoUrl', 'estrellas', 'estrellasOriginales', 'comentario', 'creadoEn',
      'editado', 'editadoEn', 'progresoAlResenar', 'respuesta', 'reporte'],
    properties: {
      id: { type: 'integer' }, curso: cursoRef, estudiante: { type: 'string' }, fotoUrl: { type: 'string', nullable: true },
      estrellas: { type: 'integer', minimum: 1, maximum: 5 },
      estrellasOriginales: { type: 'integer', minimum: 1, maximum: 5, description: 'Con las que la publicó.' },
      comentario: { type: 'string', nullable: true }, creadoEn: fecha,
      editado: { type: 'boolean' }, editadoEn: fechaNula,
      progresoAlResenar: { type: 'integer', minimum: 0, maximum: 100, description: 'Avance (%) del estudiante al publicarla.' },
      respuesta,
      reporte: {
        type: 'object', nullable: true, required: ['estado', 'motivo'], description: 'Último reporte del docente.',
        properties: { estado: estadoReporte, motivo },
      },
    },
  },
  BandejaResenas: {
    type: 'object',
    required: ['cursos', 'resumen', 'evolucion', 'items', 'pagina', 'limite', 'total', 'totalPaginas'],
    properties: {
      cursos: { type: 'array', items: cursoDocenteOpcion },
      resumen: { allOf: [resumen, {
        type: 'object', required: ['sinResponder'], properties: { sinResponder: { type: 'integer', minimum: 0 } },
      }] },
      evolucion: {
        type: 'array', description: 'Últimos 12 meses con reseñas.',
        items: {
          type: 'object', required: ['mes', 'total', 'promedio', 'promedioAcumulado'],
          properties: {
            mes: { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}$' }, total: { type: 'integer', minimum: 1 },
            promedio: { type: 'number' }, promedioAcumulado: { type: 'number' },
          },
        },
      },
      items: { type: 'array', items: ref('ResenaDocente') },
      pagina: { type: 'integer' }, limite: { type: 'integer' },
      total: { type: 'integer', minimum: 0 }, totalPaginas: { type: 'integer', minimum: 0 },
    },
  },
  DatosRespuestaResena: {
    type: 'object', additionalProperties: false, required: ['texto'],
    properties: { texto: { type: 'string', minLength: 1, maxLength: 1000 } },
  },
  DatosReporteResena: {
    type: 'object', additionalProperties: false, required: ['motivo'],
    properties: { motivo, detalle: { type: 'string', nullable: true, maxLength: 500 } },
  },
  EntradaHistorialResena: {
    type: 'object',
    required: ['accion', 'fecha', 'actor', 'estrellasAnterior', 'estrellasNueva', 'comentarioAnterior', 'comentarioNuevo',
      'motivo'],
    properties: {
      accion: { type: 'string', enum: ['CREADA', 'EDITADA', 'ELIMINADA', 'REPUBLICADA', 'RESPONDIDA_POR_DOCENTE',
        'OCULTADA', 'RESTAURADA', 'RESPUESTA_RETIRADA'] },
      fecha,
      actor: {
        type: 'object', nullable: true, required: ['id', 'nombre'],
        properties: { id: { type: 'integer' }, nombre: { type: 'string' } },
      },
      estrellasAnterior: { type: 'integer', nullable: true }, estrellasNueva: { type: 'integer', nullable: true },
      comentarioAnterior: { type: 'string', nullable: true }, comentarioNuevo: { type: 'string', nullable: true },
      motivo: { type: 'string', nullable: true, description: 'Motivo de la ocultación (solo en OCULTADA).' },
    },
  },
  ResenaAdmin: {
    type: 'object',
    required: ['id', 'curso', 'estudiante', 'estrellas', 'comentario', 'creadoEn', 'eliminadaEn', 'ocultacion',
      'respuesta', 'reportesPendientes', 'historial'],
    properties: {
      id: { type: 'integer' }, curso: cursoRef, estudiante: { type: 'string' },
      estrellas: { type: 'integer', minimum: 1, maximum: 5 }, comentario: { type: 'string', nullable: true },
      creadoEn: fecha, eliminadaEn: { ...fechaNula, description: 'Borrada por su autor.' }, ocultacion, respuesta,
      reportesPendientes: { type: 'integer', minimum: 0 },
      historial: { type: 'array', items: ref('EntradaHistorialResena') },
    },
  },
  PaginaResenasAdmin: {
    type: 'object', required: ['cursos', 'items', 'pagina', 'limite', 'total', 'totalPaginas'],
    properties: {
      cursos: { type: 'array', items: cursoRef, description: 'Cursos con alguna reseña, para el filtro por curso.' },
      items: { type: 'array', items: ref('ResenaAdmin') },
      pagina: { type: 'integer' }, limite: { type: 'integer' },
      total: { type: 'integer', minimum: 0 }, totalPaginas: { type: 'integer', minimum: 0 },
    },
  },
  ReporteResena: {
    type: 'object',
    required: ['id', 'motivo', 'detalle', 'estado', 'creadoEn', 'resueltoEn', 'reportadoPor', 'resena', 'historial'],
    properties: {
      id: { type: 'integer' }, motivo, detalle: { type: 'string', nullable: true }, estado: estadoReporte,
      creadoEn: fecha, resueltoEn: fechaNula, reportadoPor: { type: 'string' },
      resena: {
        type: 'object',
        required: ['id', 'curso', 'estudiante', 'estrellas', 'comentario', 'eliminadaEn', 'ocultacion', 'respuesta'],
        properties: {
          id: { type: 'integer' }, curso: cursoRef, estudiante: { type: 'string' },
          estrellas: { type: 'integer', minimum: 1, maximum: 5 }, comentario: { type: 'string', nullable: true },
          eliminadaEn: fechaNula, ocultacion, respuesta,
        },
      },
      historial: { type: 'array', items: ref('EntradaHistorialResena') },
    },
  },
  DatosOcultacionResena: {
    type: 'object', additionalProperties: false, required: ['motivo'],
    properties: {
      motivo: { type: 'string', minLength: 1, maxLength: 300, description: 'Motivo interno; el estudiante no lo ve.' },
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
        401: error('Sin sesión'), 403: sinInscripcion,
        409: error('Un administrador ocultó la reseña: no se puede editar ni republicar (RESENA_OCULTADA)'),
        429: error('Límite de peticiones'), 500: errorInterno,
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
  '/docente/resenas': {
    get: {
      tags: ['Reseñas'], summary: 'Bandeja de reseñas de los cursos propios, con resumen y evolución mensual',
      description: 'De la más reciente a la más antigua. Solo reseñas vigentes (no borradas).',
      security: seguridad,
      parameters: [
        { in: 'query', name: 'curso', description: 'Solo este curso propio.', schema: { type: 'integer', minimum: 1 } },
        { in: 'query', name: 'estrellas', schema: { type: 'integer', minimum: 1, maximum: 5 } },
        { in: 'query', name: 'comentario', schema: { type: 'string', enum: ['con', 'sin'] } },
        { in: 'query', name: 'respuesta', schema: { type: 'string', enum: ['respondidas', 'sin-responder'] } },
        {
          in: 'query', name: 'categoria', description: 'Parte del nombre de la categoría del curso (sin distinguir mayúsculas).',
          schema: { type: 'string', maxLength: 80 },
        },
        {
          in: 'query', name: 'q', description: 'Nombre del estudiante, comentario o respuesta (sin distinguir mayúsculas).',
          schema: { type: 'string', maxLength: 100 },
        },
        { in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, maximum: 10_000, default: 1 } },
        { in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
      ],
      responses: {
        200: json(ref('BandejaResenas')), 400: error('Filtros inválidos'), 401: error('Sin sesión'),
        403: error('Sin rol DOCENTE'), 404: error('El curso no existe o no es propio'), 500: errorInterno,
      },
    },
  },
  '/docente/valoracion': {
    get: {
      tags: ['Reseñas'], summary: 'Valoración global del docente (reseñas vigentes de sus cursos publicados)',
      security: seguridad,
      responses: {
        200: json(ref('CalificacionCurso')), 401: error('Sin sesión'), 403: error('Sin rol DOCENTE'), 500: errorInterno,
      },
    },
  },
  '/docente/resenas/{id}/respuesta': {
    put: {
      tags: ['Reseñas'], summary: 'Responder públicamente una reseña de un curso propio (o reemplazar la respuesta)',
      description: 'Hasta 60 peticiones por IP y 15 minutos.',
      security: seguridad, parameters: [idResena],
      requestBody: { required: true, content: { 'application/json': { schema: ref('DatosRespuestaResena') } } },
      responses: {
        200: json(ref('ResenaDocente')),
        ...erroresCuerpoJson(`Respuesta vacía o de más de 1000 caracteres, o ${idInvalido}`),
        401: error('Sin sesión'), 403: error('Sin rol DOCENTE'), 404: resenaAjena, 429: error('Límite de peticiones'),
        500: errorInterno,
      },
    },
    delete: {
      tags: ['Reseñas'], summary: 'Retirar la respuesta pública', security: seguridad, parameters: [idResena],
      responses: {
        200: json(ref('ResenaDocente')), 400: error(idInvalido), 401: error('Sin sesión'), 403: error('Sin rol DOCENTE'),
        404: resenaAjena, 500: errorInterno,
      },
    },
  },
  '/docente/resenas/{id}/reporte': {
    post: {
      tags: ['Reseñas'], summary: 'Reportar una reseña al administrador (spam, lenguaje ofensivo u otro)',
      description: 'Como mucho un reporte pendiente por reseña. Hasta 20 peticiones por IP y 15 minutos.',
      security: seguridad, parameters: [idResena],
      requestBody: { required: true, content: { 'application/json': { schema: ref('DatosReporteResena') } } },
      responses: {
        201: json(ref('ResenaDocente')),
        ...erroresCuerpoJson(`Motivo inválido, detalle de más de 500 caracteres o ${idInvalido}`),
        401: error('Sin sesión'), 403: error('Sin rol DOCENTE'), 404: resenaAjena,
        409: error('Ya hay un reporte pendiente (REPORTE_PENDIENTE)'), 429: error('Límite de peticiones'), 500: errorInterno,
      },
    },
  },
  '/admin/resenas': {
    get: {
      tags: ['Reseñas'], summary: 'Todas las reseñas (también las borradas y ocultadas) con su historial completo',
      description: 'Acceso total del administrador para moderar. De la más reciente a la más antigua.',
      security: seguridad,
      parameters: [
        {
          in: 'query', name: 'estado',
          description: 'vigentes: se ven en el curso; borradas: por su autor; ocultadas: por un administrador.',
          schema: { type: 'string', enum: ['vigentes', 'borradas', 'ocultadas', 'todas'], default: 'todas' },
        },
        { in: 'query', name: 'curso', schema: { type: 'integer', minimum: 1 } },
        { in: 'query', name: 'estrellas', schema: { type: 'integer', minimum: 1, maximum: 5 } },
        {
          in: 'query', name: 'categoria', description: 'Parte del nombre de la categoría del curso (sin distinguir mayúsculas).',
          schema: { type: 'string', maxLength: 80 },
        },
        {
          in: 'query', name: 'q',
          description: 'Texto en el comentario, en la respuesta del docente o en el nombre del estudiante (sin distinguir mayúsculas).',
          schema: { type: 'string', maxLength: 100 },
        },
        { in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, maximum: 10_000, default: 1 } },
        { in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
      ],
      responses: {
        200: json(ref('PaginaResenasAdmin')), 400: error('Filtros inválidos'), 401: error('Sin sesión'),
        403: error('Sin rol ADMIN'), 500: errorInterno,
      },
    },
  },
  '/admin/resenas/reportes': {
    get: {
      tags: ['Reseñas'], summary: 'Reportes de reseñas con el historial completo de cada una (hasta 100)',
      security: seguridad,
      parameters: [
        { in: 'query', name: 'estado', schema: { ...estadoReporte, default: 'PENDIENTE' } },
        { in: 'query', name: 'curso', schema: { type: 'integer', minimum: 1 } },
        { in: 'query', name: 'estrellas', schema: { type: 'integer', minimum: 1, maximum: 5 } },
        {
          in: 'query', name: 'categoria', description: 'Parte del nombre de la categoría del curso (sin distinguir mayúsculas).',
          schema: { type: 'string', maxLength: 80 },
        },
        {
          in: 'query', name: 'q',
          description: 'Texto en el comentario, en la respuesta del docente o en el nombre del estudiante (sin distinguir mayúsculas).',
          schema: { type: 'string', maxLength: 100 },
        },
      ],
      responses: {
        200: json({ type: 'array', items: ref('ReporteResena') }), 400: error('Estado inválido'),
        401: error('Sin sesión'), 403: error('Sin rol ADMIN'), 500: errorInterno,
      },
    },
  },
  '/admin/resenas/reportes/{id}': {
    put: {
      tags: ['Reseñas'], summary: 'Resolver un reporte: ocultar la reseña o desestimarlo',
      security: seguridad,
      parameters: [{ in: 'path', name: 'id', required: true, description: 'ID del reporte', schema: { type: 'integer', minimum: 1 } }],
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', additionalProperties: false, required: ['decision'],
        properties: { decision: { type: 'string', enum: ['OCULTAR', 'DESESTIMAR'] } },
      } } } },
      responses: {
        204: { description: 'Reporte resuelto' }, ...erroresCuerpoJson(`Decisión inválida o ${idInvalido}`),
        401: error('Sin sesión'), 403: error('Sin rol ADMIN'), 404: error('El reporte no existe o ya fue resuelto'),
        500: errorInterno,
      },
    },
  },
  '/admin/resenas/{id}/historial': {
    get: {
      tags: ['Reseñas'], summary: 'Historial completo de una reseña (auditoría), incluidas las borradas',
      security: seguridad, parameters: [idResena],
      responses: {
        200: json({ type: 'array', items: ref('EntradaHistorialResena') }), 400: error(idInvalido),
        401: error('Sin sesión'), 403: error('Sin rol ADMIN'), 500: errorInterno,
      },
    },
  },
  '/admin/resenas/{id}/ocultacion': {
    post: {
      tags: ['Reseñas'], summary: 'Ocultar una reseña con un motivo, sin necesidad de reporte',
      description: 'Deja de verse y de contar en los promedios, y el estudiante no puede republicarla. '
        + 'Sus reportes pendientes quedan resueltos como OCULTADA.',
      security: seguridad, parameters: [idResena],
      requestBody: { required: true, content: { 'application/json': { schema: ref('DatosOcultacionResena') } } },
      responses: {
        200: json(ref('ResenaAdmin')), ...erroresCuerpoJson(`Motivo vacío o de más de 300 caracteres, o ${idInvalido}`),
        401: error('Sin sesión'), 403: error('Sin rol ADMIN'), 404: error('La reseña no existe'),
        409: error('Ya está oculta (RESENA_YA_OCULTADA)'), 500: errorInterno,
      },
    },
    delete: {
      tags: ['Reseñas'], summary: 'Restaurar una reseña ocultada', security: seguridad, parameters: [idResena],
      responses: {
        200: json(ref('ResenaAdmin')), 400: error(idInvalido), 401: error('Sin sesión'), 403: error('Sin rol ADMIN'),
        404: error('La reseña no existe'), 409: error('No está oculta (RESENA_NO_OCULTADA)'), 500: errorInterno,
      },
    },
  },
  '/admin/resenas/{id}/respuesta': {
    delete: {
      tags: ['Reseñas'], summary: 'Retirar la respuesta pública del docente (queda en el historial como RESPUESTA_RETIRADA)',
      security: seguridad, parameters: [idResena],
      responses: {
        200: json(ref('ResenaAdmin')), 400: error(idInvalido), 401: error('Sin sesión'), 403: error('Sin rol ADMIN'),
        404: error('La reseña no existe'), 409: error('No tiene respuesta del docente (SIN_RESPUESTA)'), 500: errorInterno,
      },
    },
  },
};
