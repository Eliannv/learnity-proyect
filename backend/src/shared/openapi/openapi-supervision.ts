// Contrato de Supervisión del administrador. Mantener en paridad con modules/supervision.
import { error, errorInterno, json, ref, seguridad } from './openapi-comun.js';

const fecha = { type: 'string', format: 'date-time' };
const entero = { type: 'integer', minimum: 0 };
const fechaNula = { ...fecha, nullable: true };
const paginacion = {
  type: 'object', required: ['total', 'pagina', 'limite', 'totalPaginas'],
  properties: { total: entero, pagina: { type: 'integer', minimum: 1 }, limite: { type: 'integer', minimum: 1 }, totalPaginas: entero },
};
const fila = {
  type: 'object', nullable: true, additionalProperties: true,
  description: 'Fila completa en JSON, sin contrasena_hash, token_hash ni archivo.ruta. null en INSERT (antes) o DELETE (después).',
};
const propiedadesCambio = {
  id: { type: 'integer' },
  fecha,
  tabla: { type: 'string' },
  operacion: { type: 'string', enum: ['INSERT', 'UPDATE', 'DELETE'] },
  registro: { type: 'string', nullable: true, description: 'Clave primaria del registro (p. ej. «12», o «12,3» en usuario_rol).' },
  actor: {
    type: 'object', nullable: true, required: ['id', 'nombre', 'correo'],
    description: 'Persona de la aplicación que hizo el cambio; null sin actor (migraciones, semillas o scripts).',
    properties: { id: { type: 'integer' }, nombre: { type: 'string' }, correo: { type: 'string', nullable: true } },
  },
  usuarioBd: { type: 'string', description: 'Rol de PostgreSQL que ejecutó el cambio (session_user).' },
  columnasCambiadas: { type: 'array', nullable: true, items: { type: 'string' }, description: 'Solo en UPDATE.' },
};
const requeridosCambio = ['id', 'fecha', 'tabla', 'operacion', 'registro', 'actor', 'usuarioBd', 'columnasCambiadas'];
const tipoAlerta = { type: 'string', enum: ['INTENTOS_FALLIDOS', 'CAMBIO_PRIVILEGIOS', 'RAFAGA_RESENAS', 'MODIFICACION_MASIVA'] };
const severidadAlerta = { type: 'string', enum: ['ALTA', 'MEDIA', 'BAJA'] };
const ids = { type: 'array', items: { type: 'integer' } };
const idSesion = {
  in: 'path', name: 'id', required: true, description: 'ID de la sesión (su familia de tokens)',
  schema: { type: 'string', format: 'uuid' },
};

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
  CambioAuditoria: { type: 'object', required: requeridosCambio, properties: propiedadesCambio },
  DetalleCambioAuditoria: {
    type: 'object', required: [...requeridosCambio, 'idTransaccion', 'antes', 'despues'],
    properties: {
      ...propiedadesCambio,
      idTransaccion: { type: 'integer', description: 'Agrupa los cambios hechos en una misma operación.' },
      antes: fila, despues: fila,
    },
  },
  PaginaAuditoria: {
    type: 'object', required: ['items', 'paginacion'],
    properties: { items: { type: 'array', items: ref('CambioAuditoria') }, paginacion },
  },
  OpcionesAuditoria: {
    type: 'object', required: ['tablas', 'usuariosBd', 'actores'],
    properties: {
      tablas: { type: 'array', items: { type: 'string' } },
      usuariosBd: { type: 'array', items: { type: 'string' } },
      actores: {
        type: 'array', description: 'Los 500 actores con un cambio más reciente.',
        items: { type: 'object', required: ['id', 'nombre'], properties: { id: { type: 'integer' }, nombre: { type: 'string' } } },
      },
    },
  },
  EstadoBaseDatos: {
    type: 'object', required: ['version', 'tamanoBytes', 'conexiones', 'iniciadaEn', 'ultimaMigracion'],
    properties: {
      version: { type: 'string', description: 'Versión de PostgreSQL (server_version).' },
      tamanoBytes: entero,
      conexiones: { ...entero, description: 'Conexiones abiertas a esta base, de cualquier rol.' },
      iniciadaEn: { ...fecha, description: 'Arranque del servidor de PostgreSQL.' },
      ultimaMigracion: {
        type: 'object', nullable: true, required: ['version', 'aplicadaEn'],
        properties: { version: { type: 'string', description: 'Número y nombre, p. ej. 037_supervision_auditoria.' }, aplicadaEn: fechaNula },
      },
    },
  },
  SesionAdmin: {
    type: 'object', required: ['id', 'usuario', 'agente', 'iniciadaEn', 'renovadaEn', 'expiraEn', 'actual'],
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Familia de la sesión: la identifica a lo largo de sus renovaciones.' },
      usuario: {
        type: 'object', required: ['id', 'nombre', 'correo', 'roles'],
        properties: {
          id: { type: 'integer' }, nombre: { type: 'string' }, correo: { type: 'string' },
          roles: { type: 'array', items: { type: 'string', enum: ['ESTUDIANTE', 'DOCENTE', 'ADMIN'] } },
        },
      },
      agente: { type: 'string', nullable: true, description: 'User-Agent del navegador. No se muestra la IP.' },
      iniciadaEn: fecha, renovadaEn: fecha, expiraEn: fecha,
      actual: { type: 'boolean', description: 'Es la sesión con la que el administrador hace la petición.' },
    },
  },
  PaginaSesiones: {
    type: 'object', required: ['items', 'paginacion'],
    properties: { items: { type: 'array', items: ref('SesionAdmin') }, paginacion },
  },
  AlertaSeguridad: {
    type: 'object',
    required: ['id', 'tipo', 'severidad', 'descripcion', 'detectadaEn', 'usuario', 'evidencia', 'atencion'],
    properties: {
      id: { type: 'integer' }, tipo: tipoAlerta, severidad: severidadAlerta, descripcion: { type: 'string', maxLength: 300 },
      detectadaEn: fecha,
      usuario: {
        type: 'object', nullable: true, required: ['id', 'nombre', 'correo'],
        description: 'Cuenta implicada: la atacada, la que recibió o perdió el rol, o la del actor. null si no hay o se borró.',
        properties: { id: { type: 'integer' }, nombre: { type: 'string' }, correo: { type: 'string' } },
      },
      evidencia: {
        type: 'object', required: ['auditoria', 'accesos'], description: 'Registros que la provocaron (como mucho 50 de cada uno).',
        properties: {
          auditoria: { ...ids, description: 'IDs del visor de auditoría (GET /admin/auditoria/{id}).' },
          accesos: { ...ids, description: 'IDs del registro de accesos.' },
        },
      },
      atencion: {
        type: 'object', nullable: true, required: ['fecha', 'por', 'nota'], description: 'null mientras esté pendiente.',
        properties: {
          fecha,
          por: {
            type: 'object', nullable: true, required: ['id', 'nombre'],
            properties: { id: { type: 'integer' }, nombre: { type: 'string' } },
          },
          nota: { type: 'string', nullable: true, maxLength: 300 },
        },
      },
    },
  },
  PaginaAlertas: {
    type: 'object', required: ['items', 'paginacion', 'contadores'],
    properties: {
      items: { type: 'array', items: ref('AlertaSeguridad') }, paginacion,
      contadores: {
        type: 'object', required: ['pendientes', 'todas'], description: 'Con los mismos filtros de severidad y tipo.',
        properties: { pendientes: entero, todas: entero },
      },
    },
  },
  ResultadoAnalisisAlertas: {
    type: 'object', required: ['nuevas', 'desde'],
    properties: {
      nuevas: { ...entero, description: 'Alertas nuevas. Un hallazgo ya registrado no se duplica.' },
      desde: { ...fecha, description: 'Inicio del periodo revisado (las últimas 24 horas).' },
    },
  },
  DatosAtencionAlerta: {
    type: 'object', additionalProperties: false,
    properties: { nota: { type: 'string', nullable: true, maxLength: 300, description: 'Vacía o solo espacios se guarda como null.' } },
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
  '/admin/auditoria': {
    get: {
      tags: ['Supervisión'], summary: 'Visor de auditoría: cambios registrados, el más reciente primero',
      description: 'Lee auditoria_cambio con la función auditoria_listar (SECURITY DEFINER, como mucho 100 filas por página).',
      security: seguridad,
      parameters: [
        { in: 'query', name: 'tabla', schema: { type: 'string', pattern: '^[a-z_]{1,63}$' } },
        { in: 'query', name: 'operacion', schema: { type: 'string', enum: ['INSERT', 'UPDATE', 'DELETE'] } },
        { in: 'query', name: 'usuarioBd', description: 'Rol de PostgreSQL que ejecutó el cambio.',
          schema: { type: 'string', pattern: '^[A-Za-z0-9_]{1,63}$' } },
        { in: 'query', name: 'actor', description: 'ID de la persona que hizo el cambio.', schema: { type: 'integer', minimum: 1 } },
        { in: 'query', name: 'desde', description: 'Inclusivo (ISO 8601 con zona).', schema: { type: 'string', format: 'date-time' } },
        { in: 'query', name: 'hasta', description: 'Exclusivo (ISO 8601 con zona).', schema: { type: 'string', format: 'date-time' } },
        { in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, maximum: 10_000, default: 1 } },
        { in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
      ],
      responses: {
        200: json(ref('PaginaAuditoria')), 400: error('Filtros inválidos o «desde» posterior a «hasta»'),
        401: error('Sin sesión'), 403: error('No es administrador'), 500: errorInterno,
      },
    },
  },
  '/admin/auditoria/opciones': {
    get: {
      tags: ['Supervisión'], summary: 'Tablas, roles de base de datos y actores que aparecen en la auditoría (desplegables)',
      security: seguridad,
      responses: {
        200: json(ref('OpcionesAuditoria')), 400: error('Parámetros no admitidos'), 401: error('Sin sesión'),
        403: error('No es administrador'), 500: errorInterno,
      },
    },
  },
  '/admin/auditoria/{id}': {
    get: {
      tags: ['Supervisión'], summary: 'Un cambio con su transacción y los datos antes y después (para el diff)',
      security: seguridad,
      parameters: [{ in: 'path', name: 'id', required: true, description: 'ID del registro de auditoría', schema: { type: 'integer', minimum: 1 } }],
      responses: {
        200: json(ref('DetalleCambioAuditoria')), 400: error('ID inválido'), 401: error('Sin sesión'),
        403: error('No es administrador'), 404: error('El registro no existe'), 500: errorInterno,
      },
    },
  },
  '/admin/base-datos': {
    get: {
      tags: ['Supervisión'], summary: 'Estado de la base: versión, tamaño, conexiones, arranque y última migración',
      security: seguridad,
      responses: {
        200: json(ref('EstadoBaseDatos')), 400: error('Parámetros no admitidos'), 401: error('Sin sesión'),
        403: error('No es administrador'), 500: errorInterno,
      },
    },
  },
  '/admin/alertas': {
    get: {
      tags: ['Supervisión'], summary: 'Alertas de seguridad, la más reciente primero, con los contadores de cada pestaña',
      security: seguridad,
      parameters: [
        { in: 'query', name: 'estado', schema: { type: 'string', enum: ['pendientes', 'todas'], default: 'pendientes' } },
        { in: 'query', name: 'severidad', schema: severidadAlerta },
        { in: 'query', name: 'tipo', schema: tipoAlerta },
        { in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, maximum: 10_000, default: 1 } },
        { in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
      ],
      responses: {
        200: json(ref('PaginaAlertas')), 400: error('Filtros inválidos'), 401: error('Sin sesión'),
        403: error('No es administrador'), 500: errorInterno,
      },
    },
  },
  '/admin/alertas/analisis': {
    post: {
      tags: ['Supervisión'], summary: 'Ejecutar el análisis ahora sobre las últimas 24 horas',
      description: 'Llama a analizar_alertas_seguridad (038) en una transacción con el administrador como actor. '
        + 'Las reglas y sus umbrales están en la migración. Hasta 30 peticiones por IP y 15 minutos.',
      security: seguridad,
      responses: {
        200: json(ref('ResultadoAnalisisAlertas')), 400: error('Parámetros no admitidos'), 401: error('Sin sesión'),
        403: error('No es administrador'), 429: error('Límite de peticiones'), 500: errorInterno,
      },
    },
  },
  '/admin/alertas/{id}/atencion': {
    put: {
      tags: ['Supervisión'], summary: 'Marcar una alerta como atendida (con nota opcional)',
      description: 'Queda auditado con el administrador como actor.',
      security: seguridad,
      parameters: [{ in: 'path', name: 'id', required: true, description: 'ID de la alerta', schema: { type: 'integer', minimum: 1 } }],
      requestBody: { required: true, content: { 'application/json': { schema: ref('DatosAtencionAlerta') } } },
      responses: {
        200: json(ref('AlertaSeguridad')), 400: error('ID o nota inválidos'), 401: error('Sin sesión'),
        403: error('No es administrador'), 404: error('La alerta no existe'),
        409: error('Ya estaba atendida (ALERTA_ATENDIDA)'), 500: errorInterno,
      },
    },
  },
  '/admin/sesiones': {
    get: {
      tags: ['Supervisión'], summary: 'Sesiones abiertas de todas las cuentas, la renovada más recientemente primero',
      security: seguridad,
      parameters: [
        { in: 'query', name: 'q', description: 'Busca en el nombre y el correo de la cuenta.', schema: { type: 'string', maxLength: 100 } },
        { in: 'query', name: 'pagina', schema: { type: 'integer', minimum: 1, maximum: 10_000, default: 1 } },
        { in: 'query', name: 'limite', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
      ],
      responses: {
        200: json(ref('PaginaSesiones')), 400: error('Filtros inválidos'), 401: error('Sin sesión'),
        403: error('No es administrador'), 500: errorInterno,
      },
    },
  },
  '/admin/sesiones/{id}': {
    delete: {
      tags: ['Supervisión'], summary: 'Cerrar una sesión abierta (motivo ADMIN)',
      description: 'Cerrar la sesión con la que se hace la petición exige `confirmoPropia=true`.',
      security: seguridad,
      parameters: [idSesion,
        { in: 'query', name: 'confirmoPropia', schema: { type: 'string', enum: ['true', 'false'], default: 'false' } }],
      responses: {
        204: { description: 'Sesión cerrada' }, 400: error('ID inválido'), 401: error('Sin sesión'),
        403: error('No es administrador'), 404: error('La sesión no existe o ya está cerrada'),
        409: error('Es la sesión propia y no se confirmó (SESION_PROPIA)'), 500: errorInterno,
      },
    },
  },
};
