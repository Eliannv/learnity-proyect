import type { RequestHandler, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { AppError } from './app-error.js';

/**
 * Validación uniforme (ADR-006, 6.1): un middleware por cada origen de datos.
 * Orden en las rutas: autenticar → autorizar → validarParametros → validarConsulta → validarCuerpo → controller.
 * Cualquier error de zod llega a `manejadorErrores` y se responde 400 SOLICITUD_INVALIDA con `detalles` por campo.
 */

/** Valida el cuerpo y lo reemplaza por el resultado de zod. Admite mensaje específico cuando el contrato lo fija. */
export function validarCuerpo(esquema: ZodType, mensaje?: string): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = esquema.parse(req.body);
      next();
    } catch (error) {
      if (mensaje && error instanceof ZodError) {
        throw AppError.solicitudInvalida(
          mensaje,
          error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
        );
      }
      throw error;
    }
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
