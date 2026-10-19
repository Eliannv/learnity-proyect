// Caracterización del catálogo público (CAR-CAT-01..22) y JSON de referencia para D8 (migración a vistas SQL).
// La referencia (referencias/catalogo.json) se compara con deepStrictEqual y con el JSON textual (el orden
// de las claves importa). Se regenera SOLO a propósito: CAPTURAR_REFERENCIA=1 (comportamiento actual).
// Vale hasta la migración 023 (RG-58): el curso PUBLICADO sin publicado_en deja de poder existir.
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { capturar } from '../ayudas/captura.js';
import { claves, normalizarConCamino, sinRutasPrivadas } from '../ayudas/contrato.js';
import { crearMarca } from '../ayudas/datos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca } from '../ayudas/sesiones.js';

const marca = crearMarca('car_cat');
const RUTA_REFERENCIA = fileURLToPath(new URL('./referencias/catalogo.json', import.meta.url));
const CAPTURAR = process.env['CAPTURAR_REFERENCIA'] === '1';

let f: Fixtures;
let srv: Servidor;
const cursos: Record<string, number> = {};
const categorias: Record<string, number> = {};
const modulos: Record<string, number> = {};
const lecciones: Record<string, number> = {};

const ITEM = [
  'id', 'titulo', 'subtitulo', 'categoria', 'docente', 'nivel', 'portadaUrl',
  'modulos', 'lecciones', 'minutos', 'publicadoEn', 'estado',
];

function inverso(mapa: Record<string, number>, prefijo: string) {
  return new Map(Object.entries(mapa).map(([k, v]) => [v, `<id:${prefijo}#${k}>`]));
}

function normalizar(json: unknown) {
  const mapas = {
    curso: inverso(cursos, 'curso'), categoria: inverso(categorias, 'categoria'),
    modulo: inverso(modulos, 'modulo'), leccion: inverso(lecciones, 'leccion'),
  };
  return normalizarConCamino(json, (camino, valor) => {
    if (camino === '[].id' || /categoria\.id$/.test(camino)) return mapas.categoria.get(valor);
    if (camino === 'items[].id' || camino === 'id') return mapas.curso.get(valor);
    if (camino === 'temario[].id') return mapas.modulo.get(valor);
    if (camino === 'temario[].lecciones[].id') return mapas.leccion.get(valor);
    return undefined;
  }, marca);
}

const q = encodeURIComponent(marca);
const lista = (qs = '') => srv.pedir(`/api/cursos?q=${q}${qs}`);

async function persona(nombre: string): Promise<number> {
  const { rows } = await f.query<{ id: number }>('INSERT INTO persona (nombres, apellidos) VALUES ($1, $2) RETURNING id_persona AS id', [marca, nombre]);
  return rows[0]!.id;
}

async function categoria(clave: string, nombre: string, activa: boolean, por: number) {
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, activa, creada_por) VALUES ($1, $2, $3) RETURNING id_categoria AS id', [`${marca} ${nombre}`, activa, por]);
  categorias[clave] = rows[0]!.id;
}

async function curso(clave: string, docente: number, cat: string, titulo: string, nivel: string, estado: string, dias: number | null) {
  const { rows } = await f.query<{ id: number }>(
    `INSERT INTO curso (id_docente, id_categoria, titulo, subtitulo, descripcion, nivel, estado, portada_url, objetivos, requisitos, publicado_en, revisado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '/img/p.jpg', '{a,b,c}', '{r1}', CASE WHEN $8::int IS NULL THEN NULL ELSE now() - $8::int * interval '1 day' END,
             CASE WHEN $7 = 'PUBLICADO' THEN $9::int END)
     RETURNING id_curso AS id`,
    [docente, categorias[cat], `${marca} ${titulo}`, `Sub ${titulo}`, `Desc ${titulo}`, nivel, estado, dias, revisor]);
  cursos[clave] = rows[0]!.id;
}

let revisor = 0;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  const d1 = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE'], { sinSesion: true });
  const d2 = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE'], { sinSesion: true });
  await f.query("UPDATE docente SET estado = 'INACTIVO' WHERE id_docente = $1", [d2.idDocente]);
  revisor = d1.idPersona;
  await categoria('A', 'Álgebra', true, d1.idPersona);
  await categoria('B', 'biología', true, d1.idPersona);
  await categoria('C', 'Cálculo inactiva', false, d1.idPersona);
  await curso('c1', d1.idDocente!, 'A', 'Alfa 100%', 'PRINCIPIANTE', 'PUBLICADO', 3);
  await curso('c2', d1.idDocente!, 'A', 'Beta', 'INTERMEDIO', 'PUBLICADO', 2);
  await curso('c3', d1.idDocente!, 'B', 'Gamma', 'AVANZADO', 'PUBLICADO', 1);
  await curso('c4', d1.idDocente!, 'B', 'Delta heredado', 'PRINCIPIANTE', 'PUBLICADO', null);
  await curso('c5', d1.idDocente!, 'A', 'Epsilon borrador', 'PRINCIPIANTE', 'BORRADOR', null);
  await curso('c6', d1.idDocente!, 'A', 'Zeta revision', 'PRINCIPIANTE', 'EN_REVISION', null);
  await curso('c7', d1.idDocente!, 'C', 'Eta categoria inactiva', 'PRINCIPIANTE', 'PUBLICADO', 5);
  await curso('c8', d2.idDocente!, 'A', 'Theta docente inactivo', 'PRINCIPIANTE', 'PUBLICADO', 6);
  // Temario de c1: un módulo vacío y un módulo con una lección DOCUMENTO con PDF de 150 s (2,5 min -> 3).
  for (const [clave, orden, titulo] of [['m1', 1, 'Módulo con lección'], ['m2', 2, 'Módulo vacío']] as const) {
    const { rows } = await f.query<{ id: number }>('INSERT INTO modulo (id_curso, titulo, orden) VALUES ($1, $2, $3) RETURNING id_modulo AS id', [cursos['c1'], titulo, orden]);
    modulos[clave] = rows[0]!.id;
  }
  const arch = await f.query<{ id: number }>(
    `INSERT INTO archivo (id_curso, tipo, nombre_original, ruta, tamano_bytes, duracion_seg)
     VALUES ($1, 'PDF', 'x.pdf', $2, 1000, 150) RETURNING id_archivo AS id`, [cursos['c1'], `${randomUUID()}.pdf`]);
  const lec = await f.query<{ id: number }>(
    `INSERT INTO leccion (id_modulo, id_archivo, titulo, tipo, orden) VALUES ($1, $2, 'Lección PDF', 'DOCUMENTO', 1) RETURNING id_leccion AS id`,
    [modulos['m1'], arch.rows[0]!.id]);
  lecciones['l1'] = lec.rows[0]!.id;
  // Inscripciones para la popularidad: c2 tiene 2, c3 tiene 1.
  for (const [i, clave] of [[1, 'c2'], [2, 'c2'], [3, 'c3']] as const) {
    const est = await persona(`Estudiante ${i}`);
    await f.query('INSERT INTO inscripcion (id_persona, id_curso) VALUES ($1, $2)', [est, cursos[clave]]);
  }
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await f.query('DELETE FROM inscripcion WHERE id_curso = ANY($1::int[])', [Object.values(cursos)]);
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
});

const publicados = () => ['c1', 'c2', 'c3', 'c4', 'c7', 'c8'].map((c) => cursos[c]!);
const idsDe = (r: { json: any }) => (r.json.items as any[]).map((x) => x.id);

describe('GET /api/categorias (CAR-CAT-01..03)', () => {
  it('lista solo activas, con { id, nombre }, ordenadas por nombre e id', async () => {
    const r = await srv.pedir('/api/categorias');
    assert.equal(r.status, 200);
    const propias = (r.json as any[]).filter((x) => x.nombre.startsWith(marca));
    assert.deepEqual(propias.map((x) => x.id), [categorias['A'], categorias['B']]);
    for (const x of propias) assert.deepEqual(claves(x), ['id', 'nombre']);
    const todos = (r.json as any[]).map((x) => x.nombre);
    capturar('CAR-CAT-03 collation (A=álgebra, B=biología)', propias.map((x) => x.nombre.slice(marca.length + 1)));
    assert.equal(todos.length >= 2, true);
  });
});

describe('GET /api/cursos (CAR-CAT-04..17)', () => {
  it('CAR-CAT-04 y 05: forma de la página y valores por defecto', async () => {
    const r = await lista();
    assert.equal(r.status, 200);
    assert.deepEqual(claves(r.json), ['items', 'pagina', 'limite', 'total', 'totalPaginas']);
    assert.equal(r.json.pagina, 1);
    assert.equal(r.json.limite, 9);
    assert.deepEqual(claves(r.json.items[0]), ITEM);
    assert.deepEqual(claves(r.json.items[0].categoria), ['id', 'nombre']);
    assert.ok(r.json.items.every((x: any) => x.estado === 'PUBLICADO'));
    assert.deepEqual(sinRutasPrivadas(r.json), []);
  });

  it('CAR-CAT-14, 15, 16: solo PUBLICADO; heredado con creado_en y al final; sin filtro por categoría o docente inactivos', async () => {
    const r = await lista();
    assert.equal(r.json.total, 6);
    assert.deepEqual([...idsDe(r)].sort((a, b) => a - b), [...publicados()].sort((a, b) => a - b));
    const ids = idsDe(r);
    assert.equal(ids[ids.length - 1], cursos['c4'], 'el heredado va al final en recientes (NULLS LAST)');
    const heredado = r.json.items.find((x: any) => x.id === cursos['c4']);
    assert.match(heredado.publicadoEn, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(ids.includes(cursos['c7']!) && ids.includes(cursos['c8']!), 'categoría o docente inactivos siguen apareciendo hoy');
  });

  it('CAR-CAT-06: órdenes recientes, populares y az', async () => {
    assert.deepEqual(idsDe(await lista('&orden=recientes')), [cursos['c3'], cursos['c2'], cursos['c1'], cursos['c7'], cursos['c8'], cursos['c4']]);
    const pop = idsDe(await lista('&orden=populares'));
    assert.deepEqual(pop.slice(0, 2), [cursos['c2'], cursos['c3']]);
    const az = idsDe(await lista('&orden=az'));
    assert.deepEqual(az, [cursos['c1'], cursos['c4'], cursos['c2'], cursos['c3'], cursos['c7'], cursos['c8']]);
  });

  it('CAR-CAT-07: filtros repetidos', async () => {
    const niv = await lista('&nivel=INTERMEDIO&nivel=AVANZADO');
    assert.deepEqual(idsDe(niv).sort(), [cursos['c2']!, cursos['c3']!].sort());
    const cat = await lista(`&categoria=${encodeURIComponent(marca + ' Álgebra')}&categoria=${encodeURIComponent(marca + ' biología')}`);
    assert.equal(cat.json.total, 4);
    const ambos = await lista(`&categoria=${encodeURIComponent(marca + ' biología')}&nivel=AVANZADO`);
    assert.deepEqual(idsDe(ambos), [cursos['c3']]);
  });

  it('CAR-CAT-08, 09, 10: validación de parámetros', async () => {
    for (const qs of ['&q=a', '&limite=0', '&limite=51', '&pagina=0', '&pagina=10001', '&limite=abc', '&extra=1', '&nivel=EXPERTO', '&orden=otro']) {
      const r = await srv.pedir(`/api/cursos?q=${q}${qs}`);
      assert.equal(r.status, 400, qs);
      assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA', qs);
    }
    assert.equal((await srv.pedir(`/api/cursos?q=${q}&limite=50`)).status, 200);
    assert.equal((await srv.pedir(`/api/cursos?q=${q}&pagina=10000`)).status, 200);
    const muchas = Array.from({ length: 21 }, (_, i) => `&categoria=c${i}`).join('');
    assert.equal((await srv.pedir(`/api/cursos?q=${q}${muchas}`)).status, 400);
    assert.equal((await srv.pedir(`/api/cursos?q=${'x'.repeat(101)}`)).status, 400);
    assert.equal((await srv.pedir(`/api/cursos?q=${'x'.repeat(100)}`)).status, 200);
  });

  it('CAR-CAT-11 y 12: página fuera de rango y sin resultados', async () => {
    const fuera = await lista('&pagina=99');
    assert.equal(fuera.status, 200);
    assert.deepEqual(fuera.json.items, []);
    assert.equal(fuera.json.total, 6);
    assert.equal(fuera.json.totalPaginas, 1);
    const vacio = await srv.pedir(`/api/cursos?q=${encodeURIComponent(marca + ' inexistente')}`);
    assert.equal(vacio.status, 200);
    assert.deepEqual(vacio.json, { items: [], pagina: 1, limite: 9, total: 0, totalPaginas: 0 });
  });

  it('CAR-CAT-13: % y _ se buscan como literales', async () => {
    const pct = await srv.pedir(`/api/cursos?q=${encodeURIComponent('100%')}`);
    assert.deepEqual(idsDe(pct).filter((i: number) => publicados().includes(i)), [cursos['c1']]);
    const todo = await srv.pedir(`/api/cursos?q=${encodeURIComponent(marca + ' %')}`);
    assert.equal(todo.json.total, 0);
    const guion = await srv.pedir(`/api/cursos?q=${encodeURIComponent(marca + '_')}`);
    assert.equal(guion.json.total, 0);
  });

  it('CAR-CAT-17: minutos = round(segundos / 60); módulos y lecciones', async () => {
    const r = await lista();
    const c1 = r.json.items.find((x: any) => x.id === cursos['c1']);
    assert.equal(c1.minutos, 3);
    assert.equal(c1.modulos, 2);
    assert.equal(c1.lecciones, 1);
    const c2 = r.json.items.find((x: any) => x.id === cursos['c2']);
    assert.deepEqual([c2.modulos, c2.lecciones, c2.minutos], [0, 0, 0]);
  });
});

describe('GET /api/cursos/:id (CAR-CAT-18..22)', () => {
  it('CAR-CAT-18 y 21: detalle con temario ordenado, módulo vacío y sin ruta', async () => {
    const r = await srv.pedir(`/api/cursos/${cursos['c1']}`);
    assert.equal(r.status, 200);
    capturar('CAR-CAT-18 claves', claves(r.json));
    assert.deepEqual(claves(r.json.temario[0]), ['id', 'orden', 'titulo', 'lecciones']);
    assert.deepEqual(claves(r.json.temario[0].lecciones[0]), ['id', 'orden', 'titulo', 'tipo', 'minutos']);
    assert.deepEqual(r.json.temario.map((m: any) => m.orden), [1, 2]);
    assert.deepEqual(r.json.temario[1].lecciones, []);
    assert.deepEqual(sinRutasPrivadas(r.json), []);
  });

  it('CAR-CAT-19: BORRADOR, EN_REVISION, RECHAZADO y ARCHIVADO -> 404 "Curso no disponible."', async () => {
    for (const [estado, clave] of [['BORRADOR', 'c5'], ['EN_REVISION', 'c6']] as const) {
      const r = await srv.pedir(`/api/cursos/${cursos[clave]}`);
      assert.equal(r.status, 404, estado);
      assert.deepEqual(r.json, { error: { codigo: 'NO_ENCONTRADO', mensaje: 'Curso no disponible.' } });
    }
    for (const estado of ['RECHAZADO', 'ARCHIVADO']) {
      await f.query("UPDATE curso SET estado = $2, motivo_rechazo = CASE WHEN $2 = 'RECHAZADO' THEN 'm' END WHERE id_curso = $1", [cursos['c5'], estado]);
      assert.equal((await srv.pedir(`/api/cursos/${cursos['c5']}`)).status, 404, estado);
    }
    await f.query("UPDATE curso SET estado = 'BORRADOR', motivo_rechazo = NULL WHERE id_curso = $1", [cursos['c5']]);
  });

  it('CAR-CAT-22: PUBLICADO en categoría inactiva o de docente inactivo -> 200 hoy', async () => {
    assert.equal((await srv.pedir(`/api/cursos/${cursos['c7']}`)).status, 200);
    assert.equal((await srv.pedir(`/api/cursos/${cursos['c8']}`)).status, 200);
  });

  it('paquete ID', async () => {
    for (const v of ['abc', '0', '-1', '1.5', '2147483648']) assert.equal((await srv.pedir(`/api/cursos/${v}`)).status, 400, v);
    assert.equal((await srv.pedir('/api/cursos/2147483647')).status, 404);
    // ID-4 CONGELADO-INSEGURO (ADR-011, punto 11.11)
    for (const v of ['2.147483647e9', '0x7FFFFFFF']) assert.equal((await srv.pedir(`/api/cursos/${v}`)).status, 404, v);
  });
});

describe('JSON de referencia para D8 (migración a vistas)', () => {
  it('las respuestas normalizadas coinciden con referencias/catalogo.json', async () => {
    const peticiones: Array<[string, string]> = [
      ['categorias', '/api/categorias'],
      ['lista por defecto', `/api/cursos?q=${q}`],
      ['recientes limite 2 pagina 2', `/api/cursos?q=${q}&limite=2&pagina=2`],
      ['populares', `/api/cursos?q=${q}&orden=populares&limite=3`],
      ['az', `/api/cursos?q=${q}&orden=az`],
      ['niveles', `/api/cursos?q=${q}&nivel=INTERMEDIO&nivel=AVANZADO`],
      ['pagina fuera de rango', `/api/cursos?q=${q}&pagina=99`],
      ['sin resultados', `/api/cursos?q=${encodeURIComponent(marca + ' zzz')}`],
      ['detalle c1 con temario', `/api/cursos/${cursos['c1']}`],
      ['detalle c2 sin módulos', `/api/cursos/${cursos['c2']}`],
      ['detalle c4 heredado', `/api/cursos/${cursos['c4']}`],
      ['detalle c7 categoría inactiva', `/api/cursos/${cursos['c7']}`],
      ['detalle c8 docente inactivo', `/api/cursos/${cursos['c8']}`],
      ['detalle c5 borrador', `/api/cursos/${cursos['c5']}`],
    ];
    const actual: Record<string, unknown> = {};
    for (const [nombre, ruta] of peticiones) {
      const r = await srv.pedir(ruta);
      let cuerpo = r.json;
      if (nombre === 'categorias') cuerpo = (r.json as any[]).filter((x) => x.nombre.startsWith(marca));
      actual[nombre] = { status: r.status, cuerpo: normalizar(cuerpo) };
    }
    if (CAPTURAR) {
      writeFileSync(RUTA_REFERENCIA, JSON.stringify(actual, null, 2) + '\n');
      console.log('CAPTURA referencia escrita en', RUTA_REFERENCIA);
      return;
    }
    const referencia = JSON.parse(readFileSync(RUTA_REFERENCIA, 'utf8'));
    for (const nombre of Object.keys(referencia)) {
      assert.deepEqual(actual[nombre], referencia[nombre], nombre);
      assert.equal(JSON.stringify(actual[nombre]), JSON.stringify(referencia[nombre]), `${nombre}: el orden de las claves cambió`);
    }
    assert.deepEqual(Object.keys(actual), Object.keys(referencia));
  });
});
