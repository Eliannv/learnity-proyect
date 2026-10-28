// Contrato de Aprendizaje · Sprint 3. Mantener en paridad con modules/aprendizaje.
import { error, errorInterno, erroresCuerpoJson, idInvalido, idRuta, json, ref, seguridad } from './openapi-comun.js';

const fecha = { type: 'string', format: 'date-time' };
const nullableFecha = { ...fecha, nullable: true };
const estado = { type: 'string', enum: ['ACTIVA', 'COMPLETADA'] };
const nivel = { type: 'string', enum: ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'] };
const entero = { type: 'integer', minimum: 0 };
const porcentaje = { type: 'integer', minimum: 0, maximum: 100 };
const idNulo = { type: 'integer', nullable: true };

export const esquemasAprendizaje = {
  InscripcionAprendizaje: {
    type: 'object', required: ['id', 'cursoId', 'estado', 'progresoPct', 'ultimaLeccionId', 'inscritoEn', 'completadoEn'],
    properties: {
      id: { type: 'integer' }, cursoId: { type: 'integer' }, estado, progresoPct: porcentaje,
      ultimaLeccionId: idNulo, inscritoEn: fecha, completadoEn: nullableFecha,
    },
  },
  FichaCursoAprendizaje: {
    type: 'object', required: ['id', 'titulo', 'subtitulo', 'portadaUrl', 'nivel', 'categoria', 'docente'],
    properties: {
      id: { type: 'integer' }, titulo: { type: 'string' }, subtitulo: { type: 'string', nullable: true },
      portadaUrl: { type: 'string', nullable: true }, nivel,
      categoria: { type: 'object', required: ['id', 'nombre'], properties: {
        id: { type: 'integer' }, nombre: { type: 'string' },
      } },
      docente: { type: 'string' },
    },
  },
  CursoInscrito: {
    type: 'object', required: ['curso', 'inscripcion', 'totalLecciones', 'leccionesCompletadas'],
    properties: {
      curso: ref('FichaCursoAprendizaje'), inscripcion: ref('InscripcionAprendizaje'),
      totalLecciones: entero, leccionesCompletadas: entero,
    },
  },
  LeccionAprendizaje: {
    type: 'object', required: ['id', 'orden', 'titulo', 'tipo', 'archivoId', 'youtubeVideoId', 'evaluacionId', 'recursos', 'progreso'],
    properties: {
      id: { type: 'integer' }, orden: { type: 'integer' }, titulo: { type: 'string' },
      tipo: { type: 'string', enum: ['DOCUMENTO', 'VIDEO', 'EVALUACION'] },
      archivoId: idNulo,
      youtubeVideoId: { type: 'string', nullable: true, minLength: 11, maxLength: 11,
        description: 'ID de YouTube de la lección VIDEO; null en los demás tipos.' },
      evaluacionId: { type: 'integer', nullable: true,
        description: 'Para `GET /evaluaciones/{id}` en una lección EVALUACION; null en los demás tipos.' },
      recursos: { type: 'array', description: 'Material descargable con `GET /archivos/{archivoId}`.', items: {
        type: 'object', required: ['id', 'titulo', 'archivoId', 'tipo', 'nombreOriginal', 'tamanoBytes'], properties: {
          id: { type: 'integer' }, titulo: { type: 'string' }, archivoId: { type: 'integer' },
          tipo: { type: 'string', enum: ['PDF', 'PPT', 'ZIP'] }, nombreOriginal: { type: 'string' }, tamanoBytes: entero,
        },
      } },
      progreso: { type: 'object', required: ['segundosVistos', 'completada'], properties: {
        segundosVistos: entero, completada: { type: 'boolean' },
      } },
    },
  },
  DetalleAprendizaje: {
    allOf: [ref('CursoInscrito'), { type: 'object', required: ['modulos'], properties: {
      modulos: { type: 'array', items: { type: 'object', required: ['id', 'orden', 'titulo', 'lecciones'], properties: {
        id: { type: 'integer' }, orden: { type: 'integer' }, titulo: { type: 'string' },
        lecciones: { type: 'array', items: ref('LeccionAprendizaje') },
      } } },
    } }],
  },
  ProgresoGuardado: {
    type: 'object', required: ['leccionId', 'segundosVistos', 'completada', 'progresoPct', 'estado', 'ultimaLeccionId'],
    properties: {
      leccionId: { type: 'integer' }, segundosVistos: entero, completada: { type: 'boolean' },
      progresoPct: porcentaje, estado, ultimaLeccionId: { type: 'integer' },
    },
  },
  SeguimientoDocente: {
    type: 'object', required: ['curso', 'items', 'pagina', 'limite', 'total', 'totalPaginas', 'resumen'],
    properties: {
      curso: { type: 'object', required: ['id', 'titulo'], properties: {
        id: { type: 'integer' }, titulo: { type: 'string' },
      } },
      items: { type: 'array', items: { type: 'object', required: [
        'idPersona', 'nombre', 'estado', 'progresoPct', 'ultimaLeccionId', 'inscritoEn', 'ultimaActividadEn',
      ], properties: {
        idPersona: { type: 'integer' }, nombre: { type: 'string' }, estado, progresoPct: porcentaje,
        ultimaLeccionId: idNulo, inscritoEn: fecha,
        ultimaActividadEn: fecha,
      } } },
      pagina: { type: 'integer' }, limite: { type: 'integer' }, total: entero, totalPaginas: entero,
      resumen: { type: 'object', required: ['inscritos', 'completados', 'progresoPromedio'], properties: {
        inscritos: entero, completados: entero, progresoPromedio: porcentaje,
      } },
    },
  },
};

export const rutasAprendizaje = {
  '/cursos/{id}/inscripcion': {
    post: {
      tags: ['Aprendizaje'], summary: 'Inscribirse en un curso publicado',
      description: 'Solo ESTUDIANTE. Idempotente: devuelve 201 al crear y 200 si ya estaba inscrito. Hasta 30 peticiones por IP y 15 minutos.',
      security: seguridad, parameters: [idRuta],
      responses: {
        201: json(ref('InscripcionAprendizaje'), 'Inscripción creada'),
        200: json(ref('InscripcionAprendizaje'), 'Ya inscrito; no se duplica'),
        400: error(idInvalido), 401: error('Sin sesión'), 403: error('Sin rol ESTUDIANTE'),
        404: error('Curso inexistente o no publicado'), 429: error('Límite de peticiones'), 500: errorInterno,
      },
    },
  },
  '/mi-aprendizaje': {
    get: {
      tags: ['Aprendizaje'], summary: 'Mis cursos inscritos que siguen publicados', security: seguridad,
      responses: {
        200: json({ type: 'object', required: ['items'], properties: {
          items: { type: 'array', items: ref('CursoInscrito') },
        } }),
        401: error('Sin sesión'), 403: error('Sin rol ESTUDIANTE'), 500: errorInterno,
      },
    },
  },
  '/mi-aprendizaje/cursos/{id}': {
    get: {
      tags: ['Aprendizaje'], summary: 'Temario privado y progreso de un curso inscrito',
      security: seguridad, parameters: [idRuta],
      responses: {
        200: json(ref('DetalleAprendizaje')),
        400: error(idInvalido), 401: error('Sin sesión'), 403: error('Sin rol ESTUDIANTE'),
        404: error('Curso no publicado o estudiante no inscrito'), 500: errorInterno,
      },
    },
  },
  '/lecciones/{id}/progreso': {
    put: {
      tags: ['Aprendizaje'], summary: 'Guardar posición o marcar completada una lección inscrita',
      description: 'Los segundos son una posición de reanudación declarada por el cliente, no prueba de visionado. La finalización no retrocede. ' +
        'Una lección EVALUACION no admite `completada` (400): se completa al aprobar un intento. Hasta 240 peticiones por IP y 15 minutos.',
      security: seguridad, parameters: [idRuta],
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', additionalProperties: false, minProperties: 1, properties: {
          segundosVistos: { type: 'integer', minimum: 0, maximum: 86_400 }, completada: { type: 'boolean' },
        },
      } } } },
      responses: {
        200: json(ref('ProgresoGuardado')),
        ...erroresCuerpoJson(`Datos de progreso inválidos, \`completada\` en una EVALUACION o ${idInvalido}`),
        401: error('Sin sesión'), 403: error('Sin rol ESTUDIANTE'),
        404: error('Lección no publicada o estudiante no inscrito'),
        429: error('Límite de peticiones'), 500: errorInterno,
      },
    },
  },
  '/docente/cursos/{id}/estudiantes': {
    get: {
      tags: ['Aprendizaje'], summary: 'Seguimiento de inscritos en un curso propio (o ADMIN)',
      description: 'Los cursos ajenos responden 404 para no revelar su existencia. No se entrega el correo del estudiante.',
      security: seguridad, parameters: [idRuta, {
        in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, maximum: 10_000, default: 1 },
      }, {
        in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      }],
      responses: {
        200: json(ref('SeguimientoDocente')),
        400: error('ID o paginación inválidos'), 401: error('Sin sesión'),
        403: error('Sin rol DOCENTE o ADMIN'), 404: error('Curso no disponible o ajeno'), 500: errorInterno,
      },
    },
  },
};
