// Caracterización del módulo de contenido: subida y descarga de PDF (CAR-CON-01..07, PREC-5).
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, ficheros, filasYFicheros, pdfDeTamano, pdfMinimo, subirPdf } from '../ayudas/archivos.js';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { capturar } from '../ayudas/captura.js';
import { claves, sinRutasPrivadas } from '../ayudas/contrato.js';
import { crearMarca } from '../ayudas/datos.js';
import { fabricaCursos } from '../ayudas/cursos-http.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('car_con');
const pdfDir = carpetaPdfPropia();

let f: Fixtures;
let srv: Servidor;
let docA: Cuenta;
let docB: Cuenta;
let est: Cuenta;
let admin: Cuenta;
let categoriaId = 0;
let c: ReturnType<typeof fabricaCursos>;

const archivoDe = (json: any) => json.modulos[0].lecciones[0].archivo;
const forzarEstado = (idCurso: number, estado: string) =>
  f.query(
    `UPDATE curso SET estado = $2::text, revisado_por = CASE WHEN $2::text = 'PUBLICADO' THEN $3::int END,
       publicado_en = CASE WHEN $2::text = 'PUBLICADO' THEN now() END WHERE id_curso = $1`,
    [idCurso, estado, admin.idPersona]);

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  docA = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  docB = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  est = await fab.crearCuenta(['ESTUDIANTE']);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  const r = await f.query<{ id: number }>('INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, docA.idPersona]);
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

async function leccionNueva(cuenta: Cuenta = docA) {
  const idCurso = await c.crearCurso(cuenta);
  const idModulo = await c.crearModulo(cuenta, idCurso);
  const idLeccion = await c.crearLeccion(cuenta, idModulo);
  return { idCurso, idModulo, idLeccion };
}

describe('POST /api/lecciones/:id/archivo (CAR-CON-01..04, 07)', () => {
  it('CAR-CON-01: PDF válido -> 200 con archivo sin ruta', async () => {
    const { idCurso, idLeccion } = await leccionNueva();
    const r = await subirPdf(srv, idLeccion, docA.token, await pdfMinimo(3), 'apunte.pdf');
    assert.equal(r.status, 200, r.texto);
    const a = archivoDe(r.json);
    assert.deepEqual(claves(a), ['id', 'nombreOriginal', 'tamanoBytes', 'tipo']);
    assert.equal(a.nombreOriginal, 'apunte.pdf');
    assert.equal(a.tipo, 'PDF');
    assert.deepEqual(sinRutasPrivadas(r.json), []);
    assert.ok(!r.texto.includes(pdfDir.dir));
    assert.deepEqual(await filasYFicheros(f, pdfDir.dir, [idCurso]), { filas: 1, ficheros: ficheros(pdfDir.dir).length });
  });

  it('CAR-CON-02: validaciones de la subida', async () => {
    const { idLeccion } = await leccionNueva();
    const pdf = await pdfMinimo();
    // Sin multipart
    const sinMultipart = await srv.pedir(`/api/lecciones/${idLeccion}/archivo`, { metodo: 'POST', token: docA.token, cuerpo: {} });
    assert.equal(sinMultipart.status, 415);
    assert.equal(sinMultipart.json.error.codigo, 'TIPO_ARCHIVO_INVALIDO');
    assert.equal(sinMultipart.json.error.mensaje, 'Utiliza multipart/form-data con el campo archivo.');
    // Otro nombre de campo
    const otroCampo = await subirPdf(srv, idLeccion, docA.token, pdf, 'a.pdf', 'documento');
    assert.equal(otroCampo.status, 400);
    capturar('CAR-CON-02 otro campo', otroCampo.json.error);
    // Campo extra
    const fdExtra = new FormData();
    fdExtra.append('archivo', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), 'a.pdf');
    fdExtra.append('x', '1');
    const extra = await srv.pedir(`/api/lecciones/${idLeccion}/archivo`, { metodo: 'POST', token: docA.token, crudo: fdExtra });
    assert.equal(extra.status, 400);
    assert.equal(extra.json.error.mensaje, 'Envía un único archivo en el campo archivo, sin otros campos.');
    // Dos archivos
    const fdDos = new FormData();
    fdDos.append('archivo', new Blob([new Uint8Array(pdf)]), 'a.pdf');
    fdDos.append('archivo', new Blob([new Uint8Array(pdf)]), 'b.pdf');
    const dos = await srv.pedir(`/api/lecciones/${idLeccion}/archivo`, { metodo: 'POST', token: docA.token, crudo: fdDos });
    assert.equal(dos.status, 400);
    // .exe
    const exe = await subirPdf(srv, idLeccion, docA.token, pdf, 'virus.exe');
    assert.equal(exe.status, 415);
    assert.equal(exe.json.error.mensaje, 'Solo se admiten archivos PDF.');
    // Cabecera falsa
    const falso = await subirPdf(srv, idLeccion, docA.token, Buffer.from('esto no es un pdf'), 'f.pdf');
    assert.equal(falso.status, 400);
    assert.equal(falso.json.error.mensaje, 'El contenido del archivo no es un PDF válido.');
    // Archivo vacío
    const vacio = await subirPdf(srv, idLeccion, docA.token, Buffer.alloc(0), 'v.pdf');
    capturar('CAR-CON-02 vacio', { status: vacio.status, error: vacio.json?.error });
    // Sin ninguna parte (multipart sin archivo)
    const sinArchivo = await srv.pedir(`/api/lecciones/${idLeccion}/archivo`, {
      metodo: 'POST', token: docA.token,
      headers: { 'content-type': 'multipart/form-data; boundary=x' }, crudo: '--x--\r\n',
    });
    assert.equal(sinArchivo.status, 400);
    capturar('CAR-CON-02 sin archivo', sinArchivo.json.error);
    // > 10 MiB
    const grande = await subirPdf(srv, idLeccion, docA.token, Buffer.alloc(10 * 1024 * 1024 + 1, 1), 'g.pdf');
    assert.equal(grande.status, 413);
    assert.equal(grande.json.error.codigo, 'ARCHIVO_DEMASIADO_GRANDE');
    assert.equal(grande.json.error.mensaje, 'El PDF supera 10 MiB.');
  });

  it('CAR-CON-03: reemplazo conserva una sola fila y un solo fichero por lección', async () => {
    const { idCurso, idLeccion } = await leccionNueva();
    const a = await subirPdf(srv, idLeccion, docA.token, await pdfMinimo(1), 'uno.pdf');
    assert.equal(a.status, 200);
    const idPrimero = archivoDe(a.json).id;
    const b = await subirPdf(srv, idLeccion, docA.token, await pdfMinimo(2), 'dos.pdf');
    assert.equal(b.status, 200);
    assert.equal(archivoDe(b.json).nombreOriginal, 'dos.pdf');
    assert.notEqual(archivoDe(b.json).id, idPrimero);
    const { rows } = await f.query<{ n: string }>('SELECT count(*) AS n FROM archivo WHERE id_curso = $1', [idCurso]);
    capturar('CAR-CON-03 filas tras reemplazo', rows[0]!.n);
    assert.equal(rows[0]!.n, '1');
    const { filas } = await filasYFicheros(f, pdfDir.dir, [idCurso]);
    assert.equal(filas, 1);
  });

  it('CAR-CON-04: lección ajena, curso bloqueado y lección que no es DOCUMENTO', async () => {
    const { idCurso, idLeccion } = await leccionNueva();
    const pdf = await pdfMinimo();
    const ajena = await subirPdf(srv, idLeccion, docB.token, pdf);
    assert.equal(ajena.status, 403);
    capturar('CAR-CON-04 ajena', ajena.json.error);
    const est403 = await subirPdf(srv, idLeccion, est.token, pdf);
    assert.equal(est403.status, 403);
    assert.equal(est403.json.error.codigo, 'SIN_PERMISO');
    for (const e of ['EN_REVISION', 'PUBLICADO', 'ARCHIVADO']) {
      await forzarEstado(idCurso, e);
      const r = await subirPdf(srv, idLeccion, docA.token, pdf);
      assert.equal(r.status, 409, e);
      capturar(`CAR-CON-04 ${e}`, r.json.error);
    }
    await forzarEstado(idCurso, 'BORRADOR');
    const { rows } = await f.query<{ id: number }>(
      "INSERT INTO leccion (id_modulo, titulo, tipo, orden) SELECT id_modulo, 'Video', 'VIDEO', 2 FROM leccion WHERE id_leccion = $1 RETURNING id_leccion AS id", [idLeccion]);
    const video = await subirPdf(srv, rows[0]!.id, docA.token, pdf);
    assert.equal(video.status, 400);
    capturar('CAR-CON-04 VIDEO', video.json.error);
  });

  it('PREC-5: id inválido, lección ajena y lección propia sin multipart', async () => {
    const { idLeccion } = await leccionNueva();
    const sinMultipart = (id: string, t: string) => srv.pedir(`/api/lecciones/${id}/archivo`, { metodo: 'POST', token: t });
    assert.equal((await sinMultipart('abc', docA.token)).status, 400);
    assert.equal((await sinMultipart(String(idLeccion), docB.token)).status, 403);
    assert.equal((await sinMultipart(String(idLeccion), docA.token)).status, 415);
    assert.equal((await sinMultipart('2147483647', docA.token)).status, 404);
  });

  it('CAR-CON-07: tamaño exacto, nombre de 200/201 caracteres y unicode NFD', async () => {
    const { idLeccion } = await leccionNueva();
    const limite = await subirPdf(srv, idLeccion, docA.token, await pdfDeTamano(10 * 1024 * 1024), 'limite.pdf');
    assert.equal(limite.status, 200, limite.texto);
    assert.equal(archivoDe(limite.json).tamanoBytes, 10 * 1024 * 1024);
    const pdf = await pdfMinimo();
    const n200 = await subirPdf(srv, idLeccion, docA.token, pdf, 'a'.repeat(196) + '.pdf');
    assert.equal(n200.status, 200);
    const n201 = await subirPdf(srv, idLeccion, docA.token, pdf, 'a'.repeat(197) + '.pdf');
    assert.equal(n201.status, 400);
    assert.equal(n201.json.error.mensaje, 'El nombre del PDF no es válido o supera 200 caracteres.');
    const nfd = await subirPdf(srv, idLeccion, docA.token, pdf, 'café ñandú.pdf');
    assert.equal(nfd.status, 200);
    capturar('CAR-CON-07 nfd', archivoDe(nfd.json).nombreOriginal === 'café ñandú.pdf' ? 'NFC' : archivoDe(nfd.json).nombreOriginal);
    const ruta = await subirPdf(srv, idLeccion, docA.token, pdf, '../../etc/pasaporte.pdf');
    assert.equal(ruta.status, 200);
    assert.equal(archivoDe(ruta.json).nombreOriginal, 'pasaporte.pdf');
  });
});

describe('GET /api/archivos/:id (CAR-CON-05, 06)', () => {
  it('CAR-CON-05: propietario y ADMIN descargan los bytes con cabeceras seguras', async () => {
    const { idArchivo } = await c.cursoCompleto(docA);
    for (const quien of [docA, admin]) {
      const r = await fetch(`${srv.base}/api/archivos/${idArchivo}`, { headers: { authorization: `Bearer ${quien.token}` } });
      assert.equal(r.status, 200);
      assert.match(r.headers.get('content-type') ?? '', /^application\/pdf/);
      assert.match(r.headers.get('content-disposition') ?? '', /^attachment; filename=/);
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      const bytes = Buffer.from(await r.arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-');
    }
  });

  it('CAR-CON-06: docente ajeno, ESTUDIANTE, inexistente y archivo sin lección', async () => {
    const { idCurso, idLeccion, idArchivo } = await c.cursoCompleto(docA);
    const ajeno = await c.como(docB, 'GET', `/api/archivos/${idArchivo}`);
    assert.equal(ajeno.status, 403);
    capturar('CAR-CON-06 ajeno', ajeno.json.error);
    const e = await c.como(est, 'GET', `/api/archivos/${idArchivo}`);
    assert.equal(e.status, 403);
    assert.equal(e.json.error.codigo, 'SIN_PERMISO');
    const inex = await c.como(docA, 'GET', '/api/archivos/2147483647');
    assert.equal(inex.status, 404);
    assert.equal(inex.json.error.mensaje, 'Archivo no encontrado.');
    assert.equal((await c.como(docA, 'GET', '/api/archivos/abc')).status, 400);
    const sinAuth = await srv.pedir(`/api/archivos/${idArchivo}`);
    assert.equal(sinAuth.status, 401);
    // Archivo huérfano (sin lección asociada)
    await f.query('UPDATE leccion SET id_archivo = NULL WHERE id_leccion = $1', [idLeccion]);
    const huerfano = await c.como(docA, 'GET', `/api/archivos/${idArchivo}`);
    assert.equal(huerfano.status, 404);
    capturar('CAR-CON-06 huérfano', huerfano.json.error);
    void idCurso;
  });
});
