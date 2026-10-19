import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { env } from '../config/env.js';
import { registrarEvento } from '../log/registro.js';

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

  // Errores del parser JSON (http-errors con `type`; ADR-011, 11.6). Nunca se devuelve ni se registra el contenido recibido.
  const tipoParser = (error as { type?: string }).type;
  if (tipoParser === 'entity.parse.failed') {
    res.status(400).json({ error: { codigo: 'SOLICITUD_INVALIDA', mensaje: 'El cuerpo de la petición no es un JSON válido.' } });
    return;
  }
  if (tipoParser === 'entity.too.large') {
    res.status(413).json({ error: { codigo: 'CUERPO_DEMASIADO_GRANDE', mensaje: 'El cuerpo de la petición supera el tamaño permitido.' } });
    return;
  }
  if (tipoParser === 'charset.unsupported' || tipoParser === 'encoding.unsupported') {
    res.status(415).json({ error: { codigo: 'TIPO_NO_ADMITIDO', mensaje: 'La codificación del cuerpo de la petición no es admitida. Usa UTF-8.' } });
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

  // Nunca se registran `detail` (trae valores de la fila), `parameters` ni el cuerpo de la petición.
  // El `message` de PostgreSQL puede incluir el valor recibido (p. ej. "invalid input syntax ... \"abc\""): con `code` solo se registran el código y la restricción.
  const pg = error as { constraint?: string; table?: string };
  registrarEvento(
    'error_no_controlado',
    {
      nombre: error?.name,
      mensaje: pgCodigo ? undefined : error?.message,
      codigoPg: pgCodigo,
      restriccion: pgCodigo ? pg.constraint : undefined,
      tabla: pgCodigo ? pg.table : undefined,
      pila: env.NODE_ENV === 'development' ? error?.stack : undefined,
    },
    'error',
  );
  res.status(500).json({
    error: {
      codigo: 'ERROR_INTERNO',
      mensaje: 'Ocurrió un error inesperado.',
      detalles: env.NODE_ENV === 'development' ? String(error?.message ?? error) : undefined,
    },
  });
};
