// Contrato de Supervisión del administrador. Mantener en paridad con modules/supervision.
import { error, errorInterno, json, ref, seguridad } from './openapi-comun.js';

const fecha = { type: 'string', format: 'date-time' };
const entero = { type: 'integer', minimum: 0 };

export const esquemasSupervision = {
  AccesoAdmin: {
    type: 'object', required: ['id', 'fecha', 'usuario', 'correo', 'paso', 'exito', 'motivo', 'agente'],
    properties: {
      id: { type: 'integer' },
      fecha,
      usuario: {
        type: 'object', nullable: true, required: ['id', 'nombre'],
        description: 'null si el correo no corresponde a ninguna cuenta (o la cuenta se borró).',
        properties: { id: { type: 'integer' }, nombre: { type: 'string' } },
      },
      correo: {
        type: 'string', nullable: true,
        description: 'El correo escrito al entrar (aunque no exista) o, en REFRESH, el de la cuenta. null si no se conoce.',
      },
      paso: {
        type: 'string', enum: ['CLAVE', 'REFRESH', 'RECUPERACION'],
        description: 'CLAVE: inicio de sesión con contraseña. REFRESH: renovación de la sesión (solo se registran los fallos). ' +
          'RECUPERACION: nueva contraseña con el enlace del correo.',
      },
      exito: { type: 'boolean' },
      motivo: {
        type: 'string',
        enum: ['OK', 'CLAVE_INCORRECTA', 'CUENTA_BLOQUEADA', 'CUENTA_INACTIVA', 'CORREO_DESCONOCIDO', 'TOKEN_REUTILIZADO', 'TOKEN_INVALIDO'],
      },
      agente: { type: 'string', nullable: true, description: 'User-Agent del navegador (hasta 200 caracteres). No se guarda la IP.' },
    },
  },
  PaginaAccesos: {
    type: 'object', required: ['items', 'paginacion'],
    properties: {
      items: { type: 'array', items: ref('AccesoAdmin') },
      paginacion: {
        type: 'object', required: ['total', 'pagina', 'limite', 'totalPaginas'],
        properties: { total: entero, pagina: { type: 'integer', minimum: 1 }, limite: { type: 'integer', minimum: 1 }, totalPaginas: entero },
      },
    },
  },
  CuentaBloqueada: {
    type: 'object', required: ['idUsuario', 'nombre', 'correo', 'intentosFallidos', 'bloqueadoHasta'],
    properties: {
      idUsuario: { type: 'integer' }, nombre: { type: 'string' }, correo: { type: 'string' },
      intentosFallidos: entero, bloqueadoHasta: fecha,
    },
  },
};

export const rutasSupervision = {
  '/admin/accesos': {
    get: {
      tags: ['Supervisión'], summary: 'Registro de accesos: intentos de entrar a una cuenta, más recientes primero',
      security: seguridad,
      parameters: [
        { in: 'query', name: 'resultado', description: '`fallidos` muestra solo los intentos que no entraron.',
          schema: { type: 'string', enum: ['todos', 'fallidos'], default: 'todos' } },
        { in: 'query', name: 'q', description: 'Busca en el correo y en el nombre de la cuenta (sin distinguir mayúsculas).',
          schema: { type: 'string', maxLength: 100 } },
        { in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, default: 1 } },
        { in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      ],
      responses: {
        200: json(ref('PaginaAccesos')), 400: error('Filtros inválidos'), 401: error('Sin sesión'),
        403: error('No es administrador'), 500: errorInterno,
      },
    },
  },
  '/admin/accesos/bloqueadas': {
    get: {
      tags: ['Supervisión'], summary: 'Cuentas bloqueadas ahora por intentos fallidos, la que vence antes primero',
      description: 'Para desbloquear una, `DELETE /admin/usuarios/{id}/bloqueo`.',
      security: seguridad,
      responses: {
        200: json({ type: 'object', required: ['items'], properties: { items: { type: 'array', items: ref('CuentaBloqueada') } } }),
        400: error('Parámetros no admitidos'), 401: error('Sin sesión'), 403: error('No es administrador'), 500: errorInterno,
      },
    },
  },
};
