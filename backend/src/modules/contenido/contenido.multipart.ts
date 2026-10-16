import multer from 'multer';

import type {
  RequestHandler,
} from 'express';

import { AppError } from '../../shared/http/app-error.js';

import {
  MAX_PDF_BYTES,
  nombreOriginalPdf,
} from '../../shared/archivos/pdf-validacion.js';

const recibir = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_PDF_BYTES,
    files: 1,
    fields: 0,
    parts: 2,
    fieldNameSize: 30,
    headerPairs: 30,
  },

  fileFilter(_req, archivo, callback) {
    try {
      // Recupera nombres UTF-8 que el parser
      // haya interpretado como Latin-1.
      let nombre = archivo.originalname;

      const caracteresLatin1 = [...nombre].every(
        caracter =>
          caracter.codePointAt(0)! <= 255,
      );

      if (caracteresLatin1) {
        try {
          nombre = new TextDecoder(
            'utf-8',
            { fatal: true },
          ).decode(
            Buffer.from(nombre, 'latin1'),
          );
        } catch {
          // Conserva nombres que realmente
          // estaban escritos en Latin-1.
        }
      }

      archivo.originalname =
        nombreOriginalPdf(nombre);

      callback(null, true);
    } catch (error) {
      callback(
        error instanceof Error
          ? error
          : new Error('Archivo inválido.'),
      );
    }
  },
}).single('archivo');

export const recibirPdf: RequestHandler = (
  req,
  res,
  next,
) => {
  if (!req.is('multipart/form-data')) {
    next(
      new AppError(
        415,
        'Utiliza multipart/form-data con el campo archivo.',
        'TIPO_ARCHIVO_INVALIDO',
        [
          {
            campo: 'archivo',
            mensaje:
              'Envía un PDF en el campo archivo.',
          },
        ],
      ),
    );

    return;
  }

  recibir(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const grande =
        error.code === 'LIMIT_FILE_SIZE';

      next(
        new AppError(
          grande ? 413 : 400,

          grande
            ? 'El PDF supera 10 MiB.'
            : 'Envía un único archivo en el campo archivo, sin otros campos.',

          grande
            ? 'ARCHIVO_DEMASIADO_GRANDE'
            : 'SOLICITUD_INVALIDA',

          [
            {
              campo: 'archivo',

              mensaje: grande
                ? 'El máximo permitido es 10 485 760 bytes.'
                : 'Revisa el formulario de subida.',
            },
          ],
        ),
      );
    } else if (error instanceof AppError) {
      next(error);
    } else if (error) {
      next(
        AppError.solicitudInvalida(
          'No se pudo leer el formulario multipart.',
          [
            {
              campo: 'archivo',
              mensaje:
                'Vuelve a seleccionar el PDF.',
            },
          ],
        ),
      );
    } else {
      next();
    }
  });
};