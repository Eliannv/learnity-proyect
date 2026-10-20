import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  stat,
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

/** Archivo ya recibido en el directorio temporal del almacén (ver `reservarTemporal`). */
export interface ArchivoTemporal {
  rutaTemporal: string;
}

/**
 * Almacén de archivos privados (ADR-005, 5.2). Hoy hay una sola implementación, `almacenLocal`.
 *
 * SEAM PARA PRUEBAS (acordado con qa-edge, RG-06/H9): las pruebas inyectan fallos de disco
 * sustituyendo propiedades de `almacenLocal` (`guardar`, `eliminar`, `leer`, `existeYCoincide`,
 * `reservarTemporal`). Por eso el código de producción siempre llama `almacenLocal.<método>(…)` y
 * nunca guarda una referencia al método ni lo desestructura. `guardar` es el único punto que
 * escribe un archivo definitivo, tanto desde bytes como desde un temporal.
 */
export interface AlmacenArchivos {
  /** Crea el archivo definitivo con `wx` (nunca sobrescribe): escribe los bytes o mueve el temporal. */
  guardar(nombre: string, origen: Buffer | ArchivoTemporal): Promise<void>;
  leer(nombre: string, tamanoEsperado: number): Promise<Buffer>;
  /** Existe, mide lo esperado y es un PDF legible. LEE EL ARCHIVO: no llamar con filas bloqueadas. */
  existeYCoincide(nombre: string, tamano: number): Promise<boolean>;
  /** Idempotente: un archivo que no existe no es un error. */
  eliminar(nombre: string): Promise<void>;
  /** Ruta de un temporal nuevo, en el mismo volumen que el almacén (el `rename` es atómico). */
  reservarTemporal(): Promise<string>;
  /** Borra un temporal; no falla si ya no existe. */
  descartarTemporal(ruta: string): Promise<void>;
  /** Borra los temporales con más de `edadMinimaMs` (huérfanos de un proceso caído). */
  limpiarTemporales(edadMinimaMs: number): Promise<number>;
}

const SUBDIRECTORIO_TEMPORAL = '.tmp';
const EXTENSION_TEMPORAL = '.tmp';

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

function directorioTemporal(): string {
  return path.join(directorio(), SUBDIRECTORIO_TEMPORAL);
}

function rutaInterna(nombre: string): string {
  if (!NOMBRE_PDF_INTERNO.test(nombre)) {
    throw AppError.noEncontrado(
      'Archivo no disponible.',
    );
  }

  return path.join(directorio(), nombre);
}

/** Solo acepta rutas que `reservarTemporal` pudo haber entregado. */
function rutaTemporalSegura(ruta: string): string {
  const resuelta = path.resolve(ruta);

  if (
    path.dirname(resuelta) !== directorioTemporal() ||
    !resuelta.endsWith(EXTENSION_TEMPORAL)
  ) {
    throw new AppError(
      500,
      'Archivo temporal no válido.',
      'ERROR_INTERNO',
    );
  }

  return resuelta;
}

async function borrarSiExiste(ruta: string): Promise<void> {
  try {
    await unlink(ruta);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export const almacenLocal: AlmacenArchivos = {
  async guardar(
    nombre: string,
    origen: Buffer | ArchivoTemporal,
  ): Promise<void> {
    const destino = rutaInterna(nombre);

    await mkdir(directorio(), {
      recursive: true,
    });

    if (Buffer.isBuffer(origen)) {
      await writeFile(destino, origen, {
        flag: 'wx',
        mode: 0o600,
      });

      return;
    }

    // Mismo volumen: el rename es atómico y no copia bytes.
    // El nombre es un UUID nuevo; si ya existiera, es un error y no se sobrescribe.
    const temporal = rutaTemporalSegura(origen.rutaTemporal);

    try {
      await lstat(destino);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }

      await rename(temporal, destino);

      return;
    }

    throw Object.assign(new Error('El archivo ya existe.'), {
      code: 'EEXIST',
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

  async existeYCoincide(
    nombre: string,
    tamano: number,
  ): Promise<boolean> {
    try {
      const bytes = await almacenLocal.leer(
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
    await borrarSiExiste(rutaInterna(nombre));
  },

  async reservarTemporal(): Promise<string> {
    await mkdir(directorioTemporal(), {
      recursive: true,
    });

    return path.join(
      directorioTemporal(),
      randomUUID() + EXTENSION_TEMPORAL,
    );
  },

  async descartarTemporal(ruta: string): Promise<void> {
    await borrarSiExiste(rutaTemporalSegura(ruta));
  },

  async limpiarTemporales(edadMinimaMs: number): Promise<number> {
    let nombres: string[];

    try {
      nombres = await readdir(directorioTemporal());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return 0;
      }

      throw error;
    }

    const limite = Date.now() - edadMinimaMs;
    let borrados = 0;

    for (const nombre of nombres) {
      if (!nombre.endsWith(EXTENSION_TEMPORAL)) {
        continue;
      }

      const ruta = path.join(directorioTemporal(), nombre);

      try {
        const info = await stat(ruta);

        if (info.isFile() && info.mtimeMs <= limite) {
          await borrarSiExiste(ruta);
          borrados += 1;
        }
      } catch {
        // Otro proceso pudo borrarlo o está en uso: se reintenta en la próxima limpieza.
      }
    }

    return borrados;
  },
};
