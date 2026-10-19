// PDF mínimo válido, subida multipart y la invariante "filas de archivo = ficheros en PDF_DIR".
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { Fixtures } from './bd-fixtures.js';
import type { Respuesta, Servidor } from './servidor.js';

/** Crea una carpeta temporal propia y la fija en PDF_DIR. Llamar ANTES de iniciarServidor(). */
export function carpetaPdfPropia(prefijo = 'learnity-car-'): { dir: string; borrar(): void } {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefijo));
  process.env['PDF_DIR'] = dir;
  return { dir, borrar: () => rmSync(dir, { recursive: true, force: true }) };
}

export async function pdfMinimo(paginas = 1): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

export function subirPdf(
  srv: Servidor, idLeccion: number | string, token: string, bytes: Buffer, nombre = 'apunte.pdf', campo = 'archivo',
): Promise<Respuesta> {
  const fd = new FormData();
  fd.append(campo, new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), nombre);
  return srv.pedir(`/api/lecciones/${idLeccion}/archivo`, { metodo: 'POST', token, crudo: fd });
}

export function ficheros(dir: string): string[] {
  return readdirSync(dir).filter((n) => n.endsWith('.pdf'));
}

/** Invariante: filas de archivo de los cursos dados frente a ficheros .pdf en la carpeta. */
export async function filasYFicheros(f: Fixtures, dir: string, idsCurso: number[]): Promise<{ filas: number; ficheros: number }> {
  const { rows: [r] } = await f.query<{ n: string }>('SELECT count(*) AS n FROM archivo WHERE id_curso = ANY($1::int[])', [idsCurso]);
  return { filas: Number(r!.n), ficheros: ficheros(dir).length };
}
