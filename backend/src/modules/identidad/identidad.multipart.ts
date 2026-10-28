import type { RequestHandler } from 'express';
import multer from 'multer';
import { MAX_FOTO_BYTES } from '../../shared/archivos/fotos.js';
import { AppError } from '../../shared/http/app-error.js';

// La foto (2 MiB como máximo) se recibe en memoria; el servicio la valida por su contenido.
const recibir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FOTO_BYTES, files: 1, fields: 0, parts: 2, fieldNameSize: 30, headerPairs: 30 },
}).single('foto');

export const recibirFoto: RequestHandler = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    next(new AppError(415, 'Utiliza multipart/form-data con el campo foto.', 'TIPO_ARCHIVO_INVALIDO'));
    return;
  }
  recibir(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const grande = error.code === 'LIMIT_FILE_SIZE';
      next(grande
        ? new AppError(413, 'La foto supera el máximo de 2 MB.', 'ARCHIVO_DEMASIADO_GRANDE')
        : AppError.solicitudInvalida('Envía una única imagen en el campo foto.', [{ campo: 'foto', mensaje: 'Revisa el formulario.' }]));
    } else if (error) {
      next(AppError.solicitudInvalida('No se pudo leer la foto.', [{ campo: 'foto', mensaje: 'Vuelve a seleccionarla.' }]));
    } else {
      next();
    }
  });
};
