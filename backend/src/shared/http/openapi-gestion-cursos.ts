
const ref = (nombre: string) => ({
  $ref: '#/components/schemas/' + nombre,
});

const seguridad = [{ bearer: [] }];

const id = {
  name: 'id',
  in: 'path',
  required: true,
  schema: {
    type: 'integer',
    minimum: 1,
    maximum: 2147483647,
  },
};

const json = (schema: unknown, description = 'Correcto') => ({
  description,
  content: {
    'application/json': { schema },
  },
});

const cuerpo = (schema: unknown) => ({
  required: true,
  content: {
    'application/json': { schema },
  },
});

const errores = {
  400: json(ref('ErrorApiIntegrante2'), 'Datos inválidos'),
  401: json(ref('ErrorApiIntegrante2'), 'Sin autenticación'),
  403: json(ref('ErrorApiIntegrante2'), 'Sin permiso'),
  404: json(ref('ErrorApiIntegrante2'), 'Recurso inexistente'),
  409: json(ref('ErrorApiIntegrante2'), 'Conflicto o curso bloqueado'),
};

const nivel = {
  type: 'string',
  enum: ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'],
};

const estado = {
  type: 'string',
  enum: [
    'BORRADOR',
    'EN_REVISION',
    'PUBLICADO',
    'RECHAZADO',
    'ARCHIVADO',
  ],
};

const titulo = {
  type: 'string',
  minLength: 1,
  maxLength: 150,
};

const datosCurso = ref('DatosCursoIntegrante2');
const datosModulo = ref('DatosModuloIntegrante2');
const datosLeccion = ref('DatosLeccionIntegrante2');
const detalle = ref('CursoDetalleIntegrante2');

const operacion = (
  summary: string,
  status: 200 | 201,
  schema: unknown,
  requestBody?: unknown,
) => ({
  tags: ['Gestión de cursos - Integrante 2'],
  summary,
  security: seguridad,
  ...(requestBody ? { requestBody } : {}),
  responses: {
    [status]: json(schema),
    ...errores,
  },
});

export const esquemasGestionCursos = {
  ErrorApiIntegrante2: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          codigo: { type: 'string' },
          mensaje: { type: 'string' },
          detalles: {},
        },
      },
    },
  },

  DatosCursoIntegrante2: {
    type: 'object',
    required: ['titulo', 'categoriaId', 'nivel'],
    properties: {
      titulo,
      subtitulo: { type: 'string', maxLength: 200 },
      descripcion: { type: 'string', maxLength: 10000 },
      categoriaId: { type: 'integer', minimum: 1 },
      nivel,
      portadaUrl: { type: 'string', maxLength: 255 },
      objetivos: {
        type: 'array',
        maxItems: 10,
        items: { type: 'string', minLength: 1, maxLength: 200 },
      },
      requisitos: {
        type: 'array',
        maxItems: 10,
        items: { type: 'string', minLength: 1, maxLength: 200 },
      },
    },
  },

  DatosModuloIntegrante2: {
    type: 'object',
    required: ['titulo', 'orden'],
    properties: {
      titulo,
      orden: { type: 'integer', minimum: 1, maximum: 10 },
    },
  },

  DatosLeccionIntegrante2: {
    type: 'object',
    required: ['titulo', 'orden', 'tipo'],
    properties: {
      titulo,
      orden: { type: 'integer', minimum: 1, maximum: 12 },
      tipo: { type: 'string', enum: ['DOCUMENTO'] },
    },
  },

  CursoResumenIntegrante2: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      titulo: { type: 'string' },
      estado,
      motivoRechazo: { type: 'string', nullable: true },
      docente: { type: 'string' },
      modulos: { type: 'integer' },
    },
  },

  CursoDetalleIntegrante2: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      titulo,
      subtitulo: { type: 'string' },
      descripcion: { type: 'string' },
      categoriaId: { type: 'integer' },
      categoriaNombre: { type: 'string' },
      nivel,
      portadaUrl: { type: 'string' },
      objetivos: {
        type: 'array',
        items: { type: 'string' },
      },
      requisitos: {
        type: 'array',
        items: { type: 'string' },
      },
      estado,
      motivoRechazo: { type: 'string', nullable: true },
      docente: { type: 'string' },
      modulos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            titulo: { type: 'string' },
            orden: { type: 'integer' },
            lecciones: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  titulo: { type: 'string' },
                  orden: { type: 'integer' },
                  tipo: {
                    type: 'string',
                    enum: ['DOCUMENTO', 'VIDEO', 'EVALUACION'],
                  },
                  archivo: {
                    nullable: true,
                    allOf: [{
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        tipo: { type: 'string', enum: ['PDF'] },
                        nombreOriginal: { type: 'string' },
                        tamanoBytes: { type: 'integer' },
                      },
                    }],
                  },
                },
              },
            },
          },
        },
      },
      validacion: {
        type: 'object',
        properties: {
          completo: { type: 'boolean' },
          problemas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                campo: { type: 'string' },
                mensaje: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

export const rutasGestionCursos = {
  '/docente/cursos': {
    get: operacion(
      'Listar los cursos del docente autenticado',
      200,
      {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: ref('CursoResumenIntegrante2'),
          },
        },
      },
    ),
  },

  '/docente/cursos/{id}': {
    get: {
      ...operacion(
        'Consultar el detalle de un curso propio',
        200,
        detalle,
      ),
      parameters: [id],
    },
  },

  '/cursos': {
    post: operacion(
      'Crear curso en estado BORRADOR',
      201,
      detalle,
      cuerpo(datosCurso),
    ),
  },

  '/cursos/{id}': {
    put: {
      ...operacion(
        'Actualizar un curso BORRADOR o RECHAZADO',
        200,
        detalle,
        cuerpo(datosCurso),
      ),
      parameters: [id],
    },
  },

  '/cursos/{id}/modulos': {
    post: {
      ...operacion(
        'Crear módulo dentro de un curso propio',
        201,
        detalle,
        cuerpo(datosModulo),
      ),
      parameters: [id],
    },
  },

  '/modulos/{id}': {
    put: {
      ...operacion(
        'Actualizar un módulo',
        200,
        detalle,
        cuerpo(datosModulo),
      ),
      parameters: [id],
    },
    delete: {
      ...operacion(
        'Eliminar un módulo y coordinar limpieza de PDF',
        200,
        detalle,
      ),
      parameters: [id],
    },
  },

  '/modulos/{id}/lecciones': {
    post: {
      ...operacion(
        'Crear una lección DOCUMENTO',
        201,
        detalle,
        cuerpo(datosLeccion),
      ),
      parameters: [id],
    },
  },

  '/lecciones/{id}': {
    put: {
      ...operacion(
        'Actualizar una lección DOCUMENTO',
        200,
        detalle,
        cuerpo(datosLeccion),
      ),
      parameters: [id],
    },
    delete: {
      ...operacion(
        'Eliminar una lección y coordinar limpieza de PDF',
        200,
        detalle,
      ),
      parameters: [id],
    },
  },

  '/cursos/{id}/enviar-revision': {
    post: {
      ...operacion(
        'Validar y enviar curso a revisión administrativa',
        200,
        detalle,
      ),
      description:
        'Exige curso completo, docente propietario y estado BORRADOR ' +
        'o RECHAZADO. Si faltan requisitos devuelve 400 con detalles. ' +
        'Si es válido cambia el estado a EN_REVISION en una transacción.',
      parameters: [id],
    },
  },
};
