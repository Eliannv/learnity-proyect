// OpenAPI · Gestión privada de cursos del docente y modelos privados del curso
// (cursos-privados.model.ts), que también usa la revisión administrativa.
import { error, errorInterno, erroresCuerpoJson, idInvalido, idRuta, json, ref, seguridad } from './openapi-comun.js';

const entero = {
  type: 'integer',
  minimum: 1,
};

const texto = {
  type: 'string',
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
  description: 'Se recortan los espacios de los extremos antes de validar.',
};

const listaTextos = {
  type: 'array',
  maxItems: 10,
  default: [],
  items: { type: 'string', minLength: 1, maxLength: 200 },
};

const cuerpo = (schema: unknown) => ({
  required: true,
  content: {
    'application/json': { schema },
  },
});

const errores = {
  400: error(`Datos inválidos (SOLICITUD_INVALIDA) o ${idInvalido}`),
  401: error('Sin sesión, token inválido o sesión revocada'),
  403: error('Sin rol DOCENTE, sin perfil docente activo o el curso no es del docente (SIN_PERMISO)'),
  404: error('El curso, el módulo o la lección no existe (NO_ENCONTRADO)'),
  409: error('El curso no está en BORRADOR ni en RECHAZADO (CURSO_BLOQUEADO) u otro conflicto'),
};

type CodigoError = keyof typeof errores;

const operacion = (
  summary: string,
  status: 200 | 201,
  schema: unknown,
  codigos: CodigoError[],
  requestBody?: unknown,
  /** Causa del 400 si la operación no tiene `{id}` (por defecto, la de `errores`). */
  causa400 = errores[400].description,
) => ({
  tags: ['Gestión de cursos'],
  summary,
  security: seguridad,
  ...(requestBody ? { requestBody } : {}),
  responses: {
    [status]: json(schema),
    ...Object.fromEntries(codigos.map((codigo) => [codigo, codigo === 400 ? error(causa400) : errores[codigo]])),
    // Con cuerpo JSON, el 400 suma el JSON mal formado y se declaran el 413 y el 415 (ADR-011, 11.6).
    ...(requestBody ? erroresCuerpoJson(causa400) : {}),
    500: errorInterno,
  },
});

const todos: CodigoError[] = [400, 401, 403, 404, 409];

const detalle = ref('CursoDetalle');

export const esquemasGestionCursos = {
  DatosCurso: {
    type: 'object',
    additionalProperties: false,
    required: ['titulo', 'categoriaId', 'nivel'],
    description: 'En `PUT /cursos/{id}` el curso se reemplaza entero: los campos omitidos toman su valor por defecto.',
    properties: {
      titulo,
      subtitulo: { type: 'string', maxLength: 200, default: '' },
      descripcion: { type: 'string', maxLength: 10000, default: '' },
      categoriaId: { ...entero, description: 'Categoría existente y activa (si no, 400).' },
      nivel,
      portadaUrl: {
        type: 'string',
        maxLength: 255,
        default: '',
        description:
          'Vacía, una ruta propia que empieza por `/` (sin `//`, `\\`, `..`, espacios, `?` ni `#`) ' +
          'o una URL `http(s)` con host y sin usuario ni contraseña.',
      },
      objetivos: listaTextos,
      requisitos: listaTextos,
    },
  },

  DatosModulo: {
    type: 'object',
    additionalProperties: false,
    required: ['titulo', 'orden'],
    description: 'Un curso tiene como máximo 10 módulos y cada orden se usa una sola vez (si no, 400).',
    properties: {
      titulo,
      orden: { type: 'integer', minimum: 1, maximum: 10 },
    },
  },

  DatosLeccion: {
    type: 'object',
    additionalProperties: false,
    required: ['titulo', 'orden', 'tipo'],
    description:
      'Un módulo tiene como máximo 12 lecciones y cada orden se usa una sola vez (si no, 400). ' +
      'Solo se editan lecciones DOCUMENTO.',
    properties: {
      titulo,
      orden: { type: 'integer', minimum: 1, maximum: 12 },
      tipo: { type: 'string', enum: ['DOCUMENTO'] },
    },
  },

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
        allOf: [ref('ArchivoPdf')],
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
        items: ref('LeccionPrivada'),
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
        items: ref('ProblemaCampo'),
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
      estado,
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
      subtitulo: { ...texto, description: 'Cadena vacía si no tiene.' },
      descripcion: { ...texto, description: 'Cadena vacía si no tiene.' },
      categoriaId: entero,
      categoriaNombre: texto,
      nivel,
      portadaUrl: { ...texto, description: 'Cadena vacía si no tiene.' },
      objetivos: {
        type: 'array',
        items: texto,
      },
      requisitos: {
        type: 'array',
        items: texto,
      },
      estado,
      motivoRechazo: {
        type: 'string',
        nullable: true,
      },
      docente: texto,
      modulos: {
        type: 'array',
        items: ref('ModuloPrivado'),
      },
      validacion: ref('ValidacionCurso'),
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
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: ref('CursoResumen'),
          },
        },
      },
      [401, 403],
    ),
  },

  '/docente/cursos/{id}': {
    get: {
      ...operacion(
        'Consultar el detalle de un curso propio',
        200,
        detalle,
        [400, 401, 403, 404],
      ),
      parameters: [idRuta],
    },
  },

  '/cursos': {
    post: operacion(
      'Crear curso en estado BORRADOR',
      201,
      detalle,
      [400, 401, 403],
      cuerpo(ref('DatosCurso')),
      'Datos inválidos (SOLICITUD_INVALIDA)',
    ),
  },

  '/cursos/{id}': {
    put: {
      ...operacion(
        'Actualizar un curso BORRADOR o RECHAZADO',
        200,
        detalle,
        todos,
        cuerpo(ref('DatosCurso')),
      ),
      parameters: [idRuta],
    },
  },

  '/cursos/{id}/modulos': {
    post: {
      ...operacion(
        'Crear módulo dentro de un curso propio',
        201,
        detalle,
        todos,
        cuerpo(ref('DatosModulo')),
      ),
      parameters: [idRuta],
    },
  },

  '/modulos/{id}': {
    put: {
      ...operacion(
        'Actualizar un módulo',
        200,
        detalle,
        todos,
        cuerpo(ref('DatosModulo')),
      ),
      parameters: [idRuta],
    },
    delete: {
      ...operacion(
        'Eliminar un módulo y coordinar limpieza de PDF',
        200,
        detalle,
        todos,
      ),
      parameters: [idRuta],
    },
  },

  '/modulos/{id}/lecciones': {
    post: {
      ...operacion(
        'Crear una lección DOCUMENTO',
        201,
        detalle,
        todos,
        cuerpo(ref('DatosLeccion')),
      ),
      parameters: [idRuta],
    },
  },

  '/lecciones/{id}': {
    put: {
      ...operacion(
        'Actualizar una lección DOCUMENTO',
        200,
        detalle,
        todos,
        cuerpo(ref('DatosLeccion')),
      ),
      parameters: [idRuta],
    },
    delete: {
      ...operacion(
        'Eliminar una lección y coordinar limpieza de PDF',
        200,
        detalle,
        todos,
      ),
      parameters: [idRuta],
    },
  },

  '/cursos/{id}/enviar-revision': {
    post: {
      ...operacion(
        'Validar y enviar curso a revisión administrativa',
        200,
        detalle,
        todos,
      ),
      description:
        'Exige curso completo, docente propietario y estado BORRADOR ' +
        'o RECHAZADO. Si faltan requisitos devuelve 400 con detalles. ' +
        'Si es válido cambia el estado a EN_REVISION en una transacción.',
      parameters: [idRuta],
    },
  },
};
