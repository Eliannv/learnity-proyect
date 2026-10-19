// OpenAPI · Revisión administrativa de cursos y contenido PDF.
// Los modelos del curso (CursoResumen, CursoDetalle…) están en openapi-gestion-cursos.ts.
import { error, errorInterno, erroresCuerpoJson, idInvalido, idRuta, json, ref, seguridad } from './openapi-comun.js';

const curso = json(
  ref('CursoDetalle'),
  'Curso completo, directamente en la raíz',
);

const comunes = {
  401: error('Sesión ausente, inválida o revocada'),
  500: errorInterno,
};

export const rutasRevisionContenido = {
  '/admin/cursos': {
    get: {
      tags: ['Administración'],
      summary:
        'Cursos pendientes de revisión (ADMIN)',
      description:
        'Ordenados del más antiguo al más reciente. Un parámetro de consulta desconocido o un `estado` distinto de EN_REVISION dan 400.',
      security: seguridad,
      parameters: [
        {
          in: 'query',
          name: 'estado',
          schema: {
            type: 'string',
            enum: ['EN_REVISION'],
            default: 'EN_REVISION',
          },
        },
      ],
      responses: {
        ...comunes,
        200: json({
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: ref('CursoResumen'),
            },
          },
        }),
        400: error('Filtro inválido (SOLICITUD_INVALIDA)'),
        403: error('No es administrador (SIN_PERMISO)'),
      },
    },
  },

  '/admin/cursos/{id}': {
    get: {
      tags: ['Administración'],
      summary:
        'Detalle privado, incluso si ya fue decidido (ADMIN)',
      security: seguridad,
      parameters: [idRuta],
      responses: {
        ...comunes,
        200: curso,
        400: error(idInvalido),
        403: error('No es administrador (SIN_PERMISO)'),
        404: error('El curso no existe (NO_ENCONTRADO)'),
      },
    },
  },

  '/admin/cursos/{id}/revision': {
    put: {
      tags: ['Administración'],
      summary:
        'Aprobar o rechazar una revisión pendiente (ADMIN)',
      description:
        'La operación es atómica; una segunda decisión responde 409. Aprobar revalida el contenido y sus PDF.',
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
                  properties: {
                    decision: {
                      type: 'string',
                      enum: ['APROBAR'],
                    },
                  },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'decision',
                    'motivo',
                  ],
                  properties: {
                    decision: {
                      type: 'string',
                      enum: ['RECHAZAR'],
                    },
                    motivo: {
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
        ...comunes,
        200: curso,
        ...erroresCuerpoJson(`Decisión inválida (SOLICITUD_INVALIDA) o ${idInvalido}`),
        403: error('No es administrador (SIN_PERMISO)'),
        404: error('El curso no existe (NO_ENCONTRADO)'),
        409: error(
          'Curso ya decidido (CONFLICTO) o incompleto al aprobar (CURSO_INCOMPLETO, con los problemas en detalles)',
        ),
      },
    },
  },

  '/lecciones/{id}/archivo': {
    post: {
      tags: ['Contenido'],
      summary:
        'Subir o reemplazar el PDF principal (DOCENTE propietario)',
      description:
        'Solo DOCUMENTO y cursos BORRADOR o RECHAZADO. Un PDF con páginas, sin cifrado, de 1 a 10485760 bytes. Se verifica su contenido.',
      security: seguridad,
      parameters: [idRuta],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['archivo'],
              properties: {
                archivo: {
                  type: 'string',
                  format: 'binary',
                  description:
                    'PDF de hasta 10 MiB',
                },
              },
            },
          },
        },
      },
      responses: {
        ...comunes,
        200: curso,
        400: error(`Formulario o PDF inválidos, o lección que no es DOCUMENTO (SOLICITUD_INVALIDA), o ${idInvalido}`),
        403: error('Sin rol DOCENTE o la lección no es de un curso propio (SIN_PERMISO)'),
        404: error('La lección no existe (NO_ENCONTRADO)'),
        409: error('Curso bloqueado (CURSO_BLOQUEADO)'),
        413: error('Supera 10 MiB (ARCHIVO_DEMASIADO_GRANDE)'),
        415: error(
          'Tipo o formato de envío no admitido (TIPO_ARCHIVO_INVALIDO)',
        ),
      },
    },
  },

  '/archivos/{id}': {
    get: {
      tags: ['Contenido'],
      summary:
        'Descargar PDF privado (ADMIN o DOCENTE propietario)',
      security: seguridad,
      parameters: [idRuta],
      responses: {
        ...comunes,
        200: {
          description:
            'Bytes del PDF, sin publicar su ruta física',
          headers: {
            'Cache-Control': {
              schema: {
                type: 'string',
                example: 'private, no-store',
              },
            },
            'Content-Disposition': {
              description: 'Descarga con el nombre original del PDF.',
              schema: {
                type: 'string',
                example: 'attachment; filename="tema-1.pdf"',
              },
            },
          },
          content: {
            'application/pdf': {
              schema: {
                type: 'string',
                format: 'binary',
              },
            },
          },
        },
        400: error(idInvalido),
        403: error('Sin permiso sobre el curso del archivo (SIN_PERMISO)'),
        404: error('El archivo no existe o no es un PDF de una lección (NO_ENCONTRADO)'),
      },
    },
  },
};
