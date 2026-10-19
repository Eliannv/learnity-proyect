// Contrato de la API (OpenAPI 3). Se ve en http://localhost:3000/api/docs
// Cada sprint agrega aquí las rutas que implementa.
import { esquemasRevisionContenido, rutasRevisionContenido } from './openapi-revision-contenido.js';
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

const error = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        codigo: { type: 'string', example: 'SOLICITUD_INVALIDA' },
        mensaje: { type: 'string' },
        detalles: {},
      },
    },
  },
};

const contrasenaNueva = {
  type: 'string',
  minLength: 15,
  description:
    'Mínimo 15 caracteres y máximo 72 bytes UTF-8 (límite de bcrypt), sin reglas de composición. ' +
    'Se rechazan contraseñas comunes, basadas en el nombre o el correo, y las expuestas en filtraciones (Have I Been Pwned, k-anonimato).',
};

const cuerpo = (propiedades: Record<string, unknown>, requeridos: string[]) => ({
  required: true,
  content: { 'application/json': { schema: { type: 'object', required: requeridos, properties: propiedades } } },
});

const json = (schema: unknown, descripcion = 'Correcto') => ({
  description: descripcion,
  content: { 'application/json': { schema } },
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

const limite = json(error, 'Demasiadas peticiones desde esta IP (encabezado Retry-After)');
const origen = json(error, 'Origen no permitido (ORIGEN_NO_PERMITIDO)');

const categoriaPublica = {
  type: 'object', required: ['id', 'nombre'],
  properties: { id: { type: 'integer' }, nombre: { type: 'string' } },
};
const cursoPublico = {
  type: 'object',
  properties: {
    id: { type: 'integer' }, titulo: { type: 'string' }, subtitulo: { type: 'string', nullable: true },
    categoria: categoriaPublica, docente: { type: 'string' },
    nivel: { type: 'string', enum: ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'] },
    portadaUrl: { type: 'string', nullable: true }, modulos: { type: 'integer' },
    lecciones: { type: 'integer' }, minutos: { type: 'integer' },
    publicadoEn: { type: 'string', format: 'date-time' }, estado: { type: 'string', enum: ['PUBLICADO'] },
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
      '**Límites.** Por IP: login 20/15 min, registro 10/h, recuperar 5/15 min, restablecer 10/15 min.',
      'Por cuenta: 5 inicios fallidos seguidos la bloquean 15 minutos (con el mismo mensaje genérico).',
    ].join('\n'),
  },
  servers: [{ url: '/api' }],
  components: {
    schemas: {
      ...esquemasRevisionContenido,
      ...esquemasGestionCursos,
      ...esquemasSolicitudes,
    },
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
      get: { tags: ['General'], summary: 'Estado del servidor y conexión a PostgreSQL', responses: { 200: json({ type: 'object' }) } },
    },
    '/categorias': {
      get: {
        tags: ['Cursos'], summary: 'Categorías activas ordenadas por nombre',
        responses: { 200: json({ type: 'array', items: categoriaPublica }) },
      },
    },
    '/cursos': {
      ...rutasGestionCursos['/cursos'],
      get: {
        tags: ['Cursos'], summary: 'Catálogo público: solo cursos publicados',
        description: 'Los valores repetidos de categoría o nivel se combinan con OR dentro del grupo y AND entre grupos. La búsqueda consulta título, subtítulo y descripción. El total solo cuenta publicados.',
        parameters: [
          { in: 'query', name: 'q', schema: { type: 'string', maxLength: 100 } },
          { in: 'query', name: 'categoria', description: 'Nombre exacto; repetible.', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: true },
          { in: 'query', name: 'nivel', description: 'Repetible.', schema: { type: 'array', items: { type: 'string', enum: ['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'] } }, style: 'form', explode: true },
          { in: 'query', name: 'orden', schema: { type: 'string', enum: ['recientes', 'populares', 'az'], default: 'recientes' } },
          { in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, maximum: 10000, default: 1 } },
          { in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 50, default: 9 } },
        ],
        responses: {
          200: json({ type: 'object', properties: {
            items: { type: 'array', items: cursoPublico }, pagina: { type: 'integer' },
            limite: { type: 'integer' }, total: { type: 'integer' }, totalPaginas: { type: 'integer' },
          } }),
          400: json(error, 'Filtros o paginación inválidos'),
        },
      },
    },
    '/cursos/{id}': {
      ...rutasGestionCursos['/cursos/{id}'],
      get: {
        tags: ['Cursos'], summary: 'Detalle público de un curso publicado',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: {
          200: json({ type: 'object', properties: {
            ...cursoPublico.properties,
            descripcion: { type: 'string' }, docenteBio: { type: 'string', nullable: true },
            objetivos: { type: 'array', items: { type: 'string' } },
            requisitos: { type: 'array', items: { type: 'string' } },
            temario: { type: 'array', items: { type: 'object', properties: {
              id: { type: 'integer' }, orden: { type: 'integer' }, titulo: { type: 'string' },
              lecciones: { type: 'array', items: { type: 'object', properties: {
                id: { type: 'integer' }, orden: { type: 'integer' }, titulo: { type: 'string' },
                tipo: { type: 'string', enum: ['VIDEO', 'DOCUMENTO', 'EVALUACION'] }, minutos: { type: 'integer' },
              } } },
            } } },
          } }),
          400: json(error, 'ID inválido'),
          404: json(error, 'El ID no existe o el curso no está publicado'),
        },
      },
    },
    '/auth/registro': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-01 · Crear cuenta (rol ESTUDIANTE) y abrir sesión',
        requestBody: cuerpo(
          {
            nombres: { type: 'string', example: 'Rosa', maxLength: 80 },
            apellidos: { type: 'string', example: 'Vera Chávez', maxLength: 80 },
            correo: { type: 'string', format: 'email', example: 'rosa.vera@correo.com' },
            contrasena: contrasenaNueva,
          },
          ['nombres', 'apellidos', 'correo', 'contrasena'],
        ),
        responses: {
          201: conCookies(respuestaSesion, 'Cuenta creada y sesión abierta'),
          400: json(error, 'Datos inválidos o contraseña rechazada por la política'),
          403: origen,
          409: json(error, 'Correo ya registrado'),
          429: limite,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-02 · Iniciar sesión',
        requestBody: cuerpo(
          { correo: { type: 'string', example: 'rosa.vera@correo.com' }, contrasena: { type: 'string' } },
          ['correo', 'contrasena'],
        ),
        responses: {
          200: conCookies(respuestaSesion),
          401: json(error, 'Mensaje genérico: correo inexistente, contraseña errónea o cuenta bloqueada (CREDENCIALES_INVALIDAS)'),
          403: json(error, 'Cuenta desactivada (CUENTA_INACTIVA, solo con la contraseña correcta) u origen no permitido'),
          429: limite,
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
          401: json(error, 'Sin sesión, vencida, revocada o reutilizada (SESION_INVALIDA); se borran las cookies'),
          403: json(error, 'Token CSRF ausente o inválido (CSRF_INVALIDO) u origen no permitido'),
          409: json(error, 'Otra pestaña renovó la sesión hace instantes (REFRESCO_CONCURRENTE): reintentar'),
          429: limite,
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Identidad'],
        summary: 'Cerrar sesión: revoca el refresh token y los access tokens de esa sesión',
        security: [{ cookieRefresh: [], csrf: [] }],
        responses: { 204: { description: 'Sesión cerrada y cookies borradas' }, 403: json(error, 'CSRF inválido'), 429: limite },
      },
    },
    '/auth/recuperar': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-06 · Enviar enlace para recuperar la contraseña',
        description:
          'Responde siempre lo mismo y al instante, exista o no el correo. Si existe, envía (Gmail API) un enlace de un solo uso ' +
          'que vence en 15–30 minutos (RECUPERACION_MINUTOS). Máximo 3 enlaces por cuenta y hora.',
        requestBody: cuerpo({ correo: { type: 'string', format: 'email' } }, ['correo']),
        responses: { 202: json(mensaje), 400: json(error), 403: origen, 429: limite },
      },
    },
    '/auth/restablecer': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-06 · Guardar la nueva contraseña con el token del enlace',
        description: 'Consume el enlace (un solo uso), cambia la contraseña y revoca todas las sesiones anteriores de la cuenta.',
        requestBody: cuerpo({ token: { type: 'string', description: 'Valor tras #token= en el enlace del correo' }, contrasena: contrasenaNueva }, [
          'token',
          'contrasena',
        ]),
        responses: { 200: json(mensaje), 400: json(error, 'Enlace inválido, usado o vencido, o contraseña rechazada'), 403: origen, 429: limite },
      },
    },
    '/perfil': {
      get: {
        tags: ['Identidad'],
        summary: 'RF-04 · Ver mi perfil',
        security: [{ bearer: [] }],
        responses: { 200: json(perfil), 401: json(error) },
      },
      put: {
        tags: ['Identidad'],
        summary: 'RF-04 · Editar mi perfil',
        security: [{ bearer: [] }],
        requestBody: cuerpo(
          {
            nombres: { type: 'string', maxLength: 80 },
            apellidos: { type: 'string', maxLength: 80 },
            ciudad: { type: 'string', nullable: true, maxLength: 60 },
            biografia: { type: 'string', nullable: true, maxLength: 300 },
          },
          ['nombres', 'apellidos'],
        ),
        responses: { 200: json(perfil), 400: json(error), 401: json(error) },
      },
    },
    '/perfil/contrasena': {
      put: {
        tags: ['Identidad'],
        summary: 'RF-04 · Cambiar mi contraseña (cierra las demás sesiones)',
        security: [{ bearer: [] }],
        requestBody: cuerpo({ actual: { type: 'string' }, nueva: contrasenaNueva }, ['actual', 'nueva']),
        responses: { 200: json(mensaje), 400: json(error, 'Contraseña actual incorrecta o nueva rechazada'), 401: json(error), 429: limite },
      },
    },
  },
};
