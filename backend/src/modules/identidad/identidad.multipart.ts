import type { RequestHandler } from 'express';
import { recibirArchivoFoto } from '../../shared/archivos/fotos.js';
import { validarCuerpo } from '../../shared/http/validar.js';
import { fotoUrlSchema } from './identidad.esquemas.js';

const validarFotoUrl = validarCuerpo(fotoUrlSchema, 'Indica un enlace https:// a una imagen (máx. 255 caracteres).');

/**
 * La foto llega de dos formas: multipart/form-data con el archivo recortado (campo `foto`)
 * o application/json con un enlace externo `{ fotoUrl }`, validado aquí con zod.
 */
export const recibirFoto: RequestHandler = (req, res, next) => {
  if (req.is('application/json')) {
    validarFotoUrl(req, res, next);
    return;
  }
  recibirArchivoFoto(req, res, next);
};
