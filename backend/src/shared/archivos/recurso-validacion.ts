import { open, stat } from 'node:fs/promises';
import path from 'node:path';

import { AppError } from '../http/app-error.js';
import { MAX_PDF_BYTES, validarArchivoPdf } from './pdf-validacion.js';

/** Material descargable de una lección: PDF, presentaciones y ZIP (código, plantillas). */
export type TipoRecurso = 'PDF' | 'PPT' | 'ZIP';

export const MAX_RECURSO_BYTES = MAX_PDF_BYTES;

/** Nombre interno de cualquier archivo del almacén: un UUID v4 con su extensión. */
export const NOMBRE_ARCHIVO_INTERNO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|ppt|pptx|zip)$/i;

const EXTENSIONES: Readonly<Record<string, TipoRecurso>> = {
  '.pdf': 'PDF',
  '.ppt': 'PPT',
  '.pptx': 'PPT',
  '.zip': 'ZIP',
};

export const TIPO_MIME: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

const ZIP = [Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from([0x50, 0x4b, 0x05, 0x06])];
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function invalido(mensaje: string): AppError {
  return AppError.solicitudInvalida(mensaje, [{ campo: 'archivo', mensaje }]);
}

export interface NombreRecurso {
  original: string;
  extension: string;
  tipo: TipoRecurso;
}

/** Limpia el nombre que envía el navegador y deduce el tipo por su extensión. */
export function nombreOriginalRecurso(nombre: string): NombreRecurso {
  const original = path.posix.basename(nombre.replaceAll('\\', '/')).normalize('NFC').trim();
  const extension = path.extname(original).toLowerCase();
  const tipo = EXTENSIONES[extension];

  if (!tipo) {
    throw new AppError(415, 'Solo se admiten archivos PDF, PPT, PPTX o ZIP.', 'TIPO_ARCHIVO_INVALIDO');
  }
  if (original.length > 200 || original.length <= extension.length || /[\u0000-\u001f\u007f]/.test(original)) {
    throw invalido('El nombre del archivo no es válido o supera 200 caracteres.');
  }
  return { original, extension, tipo };
}

/** Título visible del recurso: el nombre sin la extensión, en 150 caracteres como máximo. */
export function tituloRecurso(nombre: NombreRecurso): string {
  return nombre.original.slice(0, -nombre.extension.length).trim().slice(0, 150) || nombre.original.slice(0, 150);
}

/**
 * Comprueba el temporal de la subida: tamaño y firma del contenido coherente con la extensión
 * (un .zip o .pptx empieza como ZIP; un .ppt, como documento OLE). Un PDF pasa la validación completa.
 * Devuelve el tamaño en bytes.
 */
export async function validarArchivoRecurso(ruta: string, nombre: NombreRecurso): Promise<number> {
  if (nombre.tipo === 'PDF') return validarArchivoPdf(ruta);

  const { size } = await stat(ruta);
  if (size > MAX_RECURSO_BYTES) {
    throw new AppError(413, 'El archivo supera el máximo permitido de 10 MiB.', 'ARCHIVO_DEMASIADO_GRANDE');
  }
  if (size === 0) throw invalido('El archivo está vacío.');

  const cabecera = Buffer.alloc(8);
  const archivo = await open(ruta, 'r');
  try {
    await archivo.read(cabecera, 0, 8, 0);
  } finally {
    await archivo.close();
  }

  const esZip = ZIP.some((firma) => cabecera.subarray(0, 4).equals(firma));
  const valido = nombre.extension === '.ppt' ? cabecera.equals(OLE) : esZip;
  if (!valido) {
    throw invalido(`El contenido no corresponde a un archivo ${nombre.extension.slice(1).toUpperCase()}.`);
  }
  return size;
}
