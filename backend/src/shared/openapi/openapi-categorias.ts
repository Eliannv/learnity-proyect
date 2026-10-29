// Contrato de Categorías (administración, ADR-012). Mantener en paridad con modules/categorias.
import { error, errorInterno, erroresCuerpoJson, idInvalido, idRuta, json, ref, seguridad } from './openapi-comun.js';

const nombre = {
  type: 'string', minLength: 1, maxLength: 80,
  description: 'Se recortan los espacios y se normaliza a NFC. Único sin distinguir mayúsculas.',
};
const descripcion = {
  type: 'string', nullable: true, maxLength: 300,
  description: 'Vacía o ausente se guarda como null.',
};
const duplicada = error('Ya existe una categoría con ese nombre, sin distinguir mayúsculas (CATEGORIA_DUPLICADA)');
const comunes = { 401: error('Sin sesión'), 403: error('Sin rol ADMIN') };

export const esquemasCategorias = {
  CategoriaAdmin: {
    type: 'object', required: ['id', 'nombre', 'descripcion', 'activa', 'cursos', 'cursosPublicados'],
    properties: {
      id: { type: 'integer' }, nombre: { type: 'string' }, descripcion: { type: 'string', nullable: true },
      activa: { type: 'boolean' },
      cursos: { type: 'integer', minimum: 0, description: 'Cursos de cualquier estado con esta categoría.' },
      cursosPublicados: { type: 'integer', minimum: 0 },
    },
  },
  DatosCategoriaNueva: {
    type: 'object', additionalProperties: false, required: ['nombre'],
    properties: { nombre, descripcion },
  },
  DatosCategoria: {
    type: 'object', additionalProperties: false, required: ['nombre', 'activa'],
    description: 'Reemplazo completo. Desactivar no borra ni oculta cursos publicados; deja de ofrecerse al crear o editar cursos.',
    properties: { nombre, descripcion, activa: { type: 'boolean' } },
  },
};

const cuerpo = (nombreEsquema: string) => ({
  required: true, content: { 'application/json': { schema: ref(nombreEsquema) } },
});

export const rutasCategorias = {
  '/admin/categorias': {
    get: {
      tags: ['Categorías (administración)'], summary: 'Todas las categorías, activas e inactivas, por nombre',
      security: seguridad,
      responses: {
        200: json({ type: 'array', items: ref('CategoriaAdmin') }),
        400: error('Parámetro de consulta desconocido'), ...comunes, 500: errorInterno,
      },
    },
    post: {
      tags: ['Categorías (administración)'], summary: 'Crear una categoría (nace activa)',
      security: seguridad, requestBody: cuerpo('DatosCategoriaNueva'),
      responses: {
        201: json(ref('CategoriaAdmin'), 'Categoría creada'),
        ...erroresCuerpoJson('Nombre o descripción inválidos (SOLICITUD_INVALIDA)'),
        ...comunes, 409: duplicada, 500: errorInterno,
      },
    },
  },
  '/admin/categorias/{id}': {
    put: {
      tags: ['Categorías (administración)'], summary: 'Editar, activar o desactivar una categoría',
      security: seguridad, parameters: [idRuta], requestBody: cuerpo('DatosCategoria'),
      responses: {
        200: json(ref('CategoriaAdmin')),
        ...erroresCuerpoJson(`Nombre o descripción inválidos o ${idInvalido}`),
        ...comunes, 404: error('La categoría no existe'), 409: duplicada, 500: errorInterno,
      },
    },
  },
};
