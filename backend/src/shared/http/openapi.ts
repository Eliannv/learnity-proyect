// Contrato de la API (OpenAPI 3). Se ve en http://localhost:3000/api/docs
// Cada sprint agrega aquí las rutas que implementa.

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
  properties: { token: { type: 'string', description: 'JWT. Enviar como Authorization: Bearer <token>' }, usuario: usuarioSesion },
};

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

const cuerpo = (propiedades: Record<string, unknown>, requeridos: string[]) => ({
  required: true,
  content: { 'application/json': { schema: { type: 'object', required: requeridos, properties: propiedades } } },
});

const json = (schema: unknown, descripcion = 'Correcto') => ({
  description: descripcion,
  content: { 'application/json': { schema } },
});

export const openApi = {
  openapi: '3.0.3',
  info: {
    title: 'Learnity API',
    version: '0.1.0',
    description: 'API REST del monolito modular en capas. Sprint 1: módulo Identidad.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
  },
  paths: {
    '/salud': {
      get: { tags: ['General'], summary: 'Estado del servidor y conexión a PostgreSQL', responses: { 200: json({ type: 'object' }) } },
    },
    '/auth/registro': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-01 · Crear cuenta (rol ESTUDIANTE)',
        requestBody: cuerpo(
          {
            nombres: { type: 'string', example: 'Rosa' },
            apellidos: { type: 'string', example: 'Vera Chávez' },
            correo: { type: 'string', example: 'rosa.vera@correo.com' },
            contrasena: { type: 'string', minLength: 8 },
          },
          ['nombres', 'apellidos', 'correo', 'contrasena'],
        ),
        responses: { 201: json(respuestaSesion, 'Cuenta creada'), 400: json(error), 409: json(error, 'Correo ya registrado') },
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
          200: json(respuestaSesion),
          401: json(error, 'Correo o contraseña incorrectos'),
          403: json(error, 'Cuenta desactivada'),
          423: json(error, 'Cuenta bloqueada temporalmente'),
        },
      },
    },
    '/auth/recuperar': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-06 · Enviar enlace para recuperar la contraseña',
        requestBody: cuerpo({ correo: { type: 'string' } }, ['correo']),
        responses: { 202: json({ type: 'object', properties: { mensaje: { type: 'string' } } }) },
      },
    },
    '/auth/restablecer': {
      post: {
        tags: ['Identidad'],
        summary: 'RF-06 · Guardar la nueva contraseña con el token del enlace',
        requestBody: cuerpo({ token: { type: 'string' }, contrasena: { type: 'string', minLength: 8 } }, ['token', 'contrasena']),
        responses: { 200: json({ type: 'object' }), 400: json(error) },
      },
    },
    '/perfil': {
      get: {
        tags: ['Identidad'],
        summary: 'RF-04 · Ver mi perfil',
        security: [{ bearer: [] }],
        responses: { 200: json({ type: 'object' }), 401: json(error) },
      },
      put: {
        tags: ['Identidad'],
        summary: 'RF-04 · Editar mi perfil',
        security: [{ bearer: [] }],
        requestBody: cuerpo(
          {
            nombres: { type: 'string' },
            apellidos: { type: 'string' },
            ciudad: { type: 'string', nullable: true },
            biografia: { type: 'string', nullable: true, maxLength: 300 },
          },
          ['nombres', 'apellidos'],
        ),
        responses: { 200: json({ type: 'object' }), 400: json(error), 401: json(error) },
      },
    },
    '/perfil/contrasena': {
      put: {
        tags: ['Identidad'],
        summary: 'RF-04 · Cambiar mi contraseña',
        security: [{ bearer: [] }],
        requestBody: cuerpo({ actual: { type: 'string' }, nueva: { type: 'string', minLength: 8 } }, ['actual', 'nueva']),
        responses: { 200: json({ type: 'object' }), 400: json(error), 401: json(error) },
      },
    },
  },
};
