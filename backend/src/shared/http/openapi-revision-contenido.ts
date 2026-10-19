const entero = {
  type: 'integer',
  minimum: 1,
};

const texto = {
  type: 'string',
};

const referencia = (nombre: string) => ({
  $ref: '#/components/schemas/' + nombre,
});

const json = (
  schema: unknown,
  description = 'Correcto',
) => ({
  description,
  content: {
    'application/json': {
      schema,
    },
  },
});

const seguridad = [{ bearer: [] }];

const id = {
  in: 'path',
  name: 'id',
  required: true,
  schema: {
    ...entero,
    maximum: 2_147_483_647,
  },
};

const estados = [
  'BORRADOR',
  'EN_REVISION',
  'PUBLICADO',
  'RECHAZADO',
  'ARCHIVADO',
];

export const esquemasRevisionContenido = {
  ArchivoPdf: {
    type: 'object',
    required: [
      'id',
      'tipo',
      'nombreOriginal',
      'tamanoBytes',
    ],
    properties: {
      id: entero,
      tipo: {
        type: 'string',
        enum: ['PDF'],
      },
      nombreOriginal: {
        ...texto,
        maxLength: 200,
      },
      tamanoBytes: {
        type: 'integer',
        minimum: 1,
        maximum: 10485760,
      },
    },
  },

  LeccionPrivada: {
    type: 'object',
    required: [
      'id',
      'titulo',
      'orden',
      'tipo',
      'archivo',
    ],
    properties: {
      id: entero,
      titulo: texto,
      orden: entero,
      tipo: {
        type: 'string',
        enum: [
          'DOCUMENTO',
          'VIDEO',
          'EVALUACION',
        ],
      },
      archivo: {
        type: 'object',
        nullable: true,
        allOf: [referencia('ArchivoPdf')],
      },
    },
  },

  ModuloPrivado: {
    type: 'object',
    required: [
      'id',
      'titulo',
      'orden',
      'lecciones',
    ],
    properties: {
      id: entero,
      titulo: texto,
      orden: entero,
      lecciones: {
        type: 'array',
        items: referencia('LeccionPrivada'),
      },
    },
  },

  ValidacionCurso: {
    type: 'object',
    required: ['completo', 'problemas'],
    properties: {
      completo: {
        type: 'boolean',
      },
      problemas: {
        type: 'array',
        items: {
          type: 'object',
          required: ['campo', 'mensaje'],
          properties: {
            campo: texto,
            mensaje: texto,
          },
        },
      },
    },
  },

  CursoResumen: {
    type: 'object',
    required: [
      'id',
      'titulo',
      'estado',
      'motivoRechazo',
      'docente',
      'modulos',
    ],
    properties: {
      id: entero,
      titulo: texto,
      estado: {
        type: 'string',
        enum: estados,
      },
      motivoRechazo: {
        type: 'string',
        nullable: true,
      },
      docente: texto,
      modulos: {
        type: 'integer',
        minimum: 0,
      },
    },
  },

  CursoDetalle: {
    type: 'object',
    required: [
      'id',
      'titulo',
      'subtitulo',
      'descripcion',
      'categoriaId',
      'categoriaNombre',
      'nivel',
      'portadaUrl',
      'objetivos',
      'requisitos',
      'estado',
      'motivoRechazo',
      'docente',
      'modulos',
      'validacion',
    ],
    properties: {
      id: entero,
      titulo: texto,
      subtitulo: texto,
      descripcion: texto,
      categoriaId: entero,
      categoriaNombre: texto,
      nivel: {
        type: 'string',
        enum: [
          'PRINCIPIANTE',
          'INTERMEDIO',
          'AVANZADO',
        ],
      },
      portadaUrl: texto,
      objetivos: {
        type: 'array',
        items: texto,
      },
      requisitos: {
        type: 'array',
        items: texto,
      },
      estado: {
        type: 'string',
        enum: estados,
      },
      motivoRechazo: {
        type: 'string',
        nullable: true,
      },
      docente: texto,
      modulos: {
        type: 'array',
        items: referencia('ModuloPrivado'),
      },
      validacion: referencia('ValidacionCurso'),
    },
  },

  ErrorIntegrante3: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['codigo', 'mensaje'],
        properties: {
          codigo: texto,
          mensaje: texto,
          detalles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                campo: texto,
                mensaje: texto,
              },
            },
          },
        },
      },
    },
  },
};

const fallo = (mensaje: string) =>
  json(
    referencia('ErrorIntegrante3'),
    mensaje,
  );

const comunes = {
  400: fallo('Petición inválida'),
  401: fallo('Sesión ausente o inválida'),
  403: fallo('Sin permiso'),
  404: fallo('Recurso inexistente'),
  500: fallo('Fallo inesperado'),
};

const curso = json(
  referencia('CursoDetalle'),
  'Curso completo, directamente en la raíz',
);

export const rutasRevisionContenido = {
  '/admin/cursos': {
    get: {
      tags: ['Administración'],
      summary:
        'Cursos pendientes de revisión (ADMIN)',
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
              items: referencia('CursoResumen'),
            },
          },
        }),
      },
    },
  },

  '/admin/cursos/{id}': {
    get: {
      tags: ['Administración'],
      summary:
        'Detalle privado, incluso si ya fue decidido (ADMIN)',
      security: seguridad,
      parameters: [id],
      responses: {
        ...comunes,
        200: curso,
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
      parameters: [id],
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
        409: fallo(
          'Curso ya decidido, bloqueado o incompleto al aprobar',
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
      parameters: [id],
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
        409: fallo('Curso bloqueado'),
        413: fallo('Supera 10 MiB'),
        415: fallo(
          'Tipo o formato de envío no admitido',
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
      parameters: [id],
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
      },
    },
  },
};