// SEG-25b (D-01, RG-30/H3): ninguna operación del temario ni la subida leen el disco con la fila `curso`
// bloqueada. Se retrasa `almacenLocal.leer` (seam de RG-06) y, DURANTE cada lectura, se intenta
// `SELECT … FOR UPDATE NOWAIT` sobre la fila del curso desde el pool de fixtures: `55P03` significa que
// la transacción de la petición tenía la fila bloqueada mientras se leía el disco. Reproduce la §6 de
// docs/revision/REVISION_FASE3.md, que dio 55P03 en 4/4 antes de la corrección (bc3024b).
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, pdfMinimo, subirPdf } from '../ayudas/archivos.js';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { fabricaCursos } from '../ayudas/cursos-http.js';
import { crearMarca } from '../ayudas/datos.js';
import { dormir, inyectarMetodo } from '../ayudas/fallos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('seg_blq');
const pdfDir = carpetaPdfPropia();
const { almacenLocal } = await import('../../src/shared/archivos/almacen.js');

let f: Fixtures;
let srv: Servidor;
let doc: Cuenta;
let categoriaId = 0;
let c: ReturnType<typeof fabricaCursos>;

const RETRASO_MS = 600;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  doc = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  const admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  const r = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
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

/** Estado de la fila `curso` visto desde otra sesión: 'libre' o el SQLSTATE (55P03 = bloqueada). */
async function sondearBloqueo(idCurso: number): Promise<string> {
  try {
    await f.query('SELECT 1 FROM curso WHERE id_curso = $1 FOR UPDATE NOWAIT', [idCurso]);
    return 'libre';
  } catch (e) {
    return String((e as { code?: string }).code ?? e);
  }
}

/** Ejecuta la petición con `leer` retrasado y devuelve el estado de la fila durante cada lectura. */
async function estadosDuranteLecturas(idCurso: number, peticion: () => Promise<{ status: number; texto?: string }>) {
  const estados: string[] = [];
  const doble = inyectarMetodo(almacenLocal, 'leer', async (original, ...args) => {
    estados.push(await sondearBloqueo(idCurso));
    await dormir(RETRASO_MS);
    return original(...args);
  });
  try {
    const r = await peticion();
    doble.exigirLlamado();
    return { r, estados };
  } finally {
    doble.restaurar();
  }
}

describe('SEG-25b: sin lecturas de disco con la fila curso bloqueada (D-01)', () => {
  it('control: GET /docente/cursos/:id lee el disco con la fila libre', async () => {
    const { idCurso } = await c.cursoCompleto(doc);
    const { r, estados } = await estadosDuranteLecturas(idCurso, () =>
      c.como(doc, 'GET', `/api/docente/cursos/${idCurso}`));
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual([...new Set(estados)], ['libre']);
  });

  it('PUT /modulos/:id', async () => {
    const { idCurso, idModulo } = await c.cursoCompleto(doc);
    const { r, estados } = await estadosDuranteLecturas(idCurso, () =>
      c.como(doc, 'PUT', `/api/modulos/${idModulo}`, { titulo: 'Módulo editado', orden: 1 }));
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual([...new Set(estados)], ['libre']);
  });

  it('POST /modulos/:id/lecciones', async () => {
    const { idCurso, idModulo } = await c.cursoCompleto(doc);
    const { r, estados } = await estadosDuranteLecturas(idCurso, () =>
      c.como(doc, 'POST', `/api/modulos/${idModulo}/lecciones`, { titulo: 'Lección 2', orden: 2, tipo: 'DOCUMENTO' }));
    assert.equal(r.status, 201, r.texto);
    assert.deepEqual([...new Set(estados)], ['libre']);
  });

  it('PUT /lecciones/:id', async () => {
    const { idCurso, idLeccion } = await c.cursoCompleto(doc);
    const { r, estados } = await estadosDuranteLecturas(idCurso, () =>
      c.como(doc, 'PUT', `/api/lecciones/${idLeccion}`, { titulo: 'Lección editada', orden: 1, tipo: 'DOCUMENTO' }));
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual([...new Set(estados)], ['libre']);
  });

  it('DELETE /lecciones/:id (queda otra lección con PDF)', async () => {
    const { idCurso, idModulo } = await c.cursoCompleto(doc);
    const idLeccion2 = await c.crearLeccion(doc, idModulo, 2);
    const { r, estados } = await estadosDuranteLecturas(idCurso, () =>
      c.como(doc, 'DELETE', `/api/lecciones/${idLeccion2}`));
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual([...new Set(estados)], ['libre']);
  });

  it('DELETE /modulos/:id (queda otro módulo con PDF)', async () => {
    const { idCurso } = await c.cursoCompleto(doc);
    const idModulo2 = await c.crearModulo(doc, idCurso, 2);
    const { r, estados } = await estadosDuranteLecturas(idCurso, () =>
      c.como(doc, 'DELETE', `/api/modulos/${idModulo2}`));
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual([...new Set(estados)], ['libre']);
  });

  it('POST /lecciones/:id/archivo (el curso ya tiene otro PDF)', async () => {
    const { idCurso, idModulo } = await c.cursoCompleto(doc);
    const idLeccion2 = await c.crearLeccion(doc, idModulo, 2);
    const pdf = await pdfMinimo(3);
    const { r, estados } = await estadosDuranteLecturas(idCurso, () =>
      subirPdf(srv, idLeccion2, doc.token, pdf, 'segundo.pdf'));
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual([...new Set(estados)], ['libre']);
  });
});
