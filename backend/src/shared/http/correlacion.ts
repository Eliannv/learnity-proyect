import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { conContextoPeticion } from '../log/contexto.js';

export const ENCABEZADO_ID_PETICION = 'X-Request-Id';
const ID_ENTRANTE_VALIDO = /^[A-Za-z0-9-]{8,64}$/;

/**
 * ID de correlación (ADR-006, 6.2). Usa el `X-Request-Id` entrante si tiene un formato seguro; si no, genera un UUID.
 * Lo devuelve en la respuesta (también en los errores) y lo deja disponible para `registrarEvento` durante toda la petición.
 */
export const correlacion: RequestHandler = (req, res, next) => {
  const entrante = req.get(ENCABEZADO_ID_PETICION);
  const id = entrante && ID_ENTRANTE_VALIDO.test(entrante) ? entrante : randomUUID();
  res.setHeader(ENCABEZADO_ID_PETICION, id);
  conContextoPeticion(id, next);
};
