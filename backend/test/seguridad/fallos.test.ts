// Fallos de disco y de BD (SEG-23..27, 29, 30) con los seams de be-b: `almacenLocal` y `pool.connect`.
// Cada inyección se restaura en finally y exige que el doble se haya llamado (SEG-27, RG-06).
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, ficheros, pdfMinimo, subirPdf } from '../ayudas/archivos.js';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { fabricaCursos } from '../ayudas/cursos-http.js';
import { crearMarca } from '../ayudas/datos.js';
import { dormir, errorDisco, exigirLlamado, inyectarFalloBd, inyectarMetodo, type Inyeccion } from '../ayudas/fallos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

// Excepciones que nadie capturó durante la suite (p. ej. un ECONNRESET sin listener en un cliente de pg).
const noCapturadas: string[] = [];
process.on('uncaughtException', (e) => { noCapturadas.push(String(e?.message ?? e)); });
process.on('unhandledRejection', (e) => { noCapturadas.push(String((e as Error)?.message ?? e)); });

const marca = crearMarca('seg_fal');
const pdfDir = carpetaPdfPropia();
const { almacenLocal } = await import('../../src/shared/archivos/almacen.js');
const { pool } = await import('../../src/shared/database/pool.js');
const { cursosApi: cursosService } = await import('../../src/modules/cursos/index.js');

let f: Fixtures;
let srv: Servidor;
let docA: Cuenta;
let admin: Cuenta;
let fab: ReturnType<typeof fabricaCuentas>;
let categoriaId = 0;
let c: ReturnType<typeof fabricaCursos>;
let activas: Inyeccion[] = [];

const MENSAJE_500 = 'No se pudo guardar el PDF. Inténtalo nuevamente.';

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  fab = fabricaCuentas(f, srv, marca);
  docA = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  const r = await f.query<{ id: number }>('INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, admin.idPersona]);
  categoriaId = r.rows[0]!.id;
  c = fabricaCursos(srv, marca, () => categoriaId);
});

after(async () => {
  for (const i of activas) i.restaurar();
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

async function conInyeccion<T>(i: Inyeccion, trabajo: () => Promise<T>): Promise<T> {
  activas.push(i);
  try {
    return await trabajo();
  } finally {
    i.restaurar();
    activas = activas.filter((x) => x !== i);
  }
}

const filaArchivo = (id: number) => f.query<{ ruta: string; id_archivo: number }>(
  'SELECT a.ruta, a.id_archivo FROM archivo a WHERE a.id_curso = $1 ORDER BY a.id_archivo', [id]);

describe('SEG-27: el doble debe haberse llamado', () => {
  it('exigirLlamado falla cuando el contador es 0', () => {
    assert.throws(() => exigirLlamado('x', 0), /no se llamó/);
    assert.doesNotThrow(() => exigirLlamado('x', 1));
  });
});

describe('Disco (SEG-23..26)', () => {
  it('SEG-23: guardar lanza ENOSPC -> 500, sin fila nueva, PDF anterior intacto, sin huérfano', async () => {
    const { idCurso, idLeccion, idArchivo } = await c.cursoCompleto(docA);
    const antes = await filaArchivo(idCurso);
    assert.equal(antes.rows.length, 1);
    const fisicosAntes = ficheros(pdfDir.dir);
    const doble = inyectarMetodo(almacenLocal, 'guardar', async () => { throw errorDisco('ENOSPC'); });
    const r = await conInyeccion(doble, async () => subirPdf(srv, idLeccion, docA.token, await pdfMinimo(4), 'nuevo.pdf'));
    doble.exigirLlamado();
    assert.equal(r.status, 500);
    assert.equal(r.json.error.codigo, 'ERROR_INTERNO');
    assert.equal(r.json.error.mensaje, MENSAJE_500);
    const despues = await filaArchivo(idCurso);
    assert.deepEqual(despues.rows, antes.rows, 'sin fila nueva y el archivo anterior sigue asociado');
    assert.deepEqual(ficheros(pdfDir.dir).sort(), fisicosAntes.sort(), 'sin fichero huérfano');
    const lectura = await fetch(`${srv.base}/api/archivos/${idArchivo}`, { headers: { authorization: `Bearer ${docA.token}` } });
    assert.equal(lectura.status, 200, 'el PDF anterior se sigue descargando');
    const tmp = path.join(pdfDir.dir, '.tmp');
    assert.deepEqual(existsSync(tmp) ? readdirSync(tmp) : [], [], 'sin temporales');
  });

  it('SEG-23b: fallo al RECIBIR (reservarTemporal con ENOSPC) -> 500 ERROR_INTERNO', async () => {
    const { idLeccion } = await cursoCompleto();
    const doble = inyectarMetodo(almacenLocal, 'reservarTemporal', async () => { throw errorDisco('ENOSPC'); });
    const r = await conInyeccion(doble, async () => subirPdf(srv, idLeccion, docA.token, await pdfMinimo(), 'otro.pdf'));
    doble.exigirLlamado();
    assert.equal(r.status, 500);
    assert.equal(r.json.error.codigo, 'ERROR_INTERNO');
    assert.equal(r.json.error.mensaje, MENSAJE_500);
  });

  it('SEG-24: se borra el fichero del disco y luego GET /api/archivos/:id', async () => {
    const { idCurso, idArchivo } = await c.cursoCompleto(docA);
    const { rows } = await filaArchivo(idCurso);
    unlinkSync(path.join(pdfDir.dir, rows[0]!.ruta));
    const r = await c.como(docA, 'GET', `/api/archivos/${idArchivo}`);
    assert.equal(r.status, 404);
    assert.deepEqual(r.json.error, { codigo: 'NO_ENCONTRADO', mensaje: 'Archivo no disponible.' });
  });

  it('SEG-25: guardar lento no bloquea las lecturas del curso (la E/S va antes de bloquear filas)', async () => {
    const { idCurso, idLeccion } = await c.cursoCompleto(docA);
    const RETARDO = 1500;
    const doble = inyectarMetodo(almacenLocal, 'guardar', async (original, ...args) => { await dormir(RETARDO); return original(...args); });
    const { subida, lectura, ms } = await conInyeccion(doble, async () => {
      const pdf = await pdfMinimo(2);
      const subidaP = subirPdf(srv, idLeccion, docA.token, pdf, 'lento.pdf');
      await dormir(200);
      const t0 = Date.now();
      const lecturaR = await c.como(docA, 'GET', `/api/docente/cursos/${idCurso}`);
      const ms = Date.now() - t0;
      return { subida: await subidaP, lectura: lecturaR, ms };
    });
    doble.exigirLlamado();
    assert.equal(subida.status, 200, subida.texto);
    assert.equal(lectura.status, 200);
    assert.ok(ms < RETARDO / 2, `la lectura esperó ${ms} ms mientras guardar tardaba ${RETARDO} ms`);
  });

  it('SEG-26: borrar lección y módulo con PDF deja la BD y el disco sin restos', async () => {
    const a = await c.cursoCompleto(docA);
    const b = await c.cursoCompleto(docA);
    const rutas = (await f.query<{ ruta: string }>('SELECT ruta FROM archivo WHERE id_curso = ANY($1::int[])', [[a.idCurso, b.idCurso]])).rows.map((x) => x.ruta);
    assert.equal(rutas.length, 2);
    assert.ok(rutas.every((x) => ficheros(pdfDir.dir).includes(x)));
    const rl = await c.como(docA, 'DELETE', `/api/lecciones/${a.idLeccion}`);
    assert.equal(rl.status, 200);
    const rm = await c.como(docA, 'DELETE', `/api/modulos/${b.idModulo}`);
    assert.equal(rm.status, 200);
    for (let i = 0; i < 20 && rutas.some((x) => ficheros(pdfDir.dir).includes(x)); i++) await dormir(100);
    const filas = await f.query<{ n: string }>('SELECT count(*) AS n FROM archivo WHERE id_curso = ANY($1::int[])', [[a.idCurso, b.idCurso]]);
    assert.equal(filas.rows[0]!.n, '0');
    const pendientes = await f.query<{ n: string }>('SELECT count(*) AS n FROM archivo_borrado_pendiente');
    assert.equal(pendientes.rows[0]!.n, '0', 'el retiro se completa en el camino feliz');
    assert.deepEqual(rutas.filter((x) => ficheros(pdfDir.dir).includes(x)), [], 'tras la limpieza no queda fichero');
  });

  it('SEG-26b: si eliminar falla, la lección se borra igual y el retiro queda pendiente', async () => {
    const a = await c.cursoCompleto(docA);
    const ruta = (await filaArchivo(a.idCurso)).rows[0]!.ruta;
    const doble = inyectarMetodo(almacenLocal, 'eliminar', async () => { throw errorDisco('EIO'); });
    const r = await conInyeccion(doble, () => c.como(docA, 'DELETE', `/api/lecciones/${a.idLeccion}`));
    doble.exigirLlamado();
    assert.equal(r.status, 200, 'un fallo al retirar el fichero no impide borrar la lección');
    const filas = await f.query<{ n: string }>('SELECT count(*) AS n FROM archivo WHERE id_curso = $1', [a.idCurso]);
    assert.equal(filas.rows[0]!.n, '0');
    assert.ok(ficheros(pdfDir.dir).includes(ruta), 'el fichero sigue en disco');
    const pendiente = await f.query<{ n: string }>('SELECT count(*) AS n FROM archivo_borrado_pendiente WHERE nombre = $1', [ruta]);
    assert.equal(pendiente.rows[0]!.n, '1', 'el retiro queda registrado para reintentarlo');
  });
});

async function cursoCompleto() {
  return c.cursoCompleto(docA);
}

describe('BD (SEG-29, 30)', () => {
  async function estadoModulos(idCurso: number) {
    return (await f.query<{ n: string }>('SELECT count(*) AS n FROM modulo WHERE id_curso = $1', [idCurso])).rows[0]!.n;
  }

  it('SEG-29a: fallo tras la primera escritura al crear un módulo -> 500 y nada guardado', async () => {
    const id = await c.crearCurso(docA);
    const doble = inyectarFalloBd(pool, 'error');
    const r = await conInyeccion(doble, () => c.como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'M', orden: 1 }));
    doble.exigirLlamado();
    assert.equal(r.status, 500);
    assert.equal(r.json.error.codigo, 'ERROR_INTERNO');
    assert.equal(await estadoModulos(id), '0');
    const ok = await c.como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'M', orden: 1 });
    assert.equal(ok.status, 201, 'el pool sigue sirviendo');
  });

  it('SEG-29b: fallo al decidir una revisión -> 500 y el curso sigue EN_REVISION', async () => {
    const { idCurso } = await c.cursoCompleto(docA);
    await c.enviarARevision(docA, idCurso);
    const doble = inyectarFalloBd(pool, 'error');
    const r = await conInyeccion(doble, () => c.como(admin, 'PUT', `/api/admin/cursos/${idCurso}/revision`, { decision: 'APROBAR' }));
    doble.exigirLlamado();
    assert.equal(r.status, 500);
    const { rows } = await f.query('SELECT estado, revisado_por, publicado_en FROM curso WHERE id_curso = $1', [idCurso]);
    assert.deepEqual(rows[0], { estado: 'EN_REVISION', revisado_por: null, publicado_en: null });
  });

  it('SEG-29c: fallo al aprobar una solicitud -> 500, sigue PENDIENTE y sin rol DOCENTE', async () => {
    const est = await fab.crearCuenta(['ESTUDIANTE']);
    const { rows: [s] } = await f.query<{ id: number }>(
      "INSERT INTO solicitud_docente (id_persona, especialidad, motivo) VALUES ($1, 'Prueba', $2) RETURNING id_solicitud AS id", [est.idPersona, 'x'.repeat(60)]);
    const doble = inyectarFalloBd(pool, 'error');
    const r = await conInyeccion(doble, () => c.como(admin, 'PUT', `/api/admin/solicitudes/${s!.id}`, { decision: 'APROBAR' }));
    doble.exigirLlamado();
    assert.equal(r.status, 500);
    const estado = await f.query('SELECT estado FROM solicitud_docente WHERE id_solicitud = $1', [s!.id]);
    assert.equal(estado.rows[0]!.estado, 'PENDIENTE');
    const roles = await f.query("SELECT r.nombre FROM usuario_rol ur JOIN rol r USING (id_rol) WHERE ur.id_usuario = $1", [est.idUsuario]);
    assert.deepEqual(roles.rows.map((x) => x.nombre), ['ESTUDIANTE']);
    assert.equal((await f.query('SELECT count(*)::int AS n FROM docente WHERE id_persona = $1', [est.idPersona])).rows[0]!.n, 0);
  });

  it('SEG-29d: fallo al asociar el PDF tras crear la fila -> 500, sin fila nueva y PDF anterior intacto', async () => {
    const { idCurso, idLeccion } = await c.cursoCompleto(docA);
    const antes = await filaArchivo(idCurso);
    const fisicosAntes = ficheros(pdfDir.dir).sort();
    const doble = inyectarMetodo(cursosService, 'asociarPdfPrincipal', async () => { throw new Error('fallo de BD simulado'); });
    const r = await conInyeccion(doble, async () => subirPdf(srv, idLeccion, docA.token, await pdfMinimo(3), 'x.pdf'));
    doble.exigirLlamado();
    assert.equal(r.status, 500);
    assert.equal(r.json.error.mensaje, MENSAJE_500);
    assert.deepEqual((await filaArchivo(idCurso)).rows, antes.rows);
    await dormir(500);
    assert.deepEqual(ficheros(pdfDir.dir).sort(), fisicosAntes, 'el fichero nuevo no queda huérfano');
  });

  it('SEG-30: la conexión muere a mitad de la transacción -> 500, sin estado parcial y el pool sigue', async () => {
    const id = await c.crearCurso(docA);
    const doble = inyectarFalloBd(pool, 'terminar-conexion');
    const r = await conInyeccion(doble, () => c.como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'M', orden: 1 }));
    doble.exigirLlamado();
    assert.equal(r.status, 500);
    assert.equal(await estadoModulos(id), '0');
    for (let i = 0; i < 3; i++) {
      assert.equal((await c.como(docA, 'GET', `/api/docente/cursos/${id}`)).status, 200, `petición ${i + 1} tras la caída`);
    }
    await dormir(500);
    assert.deepEqual(noCapturadas, [], 'una conexión muerta no debe dejar excepciones sin capturar (listener de error en enTransaccion)');
  });
});
