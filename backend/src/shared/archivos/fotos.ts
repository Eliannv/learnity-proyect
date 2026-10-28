import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env.js';
import { AppError } from '../http/app-error.js';

/** Fotos de perfil: hasta 2 MiB, JPEG, PNG o WebP reconocidos por su contenido (no por la extensión). */
export const MAX_FOTO_BYTES = 2 * 1024 * 1024;
export const PREFIJO_URL_FOTO = '/api/fotos/';
export const NOMBRE_FOTO = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const MIME: Readonly<Record<string, string>> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

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
    return PREFIJO_URL_FOTO + nombre;
  },

  async leer(nombre: string): Promise<{ bytes: Buffer; tipo: string }> {
    const destino = ruta(nombre);
    try {
      const info = await lstat(destino);
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
    try {
      await unlink(ruta(nombre));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  },
};
