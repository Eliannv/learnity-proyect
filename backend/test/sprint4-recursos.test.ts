import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, pdfMinimo } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s4_rec');
const pdfDir = carpetaPdfPropia();
let f: Fixtures;
let srv: Servidor;
let docente: Cuenta;
let ajeno: Cuenta;
let admin: Cuenta;
let estudiante: Cuenta;
let c: ReturnType<typeof fabricaCursos>;
let cursoId = 0;
let leccionId = 0;

/** ZIP mínimo válido: solo el registro de fin de directorio central. */
const zipVacio = () => Buffer.from([0x50, 0x4b, 0x05, 0x06, ...new Array(18).fill(0)]);

function subirRecurso(quien: Cuenta, bytes: Buffer, nombre: string, idLeccion = leccionId) {
  const fd = new FormData();
  fd.append('archivo', new Blob([new Uint8Array(bytes)]), nombre);
  return srv.pedir(`/api/lecciones/${idLeccion}/recursos`, { metodo: 'POST', token: quien.token, crudo: fd });
}

const recursosDe = (curso: any) => curso.modulos[0].lecciones.find((l: any) => l.id === leccionId).recursos;
const enDisco = () => readdirSync(pdfDir.dir).filter((n) => !n.startsWith('.')).length;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  ajeno = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  estudiante = await cuentas.crearCuenta(['ESTUDIANTE']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
  const completo = await c.cursoCompleto(docente);
  cursoId = completo.idCurso;
  leccionId = completo.idLeccion;
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

describe('Sprint 4 · recursos adjuntos descargables', () => {
  it('el docente adjunta un ZIP y un PDF; se rechazan extensiones y contenidos que no coinciden', async () => {
    const zip = await subirRecurso(docente, zipVacio(), 'codigo-del-modulo.zip');
    assert.equal(zip.status, 201, zip.texto);
    const pdf = await subirRecurso(docente, await pdfMinimo(1), 'diapositivas.pdf');
    assert.equal(pdf.status, 201, pdf.texto);
    const recursos = recursosDe(pdf.json);
    assert.deepEqual(recursos.map((r: any) => [r.titulo, r.tipo]), [['codigo-del-modulo', 'ZIP'], ['diapositivas', 'PDF']]);

    assert.equal((await subirRecurso(docente, zipVacio(), 'script.exe')).status, 415);
    assert.equal((await subirRecurso(docente, Buffer.from('no soy un zip'), 'falso.zip')).status, 400);
    assert.equal((await subirRecurso(docente, zipVacio(), 'presentacion.ppt')).status, 400);
    assert.equal((await subirRecurso(ajeno, zipVacio(), 'ajeno.zip')).status, 403);
  });

  it('limita a 5 recursos por lección', async () => {
    for (const n of [3, 4, 5]) {
      assert.equal((await subirRecurso(docente, zipVacio(), `extra-${n}.zip`)).status, 201);
    }
    const sexto = await subirRecurso(docente, zipVacio(), 'sexto.zip');
    assert.equal(sexto.status, 400, sexto.texto);
  });

  it('el estudiante inscrito los ve en su temario y los descarga con su tipo; quien no está inscrito, no', async () => {
    await c.enviarARevision(docente, cursoId);
    assert.equal((await c.como(admin, 'PUT', `/api/admin/cursos/${cursoId}/revision`, { decision: 'APROBAR' })).status, 200);

    const detalle = await c.como(docente, 'GET', `/api/docente/cursos/${cursoId}`);
    const zip = recursosDe(detalle.json)[0];
    assert.equal((await c.como(estudiante, 'GET', `/api/archivos/${zip.archivoId}`)).status, 403);

    assert.equal((await c.como(estudiante, 'POST', `/api/cursos/${cursoId}/inscripcion`)).status, 201);
    const aprendizaje = await c.como(estudiante, 'GET', `/api/mi-aprendizaje/cursos/${cursoId}`);
    const leccion = aprendizaje.json.modulos[0].lecciones.find((l: any) => l.id === leccionId);
    assert.equal(leccion.recursos.length, 5);
    assert.deepEqual(Object.keys(leccion.recursos[0]).sort(), ['archivoId', 'id', 'nombreOriginal', 'tamanoBytes', 'tipo', 'titulo']);

    const descarga = await c.como(estudiante, 'GET', `/api/archivos/${zip.archivoId}`);
    assert.equal(descarga.status, 200);
    assert.equal(descarga.headers.get('content-type'), 'application/zip');
    assert.match(descarga.headers.get('content-disposition') ?? '', /codigo-del-modulo\.zip/);
  });

  it('quitar un recurso retira su archivo del disco; borrar la lección retira los demás', async () => {
    const antes = enDisco();
    const detalle = await c.como(docente, 'GET', `/api/docente/cursos/${cursoId}`);
    const primero = recursosDe(detalle.json)[0];
    assert.equal((await c.como(ajeno, 'DELETE', `/api/recursos/${primero.id}`)).status, 403);
    const quitado = await c.como(docente, 'DELETE', `/api/recursos/${primero.id}`);
    assert.equal(quitado.status, 200, quitado.texto);
    assert.equal(recursosDe(quitado.json).length, 4);
    assert.equal(enDisco(), antes - 1);
    assert.equal((await c.como(docente, 'DELETE', `/api/recursos/${primero.id}`)).status, 404);

    // En un curso publicado, se añade otra lección para que borrar esta no lo deje vacío.
    const otra = await c.como(docente, 'POST', `/api/modulos/${detalle.json.modulos[0].id}/lecciones`, {
      titulo: 'Vídeo', orden: 2, tipo: 'VIDEO', youtubeUrl: 'dQw4w9WgXcQ',
    });
    assert.equal(otra.status, 201, otra.texto);
    const borrada = await c.como(docente, 'DELETE', `/api/lecciones/${leccionId}`);
    assert.equal(borrada.status, 200, borrada.texto);
    const { rows } = await f.query<{ n: number }>('SELECT count(*)::int AS n FROM archivo WHERE id_curso = $1', [cursoId]);
    assert.equal(rows[0]!.n, 0);
    assert.equal(enDisco(), 0);
  });
});
