import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';

import { env } from '../config/env.js';
import { AppError } from '../http/app-error.js';
import { binarioRepository } from './binario.repository.js';

/** Fotos de perfil y portadas: hasta 2 MiB, JPEG, PNG o WebP reconocidos por su contenido (no por la extensión). */
export const MAX_FOTO_BYTES = 2 * 1024 * 1024;
export const PREFIJO_URL_FOTO = '/api/fotos/';
export const NOMBRE_FOTO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const MIME: Readonly<Record<string, string>> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const multerFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FOTO_BYTES, files: 1, fields: 0, parts: 2, fieldNameSize: 30, headerPairs: 30 },
}).single('foto');

/** Middleware multipart para recibir un único archivo de imagen en el campo `foto` (máx. 2 MiB). */
export const recibirArchivoFoto: RequestHandler = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    next(new AppError(415, 'Utiliza multipart/form-data con el campo foto.', 'TIPO_ARCHIVO_INVALIDO'));
    return;
  }
  multerFoto(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const grande = error.code === 'LIMIT_FILE_SIZE';
      next(
        grande
          ? new AppError(413, 'La foto supera el máximo de 2 MB.', 'ARCHIVO_DEMASIADO_GRANDE')
          : AppError.solicitudInvalida('Envía una única imagen en el campo foto.', [{ campo: 'foto', mensaje: 'Revisa el formulario.' }]),
      );
    } else if (error) {
      next(AppError.solicitudInvalida('No se pudo leer la foto.', [{ campo: 'foto', mensaje: 'Vuelve a seleccionarla.' }]));
    } else {
      next();
    }
  });
};

/** Valida una URL o ruta pública de imagen (`https://...`, `/api/fotos/...` o `/img/...`). */
export function esUrlImagenValida(valor: string): boolean {
  if (!valor || valor.length > 255) return false;
  if (valor.startsWith('/')) {
    return (
      !valor.startsWith('//') &&
      !valor.includes('\\') &&
      !valor.includes('..') &&
      !/[\s?#]/.test(valor)
    );
  }
  try {
    const url = new URL(valor);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/** Carpeta privada junto a los PDF: nunca dentro de frontend/public ni servida como estática. */
function directorio(): string {
  return path.join(path.resolve(env.PDF_DIR), 'fotos');
}

function ruta(nombre: string): string {
  if (!NOMBRE_FOTO.test(nombre)) throw AppError.noEncontrado('Foto no disponible.');
  return path.join(directorio(), nombre);
}

function invalida(mensaje: string): AppError {
  return AppError.solicitudInvalida(mensaje, [{ campo: 'foto', mensaje }]);
}

/** Extensión según la firma del contenido; null si no es JPEG, PNG ni WebP. */
export function extensionDeImagen(bytes: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export const almacenFotos = {
  /** Valida y guarda la imagen; devuelve la URL pública relativa que se guarda en persona.foto_url. */
  async guardar(bytes: Buffer): Promise<string> {
    if (bytes.length === 0) throw invalida('La imagen está vacía.');
    if (bytes.length > MAX_FOTO_BYTES) {
      throw new AppError(413, 'La foto supera el máximo de 2 MB.', 'ARCHIVO_DEMASIADO_GRANDE');
    }
    const extension = extensionDeImagen(bytes);
    if (!extension) {
      throw new AppError(415, 'Solo se admiten fotos JPG, PNG o WebP.', 'TIPO_ARCHIVO_INVALIDO');
    }
    const nombre = `${randomUUID()}.${extension}`;
    await mkdir(directorio(), { recursive: true });
    await writeFile(ruta(nombre), bytes, { flag: 'wx', mode: 0o600 });
    await binarioRepository.guardar(`fotos/${nombre}`, bytes);
    return PREFIJO_URL_FOTO + nombre;
  },

  async leer(nombre: string): Promise<{ bytes: Buffer; tipo: string }> {
    const destino = ruta(nombre);
    try {
      let info;
      try {
        info = await lstat(destino);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          const respaldado = await binarioRepository.leer(`fotos/${nombre}`);
          if (respaldado && respaldado.length <= MAX_FOTO_BYTES) {
            await mkdir(directorio(), { recursive: true });
            await writeFile(destino, respaldado, { mode: 0o600 }).catch(() => undefined);
            info = await lstat(destino);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
      if (!info.isFile() || info.size > MAX_FOTO_BYTES) throw new Error('No es una foto válida.');
      return { bytes: await readFile(destino), tipo: MIME[nombre.split('.').pop()!]! };
    } catch {
      throw AppError.noEncontrado('Foto no disponible.');
    }
  },

  /** Borra la foto de una URL propia; ignora URLs ajenas o ya borradas. */
  async eliminarPorUrl(url: string | null): Promise<void> {
    if (!url?.startsWith(PREFIJO_URL_FOTO)) return;
    const nombre = url.slice(PREFIJO_URL_FOTO.length);
    if (!NOMBRE_FOTO.test(nombre)) return;
    await binarioRepository.eliminar(`fotos/${nombre}`).catch(() => undefined);
    try {
      await unlink(ruta(nombre));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  },
};
