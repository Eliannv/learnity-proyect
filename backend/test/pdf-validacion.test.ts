import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { almacenLocal } from '../src/shared/archivos/almacen.js';
import { binarioRepository } from '../src/shared/archivos/binario.repository.js';
import { PREFIJO_URL_FOTO, almacenFotos } from '../src/shared/archivos/fotos.js';
import {
  MAX_PDF_BYTES,
  nombreOriginalPdf,
  validarBytesPdf,
} from '../src/shared/archivos/pdf-validacion.js';
import { env } from '../src/shared/config/env.js';
import { AppError } from '../src/shared/http/app-error.js';

async function pdf(): Promise<Buffer> {
  const documento = await PDFDocument.create();
  documento.addPage();
  return Buffer.from(await documento.save());
}

describe('Validación real de PDF', () => {
  it('acepta un documento con páginas y limpia el nombre recibido', async () => {
    await validarBytesPdf(await pdf());
    assert.equal(nombreOriginalPdf('C:\\documentos\\introduccion.PDF'), 'introduccion.PDF');
  });

  it('rechaza nombres de otro tipo y nombres demasiado largos', () => {
    assert.throws(
      () => nombreOriginalPdf('archivo.exe'),
      (error: unknown) => error instanceof AppError && error.status === 415,
    );

    assert.throws(() => nombreOriginalPdf('a'.repeat(201) + '.pdf'));
  });

  it('rechaza archivos vacíos, texto y una cabecera PDF simulada', async () => {
    const archivosInvalidos = [
      Buffer.alloc(0),
      Buffer.from('hola'),
      Buffer.from('%PDF-1.7\nNo es un PDF\n%%EOF'),
    ];

    for (const bytes of archivosInvalidos) {
      await assert.rejects(
        validarBytesPdf(bytes),
        (error: unknown) => error instanceof AppError && error.status === 400,
      );
    }
  });

  it('rechaza más de 10 MiB y permite el límite exacto', async () => {
    await assert.rejects(
      validarBytesPdf(Buffer.alloc(MAX_PDF_BYTES + 1)),
      (error: unknown) => error instanceof AppError && error.status === 413,
    );

    const original = await pdf();
    const marcador = original.lastIndexOf('%%EOF');
    const exacto = Buffer.concat([
      original.subarray(0, marcador),
      Buffer.alloc(MAX_PDF_BYTES - original.length, 32),
      original.subarray(marcador),
    ]);

    assert.equal(exacto.length, MAX_PDF_BYTES);
    await validarBytesPdf(exacto);
  });
});

describe('Respaldo binario en PostgreSQL (040_archivo_binario)', () => {
  it('recupera PDF y fotos automáticamente desde archivo_binario si el disco efímero se vacía', async () => {
    const dirBase = path.resolve(env.PDF_DIR);
    binarioRepository.activoEnPruebas = true;
    try {
      const bytesPdf = await pdf();
      const nombrePdf = `${randomUUID()}.pdf`;
      await almacenLocal.guardar(nombrePdf, bytesPdf);
      const rutaFisicaPdf = path.join(dirBase, nombrePdf);
      assert.equal(existsSync(rutaFisicaPdf), true);

      unlinkSync(rutaFisicaPdf);
      assert.equal(existsSync(rutaFisicaPdf), false);

      assert.equal(await almacenLocal.existeYCoincide(nombrePdf, bytesPdf.length), true);
      const recuperadoPdf = await almacenLocal.leer(nombrePdf, bytesPdf.length);
      assert.deepEqual(recuperadoPdf, bytesPdf);
      assert.equal(existsSync(rutaFisicaPdf), true);
      await almacenLocal.eliminar(nombrePdf);

      const bytesJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
      const urlFoto = await almacenFotos.guardar(bytesJpeg);
      assert.equal(urlFoto.startsWith(PREFIJO_URL_FOTO), true);
      const nombreFoto = urlFoto.slice(PREFIJO_URL_FOTO.length);
      const rutaFisicaFoto = path.join(dirBase, 'fotos', nombreFoto);
      assert.equal(existsSync(rutaFisicaFoto), true);

      unlinkSync(rutaFisicaFoto);
      assert.equal(existsSync(rutaFisicaFoto), false);

      const recuperadaFoto = await almacenFotos.leer(nombreFoto);
      assert.deepEqual(recuperadaFoto.bytes, bytesJpeg);
      assert.equal(recuperadaFoto.tipo, 'image/jpeg');
      assert.equal(existsSync(rutaFisicaFoto), true);
      await almacenFotos.eliminarPorUrl(urlFoto);
    } finally {
      binarioRepository.activoEnPruebas = false;
    }
  });
});
