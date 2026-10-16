import {
  lstat,
  mkdir,
  readFile,
  realpath,
  unlink,
  writeFile,
} from 'node:fs/promises';

import path from 'node:path';

import { env } from '../config/env.js';
import { AppError } from '../http/app-error.js';

import {
  MAX_PDF_BYTES,
  NOMBRE_PDF_INTERNO,
  validarBytesPdf,
} from './pdf-validacion.js';

function directorio(): string {
  const raiz = path.resolve(env.PDF_DIR);

  const publico = path.resolve(
    '..',
    'frontend',
    'public',
  );

  const relativo = path.relative(publico, raiz);

  const dentroDePublico =
    relativo === '' ||
    (
      !path.isAbsolute(relativo) &&
      relativo !== '..' &&
      !relativo.startsWith('..' + path.sep)
    );

  if (dentroDePublico) {
    throw new AppError(
      500,
      'Configura un directorio privado para los PDF.',
      'CONFIGURACION_ARCHIVOS',
    );
  }

  return raiz;
}

function rutaInterna(nombre: string): string {
  if (!NOMBRE_PDF_INTERNO.test(nombre)) {
    throw AppError.noEncontrado(
      'Archivo no disponible.',
    );
  }

  return path.join(directorio(), nombre);
}

export const almacenPdf = {
  async guardar(
    nombre: string,
    bytes: Buffer,
  ): Promise<void> {
    const destino = rutaInterna(nombre);

    await mkdir(directorio(), {
      recursive: true,
    });

    await writeFile(destino, bytes, {
      flag: 'wx',
      mode: 0o600,
    });
  },

  async leer(
    nombre: string,
    tamanoEsperado: number,
  ): Promise<Buffer> {
    const ruta = rutaInterna(nombre);

    try {
      const info = await lstat(ruta);

      if (
        !info.isFile() ||
        info.isSymbolicLink() ||
        info.size !== tamanoEsperado ||
        info.size < 1 ||
        info.size > MAX_PDF_BYTES
      ) {
        throw AppError.noEncontrado(
          'Archivo no disponible.',
        );
      }

      const [raizReal, archivoReal] =
        await Promise.all([
          realpath(directorio()),
          realpath(ruta),
        ]);

      if (path.dirname(archivoReal) !== raizReal) {
        throw AppError.noEncontrado(
          'Archivo no disponible.',
        );
      }

      const bytes = await readFile(archivoReal);

      if (bytes.length !== tamanoEsperado) {
        throw AppError.noEncontrado(
          'Archivo no disponible.',
        );
      }

      return bytes;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.noEncontrado(
        'Archivo no disponible.',
      );
    }
  },

  async esValido(
    nombre: string,
    tamano: number,
  ): Promise<boolean> {
    try {
      const bytes = await this.leer(
        nombre,
        tamano,
      );

      await validarBytesPdf(bytes);

      return true;
    } catch {
      return false;
    }
  },

  async eliminar(nombre: string): Promise<void> {
    try {
      await unlink(rutaInterna(nombre));
    } catch (error) {
      const codigo =
        (error as NodeJS.ErrnoException).code;

      if (codigo !== 'ENOENT') {
        throw error;
      }
    }
  },
};