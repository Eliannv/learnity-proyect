// OpenAPI · Piezas comunes a todos los parciales: referencias, respuestas JSON y el único esquema de error.

export const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` });

export const json = (schema: unknown, description = 'Correcto') => ({ description, content: { 'application/json': { schema } } });

/** Respuesta de error con el esquema único `ErrorApi` (`{ error: { codigo, mensaje, detalles } }`). */
export const error = (description: string) => json(ref('ErrorApi'), description);

/** Cualquier operación puede responder 500 ERROR_INTERNO (`manejador-errores.ts`). */
export const errorInterno = { $ref: '#/components/responses/ErrorInterno' };

export const seguridad = [{ bearer: [] }];

/** ID de ruta: entero de 1 a 2 147 483 647 (los controladores responden 400 fuera de ese rango). */
export const idRuta = {
  in: 'path',
  name: 'id',
  required: true,
  schema: { type: 'integer', minimum: 1, maximum: 2_147_483_647 },
};

export const esquemasComunes = {
  ProblemaCampo: {
    type: 'object',
    required: ['campo', 'mensaje'],
    properties: {
      campo: { type: 'string', description: 'Ruta del campo con puntos (`objetivos.0`); vacía si el problema es del cuerpo entero.' },
      mensaje: { type: 'string' },
    },
  },
  ErrorApi: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['codigo', 'mensaje'],
        properties: {
          codigo: {
            type: 'string',
            example: 'SOLICITUD_INVALIDA',
            description:
              'Código estable para el cliente: SOLICITUD_INVALIDA, NO_AUTENTICADO, TOKEN_INVALIDO, SESION_REVOCADA, SIN_PERMISO, ' +
              'NO_ENCONTRADO, CONFLICTO, CURSO_BLOQUEADO, DEMASIADAS_PETICIONES, ERROR_INTERNO y los propios de cada operación.',
          },
          mensaje: { type: 'string', description: 'Texto para mostrar a la persona usuaria.' },
          detalles: {
            description:
              'Opcional. Una lista de problemas por campo (errores de validación 400, 409 CURSO_INCOMPLETO y algunos 413 y 415 ' +
              'de la subida de PDF); `{ reintentarEnSegundos }` en el 429; un texto con el error original en el 500, solo con ' +
              '`NODE_ENV=development`. En los demás casos no se envía (por ejemplo, en el 409 CONFLICTO de PostgreSQL).',
            oneOf: [
              { type: 'array', items: ref('ProblemaCampo') },
              {
                type: 'object',
                required: ['reintentarEnSegundos'],
                properties: { reintentarEnSegundos: { type: 'integer', minimum: 1 } },
              },
              { type: 'string' },
            ],
          },
        },
      },
    },
  },
};

export const respuestasComunes = {
  ErrorInterno: json(ref('ErrorApi'), 'Error inesperado (ERROR_INTERNO). Puede darse en cualquier operación'),
};
