import type { RequestHandler } from 'express';
import { recibirArchivoFoto } from '../../shared/archivos/fotos.js';

// Permite tanto multipart/form-data (subir imagen recortada) como application/json (guardar URL de imagen).
export const recibirFoto: RequestHandler = (req, res, next) => {
  if (req.is('application/json')) {
    next();
    return;
  }
  recibirArchivoFoto(req, res, next);
};
