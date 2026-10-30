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
        'Cursos de un estado para Revisión de cursos (ADMIN)',
      description:
        'EN_REVISION, del más antiguo al más reciente; los demás estados, el modificado más recientemente primero. ' +
        'Como mucho 200. `conteos` trae cuántos cursos hay en cada estado (para las pestañas). Un parámetro de consulta ' +
        'desconocido o un `estado` fuera de la lista dan 400.',
      security: seguridad,
      parameters: [
        {
          in: 'query',
          name: 'estado',
          schema: {
            type: 'string',
            enum: ['EN_REVISION', 'PUBLICADO', 'SUSPENDIDO', 'RECHAZADO', 'BORRADOR'],
            default: 'EN_REVISION',
          },
        },
      ],
      responses: {
        ...comunes,
        200: json({
          type: 'object',
          required: ['items', 'conteos'],
          properties: {
            items: {
              type: 'array',
              items: ref('CursoRevision'),
            },
            conteos: {
              type: 'object',
              required: ['EN_REVISION', 'PUBLICADO', 'SUSPENDIDO', 'RECHAZADO', 'BORRADOR'],
              properties: Object.fromEntries(['EN_REVISION', 'PUBLICADO', 'SUSPENDIDO', 'RECHAZADO', 'BORRADOR']
                .map((e) => [e, { type: 'integer', minimum: 0 }])),
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

  '/admin/cursos/{id}/suspension': {
    post: {
      tags: ['Administración'],
      summary: 'Suspender un curso publicado (ADMIN)',
      description:
        'PUBLICADO → SUSPENDIDO con el motivo y la confirmación explícita `confirmo: true`. Sale del catálogo, sus ' +
        'inscritos no pueden abrirlo (lo ven marcado como suspendido en Mi aprendizaje y conservan su progreso) y el ' +
        'docente no puede editarlo. Avisa al docente por correo. Queda en la auditoría con el administrador como autor.',
      security: seguridad,
      parameters: [idRuta],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object', additionalProperties: false, required: ['motivo', 'confirmo'],
              properties: {
                motivo: { type: 'string', minLength: 1, maxLength: 300, description: 'Se recortan los espacios de los extremos.' },
                confirmo: { type: 'boolean', enum: [true] },
              },
            },
          },
        },
      },
      responses: {
        ...comunes,
        200: curso,
        ...erroresCuerpoJson(`Motivo vacío o largo, sin confirmar, o ${idInvalido}`),
        403: error('No es administrador (SIN_PERMISO)'),
        404: error('El curso no existe (NO_ENCONTRADO)'),
        409: error('El curso no está publicado (CURSO_NO_PUBLICADO) u otro administrador cambió su estado (CONFLICTO)'),
      },
    },
    delete: {
      tags: ['Administración'],
      summary: 'Reactivar un curso suspendido (ADMIN)',
      description:
        'SUSPENDIDO → PUBLICADO: vuelve al catálogo, conserva su revisor y su fecha de publicación, y sus inscritos ' +
        'recuperan el acceso. Avisa al docente por correo. Queda en la auditoría con el administrador como autor.',
      security: seguridad,
      parameters: [idRuta],
      responses: {
        ...comunes,
        200: curso,
        400: error(idInvalido),
        403: error('No es administrador (SIN_PERMISO)'),
        404: error('El curso no existe (NO_ENCONTRADO)'),
        409: error('El curso no está suspendido (CURSO_NO_SUSPENDIDO) u otro administrador cambió su estado (CONFLICTO)'),
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
        'Lecciones DOCUMENTO (su contenido) o VIDEO (material de apoyo), en cursos BORRADOR, RECHAZADO o PUBLICADO. Un PDF con páginas, sin cifrado, de 1 a 10485760 bytes. Se verifica su contenido. Límite: 30 subidas cada 15 minutos por IP (ADR-011, 11.4).',
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
        429: error('Demasiadas peticiones desde esta IP (DEMASIADAS_PETICIONES, encabezado Retry-After)'),
      },
    },
  },

  '/lecciones/{id}/recursos': {
    post: {
      tags: ['Contenido'],
      summary: 'Añadir un recurso descargable a la lección (DOCENTE propietario)',
      description:
        'Lecciones DOCUMENTO o VIDEO de un curso BORRADOR, RECHAZADO o PUBLICADO. PDF, PPT, PPTX o ZIP de 1 a 10485760 bytes; ' +
        'el contenido debe corresponder a la extensión. Hasta 5 recursos por lección. El título es el nombre del archivo sin la extensión. ' +
        'Comparte el límite de 30 subidas cada 15 minutos por IP con el PDF principal.',
      security: seguridad,
      parameters: [idRuta],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object', additionalProperties: false, required: ['archivo'],
              properties: { archivo: { type: 'string', format: 'binary', description: 'PDF, PPT, PPTX o ZIP de hasta 10 MiB' } },
            },
          },
        },
      },
      responses: {
        ...comunes,
        201: curso,
        400: error(`Formulario o archivo inválidos, más de 5 recursos o lección que no es DOCUMENTO ni VIDEO, o ${idInvalido}`),
        403: error('Sin rol DOCENTE o la lección no es de un curso propio (SIN_PERMISO)'),
        404: error('La lección no existe (NO_ENCONTRADO)'),
        409: error('Curso bloqueado (CURSO_BLOQUEADO)'),
        413: error('Supera 10 MiB (ARCHIVO_DEMASIADO_GRANDE)'),
        415: error('Extensión o formato de envío no admitido (TIPO_ARCHIVO_INVALIDO)'),
        429: error('Demasiadas peticiones desde esta IP (DEMASIADAS_PETICIONES, encabezado Retry-After)'),
      },
    },
  },
  '/recursos/{id}': {
    delete: {
      tags: ['Contenido'],
      summary: 'Quitar un recurso de la lección (DOCENTE propietario); su archivo se retira del disco',
      security: seguridad,
      parameters: [idRuta],
      responses: {
        ...comunes,
        200: curso,
        400: error(idInvalido),
        403: error('Sin rol DOCENTE o el recurso no es de un curso propio (SIN_PERMISO)'),
        404: error('El recurso no existe (NO_ENCONTRADO)'),
        409: error('Curso bloqueado (CURSO_BLOQUEADO)'),
      },
    },
  },
  '/archivos/{id}': {
    get: {
      tags: ['Contenido'],
      summary:
        'Descargar el PDF principal o un recurso de una lección (ADMIN, DOCENTE propietario o ESTUDIANTE inscrito)',
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
            'application/pdf': { schema: { type: 'string', format: 'binary' } },
            'application/vnd.ms-powerpoint': { schema: { type: 'string', format: 'binary' } },
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': { schema: { type: 'string', format: 'binary' } },
            'application/zip': { schema: { type: 'string', format: 'binary' } },
          },
        },
        400: error(idInvalido),
        403: error('Sin permiso sobre el curso del archivo (SIN_PERMISO)'),
        404: error('El archivo no existe o no es el PDF ni un recurso de una lección (NO_ENCONTRADO)'),
      },
    },
  },
};
