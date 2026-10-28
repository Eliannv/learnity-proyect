import { createWriteStream } from 'node:fs';

import multer from 'multer';

import type {
  RequestHandler,
} from 'express';

import { AppError } from '../../shared/http/app-error.js';

import {
  almacenLocal,
} from '../../shared/archivos/almacen.js';

import {
  MAX_PDF_BYTES,
  nombreOriginalPdf,
} from '../../shared/archivos/pdf-validacion.js';
import { nombreOriginalRecurso } from '../../shared/archivos/recurso-validacion.js';

import {
  registrarEvento,
} from '../../shared/log/registro.js';

// Recibe el archivo en un temporal del mismo volumen que el almacén (ADR-011, 11.5): la memoria
// queda acotada mientras se recibe. El servicio valida el temporal y lo renombra al nombre definitivo.
const almacenamientoTemporal: multer.StorageEngine = {
  _handleFile(_req, archivo, callback) {
    almacenLocal
      .reservarTemporal()
      .then(ruta => {
        const salida = createWriteStream(ruta, {
          flags: 'wx',
          mode: 0o600,
        });

        let fallado = false;

        const fallar = (error: Error) => {
          if (fallado) {
            return;
          }

          fallado = true;

          archivo.stream.unpipe(salida);
          salida.destroy();

          almacenLocal
            .descartarTemporal(ruta)
            .catch(() => undefined)
            .finally(() => callback(error));
        };

        archivo.stream.once('error', fallar);
        salida.once('error', fallar);

        salida.once('finish', () => {
          callback(null, {
            path: ruta,
            size: salida.bytesWritten,
          } as Partial<Express.Multer.File>);
        });

        archivo.stream.pipe(salida);
      })
      .catch(callback);
  },

  _removeFile(_req, archivo, callback) {
    if (!archivo.path) {
      callback(null);
      return;
    }

    almacenLocal
      .descartarTemporal(archivo.path)
      .then(() => callback(null), callback);
  },
};

const crearRecepcion = (validarNombre: (nombre: string) => string) => multer({
  storage: almacenamientoTemporal,

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
        validarNombre(nombre);

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

function esErrorDeDisco(
  error: unknown,
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    typeof (error as NodeJS.ErrnoException).syscall === 'string'
  );
}

function receptor(
  etiqueta: string,
  /** «un PDF» / «un archivo»: para el mensaje que pide el campo. */
  indefinido: string,
  validarNombre: (nombre: string) => string,
): RequestHandler {
  const recibir = crearRecepcion(validarNombre);
  return (
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
              `Envía ${indefinido} en el campo archivo.`,
          },
        ],
      ),
    );

    return;
  }

  recibir(req, res, (error: unknown) => {
    // Al terminar la respuesta ya no hace falta el temporal (si se movió, no hay nada que borrar).
    const temporal = req.file?.path;

    if (temporal) {
      res.once('close', () => {
        void almacenLocal
          .descartarTemporal(temporal)
          .catch(() => undefined);
      });
    }

    if (error instanceof multer.MulterError) {
      const grande =
        error.code === 'LIMIT_FILE_SIZE';

      next(
        new AppError(
          grande ? 413 : 400,

          grande
            ? `${etiqueta[0]!.toUpperCase()}${etiqueta.slice(1)} supera 10 MiB.`
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
    } else if (esErrorDeDisco(error)) {
      // Disco lleno, sin permisos…: es un fallo del servidor, no del formulario.
      registrarEvento(
        'archivo.recepcion_fallida',
        { codigo: error.code },
        'error',
      );

      next(
        new AppError(
          500,
          `No se pudo guardar ${etiqueta}. Inténtalo nuevamente.`,
          'ERROR_INTERNO',
        ),
      );
    } else if (error) {
      next(
        AppError.solicitudInvalida(
          'No se pudo leer el formulario multipart.',
          [
            {
              campo: 'archivo',
              mensaje:
                `Vuelve a seleccionar ${etiqueta}.`,
            },
          ],
        ),
      );
    } else {
      next();
    }
  });
};
}

export const recibirPdf = receptor('el PDF', 'un PDF', nombreOriginalPdf);

/** Recurso adjunto: PDF, PPT, PPTX o ZIP. El tipo se valida de nuevo con el contenido en el servicio. */
export const recibirRecurso = receptor('el archivo', 'un archivo', (nombre) => nombreOriginalRecurso(nombre).original);
