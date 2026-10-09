import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { env } from '../config/env.js';

/** Rutas que no existen. */
export const rutaNoEncontrada: RequestHandler = (req, _res, next) => {
  next(AppError.noEncontrado(`La ruta ${req.method} ${req.originalUrl} no existe.`));
};

/**
 * Manejador global de errores. Express 5 envía aquí también los errores de funciones async,
 * así que los controllers no necesitan try/catch.
 */
export const manejadorErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { codigo: error.codigo, mensaje: error.message, detalles: error.detalles } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        codigo: 'SOLICITUD_INVALIDA',
        mensaje: 'Revisa los datos enviados.',
        detalles: error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      },
    });
    return;
  }

  // Violaciones de restricciones de PostgreSQL (UNIQUE, CHECK, FK)
  const pgCodigo = (error as { code?: string }).code;
  if (pgCodigo === '23505') {
    res.status(409).json({ error: { codigo: 'CONFLICTO', mensaje: 'Ya existe un registro con esos datos.' } });
    return;
  }
  if (pgCodigo === '23514' || pgCodigo === '23503') {
    res.status(400).json({ error: { codigo: 'SOLICITUD_INVALIDA', mensaje: 'Los datos no cumplen las reglas de la base de datos.' } });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      codigo: 'ERROR_INTERNO',
      mensaje: 'Ocurrió un error inesperado.',
      detalles: env.NODE_ENV === 'development' ? String(error?.message ?? error) : undefined,
    },
  });
};
