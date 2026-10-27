// OpenAPI · Solicitudes para ser docente (RF-05 estudiante, RF-22 administrador).
import { error, errorInterno, erroresCuerpoJson, idInvalido, idRuta, json, ref, seguridad } from './openapi-comun.js';

const ESTADOS = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

export const esquemasSolicitudes = {
  SolicitudDocente: {
    type: 'object',
    required: ['id', 'estado', 'especialidad', 'motivo', 'observacion', 'enviadaEn', 'revisadaEn', 'solicitante'],
    properties: {
      id: { type: 'integer', example: 4 },
      estado: { type: 'string', enum: ESTADOS },
      especialidad: { type: 'string', example: 'Programación web' },
      motivo: { type: 'string' },
      observacion: { type: 'string', nullable: true, description: 'Motivo del rechazo (solo RECHAZADA).' },
      enviadaEn: { type: 'string', format: 'date-time' },
      revisadaEn: { type: 'string', format: 'date-time', nullable: true },
      solicitante: {
        type: 'object',
        required: ['nombres', 'apellidos', 'correo', 'estudianteDesde', 'cursosCompletados'],
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
  UsuarioAdmin: {
    type: 'object',
    required: ['id', 'idPersona', 'nombre', 'nombres', 'apellidos', 'correo', 'roles', 'activo', 'estado', 'creadoEn'],
    properties: {
      id: { type: 'integer', example: 3 },
      idPersona: { type: 'integer', example: 3 },
      nombre: { type: 'string', example: 'Rosa Vera Chávez' },
      nombres: { type: 'string', example: 'Rosa' },
      apellidos: { type: 'string', example: 'Vera Chávez' },
      correo: { type: 'string', format: 'email', example: 'rosa.vera@correo.com' },
      ciudad: { type: 'string', nullable: true, example: 'Machala' },
      fotoUrl: { type: 'string', nullable: true, example: null },
      roles: {
        type: 'array',
        items: { type: 'string', enum: ['ESTUDIANTE', 'DOCENTE', 'ADMIN'] },
        example: ['ESTUDIANTE'],
      },
      activo: { type: 'boolean', example: true },
      estado: { type: 'string', enum: ['ACTIVO', 'INACTIVO'], example: 'ACTIVO' },
      creadoEn: { type: 'string', format: 'date-time' },
      ultimoAcceso: { type: 'string', format: 'date-time', nullable: true },
    },
  },
  RespuestaUsuariosAdmin: {
    type: 'object',
    required: ['items', 'paginacion', 'conteos'],
    properties: {
      items: { type: 'array', items: ref('UsuarioAdmin') },
      paginacion: {
        type: 'object',
        required: ['total', 'pagina', 'limite', 'totalPaginas'],
        properties: {
          total: { type: 'integer', example: 12 },
          pagina: { type: 'integer', example: 1 },
          limite: { type: 'integer', example: 20 },
          totalPaginas: { type: 'integer', example: 1 },
        },
      },
      conteos: {
        type: 'object',
        required: ['total', 'estudiantes', 'docentes', 'administradores'],
        properties: {
          total: { type: 'integer', example: 12 },
          estudiantes: { type: 'integer', example: 12 },
          docentes: { type: 'integer', example: 2 },
          administradores: { type: 'integer', example: 1 },
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
              additionalProperties: false,
              required: ['especialidad', 'motivo'],
              description: 'Se recortan los espacios de los extremos antes de validar.',
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
        ...erroresCuerpoJson('Datos inválidos'),
        401: error('Sin sesión'),
        403: error('La cuenta no tiene el rol ESTUDIANTE (SIN_PERMISO)'),
        409: error('YA_ES_DOCENTE o SOLICITUD_PENDIENTE'),
        429: error('Demasiadas peticiones'),
        500: errorInterno,
      },
    },
  },
  '/solicitudes-docente/mia': {
    get: {
      tags: ['Solicitudes de docente'],
      summary: 'Estado de mi última solicitud',
      security: seguridad,
      responses: {
        200: json({
          type: 'object',
          required: ['solicitud'],
          properties: { solicitud: { ...ref('SolicitudDocente'), nullable: true } },
        }),
        401: error('Sin sesión'),
        500: errorInterno,
      },
    },
  },
  '/admin/solicitudes': {
    get: {
      tags: ['Solicitudes de docente'],
      summary: 'Listar solicitudes por estado (administrador)',
      description:
        'Devuelve como máximo 200, sin paginar. Las pendientes, de la más antigua a la más reciente; ' +
        'las revisadas, de la más reciente a la más antigua. Un parámetro de consulta desconocido da 400.',
      security: seguridad,
      parameters: [
        { name: 'estado', in: 'query', schema: { type: 'string', enum: ESTADOS, default: 'PENDIENTE' } },
      ],
      responses: {
        200: json({ type: 'array', maxItems: 200, items: ref('SolicitudDocente') }),
        400: error('Estado o parámetro de consulta inválido (SOLICITUD_INVALIDA)'),
        401: error('Sin sesión'),
        403: error('No es administrador'),
        500: errorInterno,
      },
    },
  },
  '/admin/solicitudes/{id}': {
    put: {
      tags: ['Solicitudes de docente'],
      summary: 'Aprobar o rechazar una solicitud (administrador)',
      description:
        'APROBAR agrega el rol DOCENTE (conserva ESTUDIANTE) y crea el perfil docente; el rol se aplica de inmediato ' +
        'en la siguiente petición autenticada (ADR-011, 11.10). RECHAZAR exige `observacion` (máximo 300 caracteres).',
      security: seguridad,
      parameters: [idRuta],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['decision'],
                  properties: { decision: { type: 'string', enum: ['APROBAR'] } },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['decision', 'observacion'],
                  properties: {
                    decision: { type: 'string', enum: ['RECHAZAR'] },
                    observacion: {
                      type: 'string',
                      minLength: 1,
                      maxLength: 300,
                      description: 'Se recortan los espacios de los extremos antes de validar.',
                    },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        200: json(ref('SolicitudDocente'), 'Solicitud decidida'),
        ...erroresCuerpoJson(`Datos inválidos o ${idInvalido}`),
        401: error('Sin sesión'),
        403: error('No es administrador o es su propia solicitud'),
        404: error('No existe'),
        409: error('SOLICITUD_YA_REVISADA'),
        500: errorInterno,
      },
    },
  },
  '/admin/usuarios': {
    get: {
      tags: ['Usuarios'],
      summary: 'Listar usuarios con filtros y conteos (administrador)',
      security: seguridad,
      parameters: [
        { name: 'q', in: 'query', schema: { type: 'string', maxLength: 100 } },
        { name: 'rol', in: 'query', schema: { type: 'string', enum: ['ESTUDIANTE', 'DOCENTE', 'ADMIN'] } },
        { name: 'estado', in: 'query', schema: { type: 'string', enum: ['ACTIVO', 'INACTIVO'] } },
        { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
        { name: 'limite', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        200: json(ref('RespuestaUsuariosAdmin'), 'Lista de usuarios'),
        400: error('Parámetros de consulta inválidos'),
        401: error('Sin sesión'),
        403: error('No es administrador'),
        500: errorInterno,
      },
    },
  },
  '/admin/usuarios/{id}/estado': {
    put: {
      tags: ['Usuarios'],
      summary: 'Activar o desactivar usuario (administrador)',
      description: 'Al desactivar, revoca de inmediato todas las sesiones activas de la cuenta.',
      security: seguridad,
      parameters: [idRuta],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                activo: { type: 'boolean' },
                estado: { type: 'string', enum: ['ACTIVO', 'INACTIVO'] },
              },
            },
          },
        },
      },
      responses: {
        200: json(ref('UsuarioAdmin'), 'Estado actualizado'),
        400: error('No puede desactivarse a sí mismo o al único admin activo'),
        401: error('Sin sesión'),
        403: error('No es administrador'),
        404: error('Usuario no encontrado'),
        500: errorInterno,
      },
    },
  },
  '/admin/usuarios/{id}/roles': {
    put: {
      tags: ['Usuarios'],
      summary: 'Actualizar roles de usuario (administrador)',
      description: 'Toda cuenta debe conservar el rol ESTUDIANTE.',
      security: seguridad,
      parameters: [idRuta],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['roles'],
              properties: {
                roles: {
                  type: 'array',
                  items: { type: 'string', enum: ['ESTUDIANTE', 'DOCENTE', 'ADMIN'] },
                },
              },
            },
          },
        },
      },
      responses: {
        200: json(ref('UsuarioAdmin'), 'Roles actualizados'),
        400: error('No puede quitarse el rol admin a sí mismo o al único admin activo'),
        401: error('Sin sesión'),
        403: error('No es administrador'),
        404: error('Usuario no encontrado'),
        500: errorInterno,
      },
    },
  },
};
