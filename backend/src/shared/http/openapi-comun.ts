// OpenAPI · Piezas comunes a todos los parciales: referencias, respuestas JSON y el único esquema de error.

export const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` });

export const json = (schema: unknown, description = 'Correcto') => ({ description, content: { 'application/json': { schema } } });

/** Respuesta de error con el esquema único `ErrorApi` (`{ error: { codigo, mensaje, detalles } }`). */
export const error = (description: string) => json(ref('ErrorApi'), description);

/** Cualquier operación puede responder 500 ERROR_INTERNO (`manejador-errores.ts`). */
export const errorInterno = { $ref: '#/components/responses/ErrorInterno' };

export const seguridad = [{ bearer: [] }];

/**
 * Errores del parser JSON (`express.json`, ADR-011, 11.6) para una operación con cuerpo JSON. Sustituye a su 400:
 * `descripcion400` es la causa propia de la operación, y se añade el JSON mal formado. Declara también el 413 y el 415.
 */
export const erroresCuerpoJson = (descripcion400: string) => ({
  400: error(`${descripcion400}. También, sin detalles, si el cuerpo no es un JSON válido (SOLICITUD_INVALIDA)`),
  413: { $ref: '#/components/responses/CuerpoDemasiadoGrande' },
  415: { $ref: '#/components/responses/TipoNoAdmitido' },
});

/**
 * ID de ruta (`idRuta` de `shared/http/esquemas.ts`, ADR-011, 11.11). Sigue siendo `integer` para que los tipos generados
 * no cambien; la forma del texto, que OpenAPI 3.0 no expresa en un entero, va en la descripción.
 */
export const idRuta = {
  in: 'path',
  name: 'id',
  required: true,
  description:
    'Entero decimal canónico de 1 a 2 147 483 647: solo dígitos, sin signo, sin ceros a la izquierda, sin espacios, ' +
    'sin parte decimal, exponente ni hexadecimal (`007`, `+7`, ` 7 `, `7.0`, `1e3` y `0x10` se rechazan). Si no cumple, ' +
    'responde 400 SOLICITUD_INVALIDA ("Revisa los datos enviados.") con ' +
    '`detalles: [{ campo: "id", mensaje: "Debe ser un entero positivo en decimal." }]`, o con el mensaje "Es demasiado grande." ' +
    'si tiene 10 cifras y supera 2 147 483 647. En las operaciones con sesión, el 401 y el 403 se comprueban antes.',
  schema: { type: 'integer', format: 'int32', minimum: 1, maximum: 2_147_483_647 },
};

/** Causa del 400 por un `{id}` que no cumple `idRuta` (ADR-011, 11.11). */
export const idInvalido = '`id` de la ruta inválido (SOLICITUD_INVALIDA, con el detalle en el campo `id`)';

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
              'NO_ENCONTRADO, CONFLICTO, CURSO_BLOQUEADO, DEMASIADAS_PETICIONES, CUERPO_DEMASIADO_GRANDE, TIPO_NO_ADMITIDO, ' +
              'ERROR_INTERNO y los propios de cada operación.',
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
  CuerpoDemasiadoGrande: json(ref('ErrorApi'), 'El cuerpo JSON supera 1 MB (CUERPO_DEMASIADO_GRANDE), sin detalles'),
  TipoNoAdmitido: json(
    ref('ErrorApi'),
    'El charset de `Content-Type` no es UTF (se espera UTF-8) o el `Content-Encoding` no es identity, gzip, deflate ni br ' +
      '(TIPO_NO_ADMITIDO), sin detalles',
  ),
};
