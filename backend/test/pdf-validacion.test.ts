import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';

import {
  describe,
  it,
} from 'node:test';

import { PDFDocument } from 'pdf-lib';

import {
  MAX_PDF_BYTES,
  nombreOriginalPdf,
  validarBytesPdf,
} from '../src/shared/archivos/pdf-validacion.js';

import {
  AppError,
} from '../src/shared/http/app-error.js';

async function pdf(): Promise<Buffer> {
  const documento = await PDFDocument.create();

  documento.addPage();

  return Buffer.from(
    await documento.save(),
  );
}

describe('Validación real de PDF', () => {
  it(
    'acepta un documento con páginas y limpia el nombre recibido',
    async () => {
      await validarBytesPdf(await pdf());

      assert.equal(
        nombreOriginalPdf(
          'C:\\documentos\\introduccion.PDF',
        ),
        'introduccion.PDF',
      );
    },
  );

  it(
    'rechaza nombres de otro tipo y nombres demasiado largos',
    () => {
      assert.throws(
        () => nombreOriginalPdf('archivo.exe'),
        (error: unknown) =>
          error instanceof AppError &&
          error.status === 415,
      );

      assert.throws(
        () => nombreOriginalPdf(
          'a'.repeat(201) + '.pdf',
        ),
      );
    },
  );

  it(
    'rechaza archivos vacíos, texto y una cabecera PDF simulada',
    async () => {
      const archivosInvalidos = [
        Buffer.alloc(0),
        Buffer.from('hola'),
        Buffer.from(
          '%PDF-1.7\nNo es un PDF\n%%EOF',
        ),
      ];

      for (const bytes of archivosInvalidos) {
        await assert.rejects(
          validarBytesPdf(bytes),
          (error: unknown) =>
            error instanceof AppError &&
            error.status === 400,
        );
      }
    },
  );

  it(
    'rechaza más de 10 MiB y permite el límite exacto',
    async () => {
      await assert.rejects(
        validarBytesPdf(
          Buffer.alloc(MAX_PDF_BYTES + 1),
        ),
        (error: unknown) =>
          error instanceof AppError &&
          error.status === 413,
      );

      const original = await pdf();

      const marcador =
        original.lastIndexOf('%%EOF');

      const exacto = Buffer.concat([
        original.subarray(0, marcador),

        Buffer.alloc(
          MAX_PDF_BYTES - original.length,
          32,
        ),

        original.subarray(marcador),
      ]);

      assert.equal(
        exacto.length,
        MAX_PDF_BYTES,
      );

      await validarBytesPdf(exacto);
    },
  );
});