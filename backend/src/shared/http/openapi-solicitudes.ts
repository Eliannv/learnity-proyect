// OpenAPI · Solicitudes para ser docente (RF-05 estudiante, RF-22 administrador).

const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` });
const json = (schema: unknown, description = 'Correcto') => ({ description, content: { 'application/json': { schema } } });
const error = (description: string) => json(ref('ErrorApi'), description);
const seguridad = [{ bearer: [] }];

export const esquemasSolicitudes = {
  ErrorApi: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: { codigo: { type: 'string' }, mensaje: { type: 'string' }, detalles: {} },
      },
    },
  },
  SolicitudDocente: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 4 },
      estado: { type: 'string', enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'] },
      especialidad: { type: 'string', example: 'Programación web' },
      motivo: { type: 'string' },
      observacion: { type: 'string', nullable: true, description: 'Motivo del rechazo (solo RECHAZADA).' },
      enviadaEn: { type: 'string', format: 'date-time' },
      revisadaEn: { type: 'string', format: 'date-time', nullable: true },
      solicitante: {
        type: 'object',
        properties: {
          nombres: { type: 'string' },
          apellidos: { type: 'string' },
          correo: { type: 'string' },
          estudianteDesde: { type: 'string', format: 'date-time' },
          cursosCompletados: { type: 'integer' },
        },
      },
    },
  },
};

export const rutasSolicitudes = {
  '/solicitudes-docente': {
    post: {
      tags: ['Solicitudes de docente'],
      summary: 'Enviar la solicitud para ser docente (estudiante)',
      description: 'Solo una solicitud pendiente por cuenta. Tras un rechazo se puede enviar otra. Límite: 10 por hora por IP.',
      security: seguridad,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['especialidad', 'motivo'],
              properties: {
                especialidad: { type: 'string', minLength: 3, maxLength: 100 },
                motivo: { type: 'string', minLength: 50, maxLength: 2000 },
              },
            },
          },
        },
      },
      responses: {
        201: json(ref('SolicitudDocente'), 'Solicitud creada'),
        400: error('Datos inválidos'),
        401: error('Sin sesión'),
        409: error('YA_ES_DOCENTE o SOLICITUD_PENDIENTE'),
        429: error('Demasiadas peticiones'),
      },
    },
  },
  '/solicitudes-docente/mia': {
    get: {
      tags: ['Solicitudes de docente'],
      summary: 'Estado de mi última solicitud',
      security: seguridad,
      responses: {
        200: json({ type: 'object', properties: { solicitud: { ...ref('SolicitudDocente'), nullable: true } } }),
        401: error('Sin sesión'),
      },
    },
  },
  '/admin/solicitudes': {
    get: {
      tags: ['Solicitudes de docente'],
      summary: 'Listar solicitudes por estado (administrador)',
      security: seguridad,
      parameters: [
        { name: 'estado', in: 'query', schema: { type: 'string', enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'], default: 'PENDIENTE' } },
      ],
      responses: {
        200: json({ type: 'array', items: ref('SolicitudDocente') }),
        401: error('Sin sesión'),
        403: error('No es administrador'),
      },
    },
  },
  '/admin/solicitudes/{id}': {
    put: {
      tags: ['Solicitudes de docente'],
      summary: 'Aprobar o rechazar una solicitud (administrador)',
      description:
        'APROBAR agrega el rol DOCENTE (conserva ESTUDIANTE) y crea el perfil docente; el rol llega a la sesión del ' +
        'estudiante en su próxima renovación. RECHAZAR exige `observacion` (máximo 300 caracteres).',
      security: seguridad,
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              oneOf: [
                { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['APROBAR'] } } },
                {
                  type: 'object',
                  required: ['decision', 'observacion'],
                  properties: { decision: { type: 'string', enum: ['RECHAZAR'] }, observacion: { type: 'string', maxLength: 300 } },
                },
              ],
            },
          },
        },
      },
      responses: {
        200: json(ref('SolicitudDocente'), 'Solicitud decidida'),
        400: error('Datos inválidos'),
        403: error('No es administrador o es su propia solicitud'),
        404: error('No existe'),
        409: error('SOLICITUD_YA_REVISADA'),
      },
    },
  },
};
