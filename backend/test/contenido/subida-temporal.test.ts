// ADR-011, 11.5: la subida se recibe en un temporal en disco y se renombra al nombre definitivo.
// No cambia el contrato: aquí se comprueba el modo de fallo (sin temporales huérfanos) y que los
// fallos inyectados en el almacén siguen ocurriendo (H9/RG-06: el contador de llamadas debe ser > 0).
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { mkdir, readdir, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, ficheros, pdfDeTamano, pdfMinimo, subirPdf } from '../ayudas/archivos.js';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { fabricaCursos } from '../ayudas/cursos-http.js';
import { crearMarca } from '../ayudas/datos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('be_tmp');
const pdfDir = carpetaPdfPropia('learnity-tmp-');
const dirTemporal = path.join(pdfDir.dir, '.tmp');

const { almacenLocal } = await import('../../src/shared/archivos/almacen.js');

let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let categoriaId = 0;

const temporales = async () => (await readdir(dirTemporal).catch(() => [] as string[])).filter((n) => n.endsWith('.tmp'));

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  docente = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  const r = await f.query<{ id: number }>('INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, docente.idPersona]);
  categoriaId = r.rows[0]!.id;
  c = fabricaCursos(srv, marca, () => categoriaId);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

async function leccionNueva() {
  const idCurso = await c.crearCurso(docente);
  const idModulo = await c.crearModulo(docente, idCurso);
  return c.crearLeccion(docente, idModulo);
}

describe('Subida a disco temporal (11.5)', () => {
  it('una subida correcta deja el PDF definitivo y ningún temporal', async () => {
    const antes = ficheros(pdfDir.dir).length;
    const r = await subirPdf(srv, await leccionNueva(), docente.token, await pdfMinimo(2));
    assert.equal(r.status, 200, r.texto);
    assert.equal(ficheros(pdfDir.dir).length, antes + 1);
    assert.deepEqual(await temporales(), []);
  });

  it('un PDF inválido responde 400 como antes y no deja temporal ni definitivo', async () => {
    const idLeccion = await leccionNueva();
    const antes = ficheros(pdfDir.dir).length;
    const r = await subirPdf(srv, idLeccion, docente.token, Buffer.from('%PDF-1.4 contenido roto'));
    assert.equal(r.status, 400, r.texto);
    assert.equal(ficheros(pdfDir.dir).length, antes);
    assert.deepEqual(await temporales(), []);
  });

  it('un archivo que supera 10 MiB responde 413 y borra el temporal parcial', async () => {
    const idLeccion = await leccionNueva();
    const r = await subirPdf(srv, idLeccion, docente.token, Buffer.alloc(10 * 1024 * 1024 + 1024, 0x25));
    assert.equal(r.status, 413, r.texto);
    assert.equal(r.json.error.codigo, 'ARCHIVO_DEMASIADO_GRANDE');
    assert.deepEqual(await temporales(), []);
  });

  it('un PDF de exactamente 10 MiB se admite', async () => {
    const idLeccion = await leccionNueva();
    const r = await subirPdf(srv, idLeccion, docente.token, await pdfDeTamano(10 * 1024 * 1024));
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual(await temporales(), []);
  });

  it('disco lleno al recibir: 500 ERROR_INTERNO controlado, sin ruta y sin temporales', async () => {
    const idLeccion = await leccionNueva();
    const original = almacenLocal.reservarTemporal;
    let llamadas = 0;
    almacenLocal.reservarTemporal = async () => {
      llamadas += 1;
      throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC', syscall: 'write' });
    };
    try {
      const r = await subirPdf(srv, idLeccion, docente.token, await pdfMinimo());
      assert.ok(llamadas > 0, 'el fallo inyectado no ocurrió');
      assert.equal(r.status, 500, r.texto);
      assert.equal(r.json.error.codigo, 'ERROR_INTERNO');
      assert.ok(!r.texto.includes(pdfDir.dir));
    } finally {
      almacenLocal.reservarTemporal = original;
    }
    assert.deepEqual(await temporales(), []);
  });

  it('fallo de disco al guardar el definitivo: 500, el fallo se inyectó y no quedan archivos nuevos', async () => {
    const idLeccion = await leccionNueva();
    const antes = ficheros(pdfDir.dir).sort();
    const original = almacenLocal.guardar;
    let llamadas = 0;
    almacenLocal.guardar = async () => {
      llamadas += 1;
      throw new Error('sin espacio');
    };
    try {
      const r = await subirPdf(srv, idLeccion, docente.token, await pdfMinimo());
      assert.ok(llamadas > 0, 'el fallo inyectado no ocurrió');
      assert.equal(r.status, 500, r.texto);
      assert.equal(r.json.error.codigo, 'ERROR_INTERNO');
    } finally {
      almacenLocal.guardar = original;
    }
    assert.deepEqual(ficheros(pdfDir.dir).sort(), antes);
    assert.deepEqual(await temporales(), []);
    const { rows } = await f.query('SELECT 1 FROM leccion WHERE id_leccion = $1 AND id_archivo IS NOT NULL', [idLeccion]);
    assert.equal(rows.length, 0);
  });
});

describe('almacenLocal: temporales', () => {
  it('guardar desde un temporal lo mueve al nombre definitivo y no sobrescribe', async () => {
    const nombre = '3f2b8c1e-5a47-4d9b-8e21-0c6a7b9d1f34.pdf';
    const ruta = await almacenLocal.reservarTemporal();
    const bytes = await pdfMinimo();
    await writeFile(ruta, bytes);
    await almacenLocal.guardar(nombre, { rutaTemporal: ruta });
    assert.deepEqual(await almacenLocal.leer(nombre, bytes.length), bytes);
    assert.equal(await almacenLocal.existeYCoincide(nombre, bytes.length), true);
    assert.ok(!(await temporales()).includes(path.basename(ruta)));

    const otra = await almacenLocal.reservarTemporal();
    await writeFile(otra, bytes);
    await assert.rejects(almacenLocal.guardar(nombre, { rutaTemporal: otra }), { code: 'EEXIST' });
    await almacenLocal.descartarTemporal(otra);
    await almacenLocal.eliminar(nombre);
    await almacenLocal.eliminar(nombre); // idempotente
  });

  it('rechaza rutas temporales fuera de PDF_DIR/.tmp', async () => {
    const fuera = path.join(pdfDir.dir, 'x.tmp');
    await writeFile(fuera, 'x');
    await assert.rejects(almacenLocal.guardar('3f2b8c1e-5a47-4d9b-8e21-0c6a7b9d1f35.pdf', { rutaTemporal: fuera }));
    await assert.rejects(almacenLocal.descartarTemporal(fuera));
  });

  it('limpiarTemporales borra solo los huérfanos antiguos', async () => {
    await mkdir(dirTemporal, { recursive: true });
    const viejo = path.join(dirTemporal, 'viejo.tmp');
    const nuevo = path.join(dirTemporal, 'nuevo.tmp');
    await writeFile(viejo, 'x');
    await writeFile(nuevo, 'x');
    const hace2h = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await utimes(viejo, hace2h, hace2h);
    assert.equal(await almacenLocal.limpiarTemporales(60 * 60 * 1000), 1);
    const quedan = await temporales();
    assert.ok(quedan.includes('nuevo.tmp') && !quedan.includes('viejo.tmp'));
    await almacenLocal.descartarTemporal(nuevo);
  });
});
