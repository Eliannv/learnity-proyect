import { error, idRuta, json, ref, seguridad } from './openapi-comun.js';

const entero = { type: 'integer', minimum: 1 },
  uuid = { type: 'string', format: 'uuid' };
const members = { type: 'array', uniqueItems: true, items: entero };
const nombre = { type: 'string', minLength: 1, maxLength: 80 };
const objeto = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
});
const entrada = (schema: unknown, tipo = 'application/json') => ({
  required: true,
  content: { [tipo]: { schema } },
});
const path = (name: string, schema: unknown) => ({ in: 'path', name, required: true, schema });
const grupo = path('grupo', entero),
  carga = path('carga', uuid);
const errores = {
  400: error('Datos inválidos'),
  401: error('Sesión necesaria'),
  403: error('Acceso denegado'),
  404: error('Contenido no disponible'),
  409: error('Estado incompatible'),
};
const grupos = { 200: json(ref('GruposCurso')), ...errores };
const api = (
  summary: string,
  parameters: unknown[],
  responses: Record<string, unknown>,
  requestBody?: unknown,
) => ({
  tags: ['Contenido'],
  summary,
  security: seguridad,
  parameters,
  responses,
  ...(requestBody ? { requestBody } : {}),
});
export const esquemasVideosGrupos = {
  GrupoCurso: objeto({ id: entero, nombre, revision: entero, miembros: members }),
  GruposCurso: objeto({
    grupos: { type: 'array', items: ref('GrupoCurso') },
    inscritos: { type: 'array', items: objeto({ id: entero, nombre: { type: 'string' } }) },
  }),
  DatosGrupo: objeto({ nombre, miembros: members }),
  ActualizarGrupo: objeto({ nombre, miembros: members, revision: entero }),
  CargaGrabacion: objeto({
    id: uuid,
    siguiente: { type: 'integer', minimum: 0 },
    lista: { type: 'boolean' },
    tamanoParte: entero,
  }),
};
const binario = { type: 'string', format: 'binary' };
const media = {
  description: 'MP4 autorizado',
  content: { 'video/mp4': { schema: binario } },
  headers: {
    'Accept-Ranges': { schema: { type: 'string' } },
    'Content-Range': { schema: { type: 'string' } },
    'Content-Length': { schema: { type: 'integer' } },
  },
};
const play = {
  ...api(
    'Leer una grabación privada',
    [idRuta, { in: 'header', name: 'Range', schema: { type: 'string' } }],
    { 200: media, 206: media, 416: { description: 'Rango fuera del archivo' }, ...errores },
  ),
  security: [{ reproduccion: [] }],
};
export const rutasVideosGrupos = {
  '/docente/cursos/{id}/grupos': {
    get: api('Grupos e inscritos del curso', [idRuta], grupos),
    post: api(
      'Crear grupo del curso',
      [idRuta],
      { 201: json(ref('GruposCurso')), ...errores },
      entrada(ref('DatosGrupo')),
    ),
  },
  '/docente/cursos/{id}/grupos/{grupo}': {
    put: api('Actualizar nombre y miembros', [idRuta, grupo], grupos, entrada(ref('ActualizarGrupo'))),
    delete: api('Eliminar un grupo sin lecciones', [idRuta, grupo], grupos),
  },
  '/docente/cursos/{id}/grabaciones': {
    post: api(
      'Iniciar o reanudar la carga privada',
      [idRuta],
      { 201: json(ref('CargaGrabacion')), ...errores },
      entrada(objeto({ operacion: uuid, tamano: { ...entero, maximum: 104857600 } })),
    ),
  },
  '/grabaciones/{carga}/partes/{parte}': {
    put: api(
      'Guardar un bloque de hasta 1 MiB',
      [carga, path('parte', { type: 'integer', minimum: 0, maximum: 99 })],
      { 204: { description: 'Bloque recibido' }, 413: error('Bloque demasiado grande'), ...errores },
      entrada(binario, 'application/octet-stream'),
    ),
  },
  '/grabaciones/{carga}/confirmar': {
    post: api('Validar MP4 y confirmar la carga', [carga], {
      200: json(objeto({ id: uuid })),
      415: error('Se requiere MP4 con vídeo H.264'),
      ...errores,
    }),
  },
  '/lecciones/{id}/video/sesion': {
    post: api('Autorizar la reproducción durante diez minutos', [idRuta], {
      204: { description: 'Cookie HttpOnly de reproducción, ligada a sesión y lección' },
      ...errores,
    }),
  },
  '/lecciones/{id}/video': { get: play, head: { ...play, summary: 'Consultar cabeceras de la grabación' } },
};
