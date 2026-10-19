// Contrato de la API (OpenAPI 3). Se ve en http://localhost:3000/api/docs, solo con NODE_ENV=development (ADR-011, 11.3).
// Se serializa en docs/api/openapi.yaml. Cada sprint agrega aquí las rutas que implementa.
import { error, errorInterno, esquemasComunes, idRuta, json, ref, respuestasComunes } from './openapi-comun.js';
import { rutasRevisionContenido } from './openapi-revision-contenido.js';
import { esquemasGestionCursos, rutasGestionCursos } from './openapi-gestion-cursos.js';
import { esquemasSolicitudes, rutasSolicitudes } from './openapi-solicitudes.js';

const usuarioSesion = {
  type: 'object',
  properties: {
    idUsuario: { type: 'integer', example: 3 },
    idPersona: { type: 'integer', example: 3 },
    nombres: { type: 'string', example: 'Rosa' },
    apellidos: { type: 'string', example: 'Vera Chávez' },
    correo: { type: 'string', example: 'rosa.vera@correo.com' },
    fotoUrl: { type: 'string', nullable: true, example: null },
    roles: { type: 'array', items: { type: 'string', enum: ['ESTUDIANTE', 'DOCENTE', 'ADMIN'] } },
  },
};

const respuestaSesion = {
  type: 'object',
  properties: {
    accessToken: {
      type: 'string',
      description: 'JWT de 15 minutos. Guardarlo SOLO en memoria y enviarlo como Authorization: Bearer <token>.',
    },
    expiraEn: { type: 'string', format: 'date-time' },
    usuario: usuarioSesion,
  },
};

const perfil = {
  type: 'object',
  properties: {
    ...usuarioSesion.properties,
    ciudad: { type: 'string', nullable: true, example: 'Machala' },
    biografia: { type: 'string', nullable: true },
    creadoEn: { type: 'string', format: 'date-time' },
  },
};

const mensaje = { type: 'object', properties: { mensaje: { type: 'string' } } };

const contrasenaNueva = {
  type: 'string',
  minLength: 15,
  description:
    'Mínimo 15 caracteres y máximo 72 bytes UTF-8 (límite de bcrypt), sin reglas de composición. ' +
    'Se rechazan contraseñas comunes, basadas en el nombre o el correo, y las expuestas en filtraciones (Have I Been Pwned, k-anonimato).',
};

/** Contraseña que solo se comprueba (login, actual): sin política, con un tope. */
const contrasenaEscrita = { type: 'string', minLength: 1, maxLength: 256 };

const correo = {
  type: 'string',
  format: 'email',
  maxLength: 120,
  example: 'rosa.vera@correo.com',
  description: 'Se recortan los espacios y se pasa a minúsculas antes de validar.',
};

const nombre = (ejemplo: string) => ({ type: 'string', minLength: 1, maxLength: 80, example: ejemplo });

const cuerpo = (propiedades: Record<string, unknown>, requeridos: string[]) => ({
  required: true,
  content: { 'application/json': { schema: { type: 'object', required: requeridos, properties: propiedades } } },
});

const conCookies = (schema: unknown, descripcion = 'Sesión abierta') => ({
  ...json(schema, descripcion),
  headers: {
    'Set-Cookie': {
      description:
        '`learnity_rt` (refresh token opaco, HttpOnly, SameSite=Lax, Path=/api/auth, Secure en HTTPS) y ' +
        '`XSRF-TOKEN` (token CSRF legible por JavaScript).',
      schema: { type: 'string' },
    },
  },
});

const limite = error('Demasiadas peticiones desde esta IP (DEMASIADAS_PETICIONES, encabezado Retry-After)');
const origen = error('Origen no permitido (ORIGEN_NO_PERMITIDO)');
const sinSesion = error('Sin sesión, token inválido o sesión revocada');
const cuentaInexistente = error('La cuenta ya no existe (NO_ENCONTRADO)');

const esquemasCatalogo = {
  CategoriaPublica: {
    type: 'object', required: ['id', 'nombre'],
    properties: { id: { type: 'integer' }, nombre: { type: 'string' } },
  },
  CursoPublico: {
    type: 'object',
    required: ['id', 'titulo', 'subtitulo', 'categoria', 'docente', 'nivel', 'portadaUrl', 'modulos', 'lecciones', 'minutos', 'publicadoEn', 'estado'],
    properties: {
      id: { type: 'integer' }, titulo: { type: 'string' }, subtitulo: { type: 'string', nullable: true },
      categoria: ref('CategoriaPublica'), docente: { type: 'string' },
      nivel: { type: 'string', enum: ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'] },
      portadaUrl: { type: 'string', nullable: true }, modulos: { type: 'integer', minimum: 0 },
      lecciones: { type: 'integer', minimum: 0 }, minutos: { type: 'integer', minimum: 0 },
      publicadoEn: {
        type: 'string', format: 'date-time',
        description: 'Fecha de publicación; si el curso no la tiene, su fecha de creación.',
      },
      estado: { type: 'string', enum: ['PUBLICADO'] },
    },
  },
  CursoPublicoDetalle: {
    allOf: [
      ref('CursoPublico'),
      {
        type: 'object',
        required: ['descripcion', 'docenteBio', 'objetivos', 'requisitos', 'temario'],
        properties: {
          descripcion: { type: 'string', description: 'Cadena vacía si no tiene.' }, docenteBio: { type: 'string', nullable: true },
          objetivos: { type: 'array', items: { type: 'string' } },
          requisitos: { type: 'array', items: { type: 'string' } },
          temario: { type: 'array', items: { type: 'object', required: ['id', 'orden', 'titulo', 'lecciones'], properties: {
            id: { type: 'integer' }, orden: { type: 'integer' }, titulo: { type: 'string' },
            lecciones: { type: 'array', items: { type: 'object', required: ['id', 'orden', 'titulo', 'tipo', 'minutos'], properties: {
              id: { type: 'integer' }, orden: { type: 'integer' }, titulo: { type: 'string' },
              tipo: { type: 'string', enum: ['VIDEO', 'DOCUMENTO', 'EVALUACION'] }, minutos: { type: 'integer', minimum: 0 },
            } } },
          } } },
        },
      },
    ],
  },
};

export const openApi = {
  openapi: '3.0.3',
  info: {
    title: 'Learnity API',
    version: '0.3.0',
    description: [
      'API REST del monolito modular en capas. Sprint 1: Identidad. Sprint 2: Cursos, contenido PDF, revisión de cursos y solicitudes de docente.',
      '',
      '**Sesión.** Login y registro devuelven un *access token* (JWT, 15 min) en el cuerpo y dejan el *refresh token* en la cookie',
      '`learnity_rt` (HttpOnly). `POST /auth/refresh` lo rota en cada uso; presentar uno ya rotado revoca la sesión completa.',
      'Cerrar sesión, cambiar o restablecer la contraseña revocan las sesiones y sus access tokens dejan de valer de inmediato.',
      '',
      '**CSRF.** Las rutas que usan la cookie (`/auth/refresh`, `/auth/logout`) exigen el encabezado `X-XSRF-TOKEN`',
      'con el valor de la cookie `XSRF-TOKEN` (Angular lo envía solo). Todas las rutas `/auth/*` rechazan otros orígenes.',
      '',
      '**Límites.** Por IP: login 20/15 min, registro 10/h, recuperar 5/15 min, restablecer 10/15 min, refresh 120/15 min,',
      'logout 60/15 min, cambiar la contraseña 10/15 min y solicitudes de docente 10/h.',
      'Por cuenta: 5 inicios fallidos seguidos la bloquean 15 minutos (con el mismo mensaje genérico); una sola solicitud de docente pendiente.',
      'Contenido: un curso tiene hasta 10 módulos, cada módulo hasta 12 lecciones y cada PDF hasta 10 MiB. Cuerpos JSON de hasta 1 MB.',
      '',
      '**Errores.** Todas las respuestas de error tienen la forma `ErrorApi`: `{ error: { codigo, mensaje, detalles? } }`.',
      'Cualquier operación puede responder 500 ERROR_INTERNO. Si PostgreSQL rechaza una escritura por una restricción, la respuesta es',
      '409 CONFLICTO (valor duplicado) o 400 SOLICITUD_INVALIDA (CHECK o clave foránea). Hoy, un JSON mal formado, un cuerpo de más',
      'de 1 MB o un charset no admitido también responden 500 (ADR-011, punto 11.6).',
      '',
      '**Documentación.** Swagger UI (`/api/docs`) solo se sirve con `NODE_ENV=development`; en `test` y `production` esa ruta',
      'responde 404 NO_ENCONTRADO (ADR-011, 11.3). La referencia publicada es `docs/api/openapi.yaml`, generada desde este objeto.',
    ].join('\n'),
  },
  servers: [{ url: '/api' }],
  components: {
    schemas: {
      ...esquemasComunes,
      ...esquemasCatalogo,
      ...esquemasGestionCursos,
      ...esquemasSolicitudes,
    },
    responses: respuestasComunes,
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cookieRefresh: { type: 'apiKey', in: 'cookie', name: 'learnity_rt' },
      csrf: { type: 'apiKey', in: 'header', name: 'X-XSRF-TOKEN' },
    },
  },
  paths: {
    ...rutasRevisionContenido,
    ...rutasGestionCursos,
    ...rutasSolicitudes,
    '/salud': {
      get: {
        tags: ['General'], summary: 'Estado del servidor y conexión a PostgreSQL',
        description:
          'Hace un `SELECT 1` y no devuelve ningún dato de la base (ADR-011, 11.1). ' +
          'Si PostgreSQL no responde, devuelve 503 `{ estado: "sin_bd" }` y registra el evento `salud_sin_bd` (ADR-011, 11.2).',
        responses: {
          200: json({ type: 'object', required: ['estado'], properties: {
            estado: { type: 'string', enum: ['ok'] },
          } }, 'El servidor responde y PostgreSQL también'),
          503: json({ type: 'object', required: ['estado'], properties: {
            estado: { type: 'string', enum: ['sin_bd'] },
          } }, 'El servidor responde, pero PostgreSQL no. No usa `ErrorApi`'),
          500: errorInterno,
        },
      },
    },
    '/categorias': {
      get: {
        tags: ['Cursos'], summary: 'Categorías activas ordenadas por nombre',
        responses: { 200: json({ type: 'array', items: ref('CategoriaPublica') }), 500: errorInterno },
      },
    },
    '/cursos': {
      ...rutasGestionCursos['/cursos'],
      get: {
        tags: ['Cursos'], summary: 'Catálogo público: solo cursos publicados',
        description:
          'Los valores repetidos de categoría o nivel se combinan con OR dentro del grupo y AND entre grupos. La búsqueda consulta título, ' +
          'subtítulo y descripción. El total solo cuenta publicados y `totalPaginas` vale 0 si no hay resultados. El catálogo no excluye ' +
          'los cursos de categorías inactivas ni de docentes inactivos. Un parámetro de consulta desconocido da 400.',
        parameters: [
          { in: 'query', name: 'q', description: 'Se recortan los espacios; vacío no filtra.', schema: { type: 'string', maxLength: 100 } },
          {
            in: 'query', name: 'categoria', description: 'Nombre exacto; repetible.',
            schema: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 80 } }, style: 'form', explode: true,
          },
          {
            in: 'query', name: 'nivel', description: 'Repetible.',
            schema: { type: 'array', maxItems: 20, items: { type: 'string', enum: ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'] } }, style: 'form', explode: true,
          },
          { in: 'query', name: 'orden', schema: { type: 'string', enum: ['recientes', 'populares', 'az'], default: 'recientes' } },
          { in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, maximum: 10000, default: 1 } },
          { in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 50, default: 9 } },
        ],
        responses: {
          200: json({ type: 'object', required: ['items', 'pagina', 'limite', 'total', 'totalPaginas'], properties: {
            items: { type: 'array', items: ref('CursoPublico') }, pagina: { type: 'integer' },
            limite: { type: 'integer' }, total: { type: 'integer' }, totalPaginas: { type: 'integer' },
          } }),
          400: error('Filtros o paginación inválidos'),
          500: errorInterno,
        },
      },
    },
    '/cursos/{id}': {
      ...rutasGestionCursos['/cursos/{id}'],
      get: {
        tags: ['Cursos'], summary: 'Detalle público de un curso publicado',
        parameters: [idRuta],
        responses: {
          200: json(ref('CursoPublicoDetalle')),
          400: error('ID inválido'),
          404: error('El ID no existe o el curso no está publicado'),
          500: errorInterno,
        },
      },
    },
    '/auth/registro': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-01 · Crear cuenta (rol ESTUDIANTE) y abrir sesión',
        requestBody: cuerpo(
          {
            nombres: nombre('Rosa'),
            apellidos: nombre('Vera Chávez'),
            correo,
            contrasena: contrasenaNueva,
          },
          ['nombres', 'apellidos', 'correo', 'contrasena'],
        ),
        responses: {
          201: conCookies(respuestaSesion, 'Cuenta creada y sesión abierta'),
          400: error('Datos inválidos o contraseña rechazada por la política'),
          403: origen,
          409: error('Correo ya registrado'),
          429: limite,
          500: errorInterno,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-02 · Iniciar sesión',
        requestBody: cuerpo({ correo, contrasena: contrasenaEscrita }, ['correo', 'contrasena']),
        responses: {
          200: conCookies(respuestaSesion),
          400: error('Correo no válido o contraseña vacía o de más de 256 caracteres (SOLICITUD_INVALIDA)'),
          401: error('Mensaje genérico: correo inexistente, contraseña errónea o cuenta bloqueada (CREDENCIALES_INVALIDAS)'),
          403: error('Cuenta desactivada (CUENTA_INACTIVA, solo con la contraseña correcta) u origen no permitido'),
          429: limite,
          500: errorInterno,
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Identidad'],
        summary: 'Renovar la sesión: rota el refresh token y entrega un access token nuevo',
        description: 'El frontend lo llama al cargar la página (restaurar la sesión) y cuando el access token vence.',
        security: [{ cookieRefresh: [], csrf: [] }],
        responses: {
          200: conCookies(respuestaSesion, 'Sesión renovada'),
          401: error('Sin sesión, vencida, revocada o reutilizada (SESION_INVALIDA); se borran las cookies'),
          403: error('Token CSRF ausente o inválido (CSRF_INVALIDO) u origen no permitido'),
          409: error('Otra pestaña renovó la sesión hace instantes (REFRESCO_CONCURRENTE): reintentar'),
          429: limite,
          500: errorInterno,
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Identidad'],
        summary: 'Cerrar sesión: revoca el refresh token y los access tokens de esa sesión',
        security: [{ cookieRefresh: [], csrf: [] }],
        responses: {
          204: { description: 'Sesión cerrada y cookies borradas' },
          403: error('Token CSRF ausente o inválido (CSRF_INVALIDO) u origen no permitido'),
          429: limite,
          500: errorInterno,
        },
      },
    },
    '/auth/recuperar': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-06 · Enviar enlace para recuperar la contraseña',
        description:
          'Responde siempre lo mismo y al instante, exista o no el correo. Si existe, envía (Gmail API) un enlace de un solo uso ' +
          'que vence en 15–30 minutos (RECUPERACION_MINUTOS). Máximo 3 enlaces por cuenta y hora.',
        requestBody: cuerpo({ correo }, ['correo']),
        responses: {
          202: json(mensaje),
          400: error('Correo no válido (SOLICITUD_INVALIDA)'),
          403: origen,
          429: limite,
          500: errorInterno,
        },
      },
    },
    '/auth/restablecer': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-06 · Guardar la nueva contraseña con el token del enlace',
        description: 'Consume el enlace (un solo uso), cambia la contraseña y revoca todas las sesiones anteriores de la cuenta.',
        requestBody: cuerpo(
          {
            token: { type: 'string', minLength: 1, maxLength: 100, description: 'Valor tras #token= en el enlace del correo' },
            contrasena: contrasenaNueva,
          },
          ['token', 'contrasena'],
        ),
        responses: {
          200: json(mensaje),
          400: error('Enlace inválido, usado o vencido, o contraseña rechazada'),
          403: origen,
          429: limite,
          500: errorInterno,
        },
      },
    },
    '/perfil': {
      get: {
        tags: ['Identidad'],
        summary: 'RF-04 · Ver mi perfil',
        security: [{ bearer: [] }],
        responses: { 200: json(perfil), 401: sinSesion, 404: cuentaInexistente, 500: errorInterno },
      },
      put: {
        tags: ['Identidad'],
        summary: 'RF-04 · Editar mi perfil',
        security: [{ bearer: [] }],
        requestBody: cuerpo(
          {
            nombres: nombre('Rosa'),
            apellidos: nombre('Vera Chávez'),
            ciudad: { type: 'string', nullable: true, maxLength: 60 },
            biografia: { type: 'string', nullable: true, maxLength: 300 },
          },
          ['nombres', 'apellidos'],
        ),
        responses: {
          200: json(perfil),
          400: error('Datos inválidos (SOLICITUD_INVALIDA)'),
          401: sinSesion,
          404: cuentaInexistente,
          500: errorInterno,
        },
      },
    },
    '/perfil/contrasena': {
      put: {
        tags: ['Identidad'],
        summary: 'RF-04 · Cambiar mi contraseña (cierra las demás sesiones)',
        security: [{ bearer: [] }],
        requestBody: cuerpo({ actual: contrasenaEscrita, nueva: contrasenaNueva }, ['actual', 'nueva']),
        responses: {
          200: json(mensaje),
          400: error('Contraseña actual incorrecta o nueva rechazada'),
          401: sinSesion,
          429: limite,
          500: errorInterno,
        },
      },
    },
  },
};
