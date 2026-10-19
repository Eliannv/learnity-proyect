import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Validación uniforme (ADR-006, 6.1): un middleware por cada origen de datos.
 * Orden en las rutas: autenticar → autorizar → validarParametros → validarConsulta → validarCuerpo → controller.
 * Cualquier error de zod llega a `manejadorErrores` y se responde 400 SOLICITUD_INVALIDA con `detalles` por campo.
 */

/** Valida el cuerpo y lo reemplaza por el resultado de zod. Uso: router.post('/auth/login', validarCuerpo(loginSchema), controller.login) */
export function validarCuerpo(esquema: ZodType): RequestHandler {
  return (req, _res, next) => {
    req.body = esquema.parse(req.body);
    next();
  };
}

/** Valida los parámetros de ruta y los deja en `res.locals.parametros` (léelos con `datosValidados`). */
export function validarParametros(esquema: ZodType): RequestHandler {
  return (req, res, next) => {
    res.locals['parametros'] = esquema.parse(req.params);
    next();
  };
}

/** Valida la consulta y la deja en `res.locals.consulta`: en Express 5 `req.query` es de solo lectura. */
export function validarConsulta(esquema: ZodType): RequestHandler {
  return (req, res, next) => {
    res.locals['consulta'] = esquema.parse(req.query);
    next();
  };
}

/** Lectura tipada, en el controller, de lo que dejaron `validarParametros` y `validarConsulta`. */
export function datosValidados<P = unknown, Q = unknown>(res: Response): { parametros: P; consulta: Q } {
  return { parametros: res.locals['parametros'] as P, consulta: res.locals['consulta'] as Q };
}
