import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

import { AppError } from '../http/app-error.js';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export const NOMBRE_PDF_INTERNO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i;

function invalido(mensaje: string): AppError {
  return AppError.solicitudInvalida(mensaje, [
    {
      campo: 'archivo',
      mensaje,
    },
  ]);
}

export function nombreOriginalPdf(nombre: string): string {
  const limpio = path.posix
    .basename(nombre.replaceAll('\\', '/'))
    .normalize('NFC')
    .trim();

  if (!/\.pdf$/i.test(limpio)) {
    throw new AppError(
      415,
      'Solo se admiten archivos PDF.',
      'TIPO_ARCHIVO_INVALIDO',
    );
  }

  if (
    limpio.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(limpio)
  ) {
    throw invalido(
      'El nombre del PDF no es válido o supera 200 caracteres.',
    );
  }

  return limpio;
}

export async function validarBytesPdf(
  bytes: Uint8Array,
): Promise<void> {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new AppError(
      413,
      'El PDF supera el máximo permitido de 10 MiB.',
      'ARCHIVO_DEMASIADO_GRANDE',
    );
  }

  if (bytes.byteLength === 0) {
    throw invalido('El archivo está vacío.');
  }

  const buffer = Buffer.from(bytes);

  const cabeceraValida = /^%PDF-\d\.\d/.test(
    buffer.subarray(0, 16).toString('latin1'),
  );

  const tieneFinalPdf = buffer
    .subarray(-2048)
    .toString('latin1')
    .includes('%%EOF');

  if (!cabeceraValida || !tieneFinalPdf) {
    throw invalido(
      'El contenido del archivo no es un PDF válido.',
    );
  }

  try {
    const documento = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });

    if (
      documento.isEncrypted ||
      documento.getPageCount() < 1
    ) {
      throw new Error('PDF sin páginas o cifrado.');
    }

    documento.getPages();
  } catch {
    throw invalido(
      'El PDF está dañado, cifrado o no contiene páginas válidas.',
    );
  }
}