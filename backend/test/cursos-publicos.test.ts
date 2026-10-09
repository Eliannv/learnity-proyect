import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

const baseAislada = process.env['DB_NAME']?.endsWith('_test');
const desarrolloAutorizado = process.env['LEARNITY_PRUEBA_LOCAL'] === 'true' && process.env['DB_NAME'] === 'Learnity';
if (process.env['NODE_ENV'] !== 'test' || (!baseAislada && !desarrolloAutorizado)) {
  throw new Error('Las pruebas públicas requieren una base _test o LEARNITY_PRUEBA_LOCAL=true para Learnity local.');
}

const { crearApp } = await import('../src/app.js');
const { pool } = await import('../src/shared/database/pool.js');

const marca = `catalogo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const ids = { personas: [] as number[], categorias: [] as number[], cursos: [] as number[] };
let base = '';
let servidor: ReturnType<ReturnType<typeof crearApp>['listen']> | undefined;
let publicadoA = 0;
let publicadoB = 0;
let publicadoC = 0;
let borrador = 0;
let categoriaA = '';
let categoriaB = '';

async function persona(nombre: string) {
  const { rows } = await pool.query<{ id_persona: number }>(
    'INSERT INTO persona (nombres, apellidos) VALUES ($1, $2) RETURNING id_persona', [marca, nombre],
  );
  const id = rows[0]!.id_persona;
  ids.personas.push(id);
  return id;
}

async function categoria(nombre: string, activa: boolean, creadaPor: number) {
  const { rows } = await pool.query<{ id_categoria: number }>(
    'INSERT INTO categoria (nombre, activa, creada_por) VALUES ($1, $2, $3) RETURNING id_categoria',
    [nombre, activa, creadaPor],
  );
  const id = rows[0]!.id_categoria;
  ids.categorias.push(id);
  return id;
}

async function curso(docente: number, cat: number, sufijo: string, nivel: string, estado: string, dias: number) {
  const { rows } = await pool.query<{ id_curso: number }>(
    `INSERT INTO curso (id_docente, id_categoria, titulo, subtitulo, descripcion, nivel, estado, publicado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() - $8::int * interval '1 day') RETURNING id_curso`,
    [docente, cat, `${marca} ${sufijo}`, `Subtítulo ${sufijo}`, `Descripción ${sufijo}`, nivel, estado, dias],
  );
  const id = rows[0]!.id_curso;
  ids.cursos.push(id);
  return id;
}

async function pedir(ruta: string) {
  const res = await fetch(base + ruta);
  return { status: res.status, json: await res.json() as any };
}

before(async () => {
  const autor = await persona('Docente');
  const estudiante = await persona('Estudiante');
  const { rows: docentes } = await pool.query<{ id_docente: number }>(
    'INSERT INTO docente (id_persona, especialidad) VALUES ($1, $2) RETURNING id_docente',
    [autor, 'Pruebas públicas'],
  );
  const docente = docentes[0]!.id_docente;
  categoriaA = `${marca} Programación`;
  categoriaB = `${marca} Diseño`;
  const catA = await categoria(categoriaA, true, autor);
  const catB = await categoria(categoriaB, true, autor);
  await categoria(`${marca} Inactiva`, false, autor);
  publicadoA = await curso(docente, catA, 'A Python', 'PRINCIPIANTE', 'PUBLICADO', 3);
  publicadoB = await curso(docente, catB, 'B Diseño', 'INTERMEDIO', 'PUBLICADO', 2);
  publicadoC = await curso(docente, catA, 'C Python', 'AVANZADO', 'PUBLICADO', 1);
  borrador = await curso(docente, catA, 'D Borrador', 'PRINCIPIANTE', 'BORRADOR', 0);
  const { rows: modulos } = await pool.query<{ id_modulo: number }>(
    'INSERT INTO modulo (id_curso, titulo, orden) VALUES ($1, $2, 1) RETURNING id_modulo',
    [publicadoA, 'Introducción'],
  );
  const { rows: archivos } = await pool.query<{ id_archivo: number }>(
    `INSERT INTO archivo (id_curso, tipo, nombre_original, ruta, tamano_bytes, alto_px, duracion_seg)
     VALUES ($1, 'VIDEO', 'video.mp4', $2, 1024, 480, 240) RETURNING id_archivo`,
    [publicadoA, `${marca}/privado.mp4`],
  );
  await pool.query(
    `INSERT INTO leccion (id_modulo, id_archivo, titulo, tipo, orden)
     VALUES ($1, $2, 'Primera lección', 'VIDEO', 1)`,
    [modulos[0]!.id_modulo, archivos[0]!.id_archivo],
  );
  await pool.query('INSERT INTO inscripcion (id_persona, id_curso) VALUES ($1, $2), ($3, $4)',
    [autor, publicadoB, estudiante, publicadoB]);
  const app = crearApp();
  servidor = app.listen(0);
  await new Promise<void>((resolve) => servidor!.once('listening', resolve));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

after(async () => {
  if (servidor) await new Promise<void>((resolve) => servidor!.close(() => resolve()));
  if (ids.cursos.length) {
    await pool.query('DELETE FROM inscripcion WHERE id_curso = ANY($1::int[])', [ids.cursos]);
    await pool.query('DELETE FROM curso WHERE id_curso = ANY($1::int[])', [ids.cursos]);
  }
  if (ids.categorias.length) await pool.query('DELETE FROM categoria WHERE id_categoria = ANY($1::int[])', [ids.categorias]);
  if (ids.personas.length) {
    await pool.query('DELETE FROM docente WHERE id_persona = ANY($1::int[])', [ids.personas]);
    await pool.query('DELETE FROM persona WHERE id_persona = ANY($1::int[])', [ids.personas]);
  }
  await pool.end();
});

describe('API pública de cursos con PostgreSQL', () => {
  it('lista solo categorías activas', async () => {
    const r = await pedir('/api/categorias');
    assert.equal(r.status, 200);
    assert.ok(r.json.some((c: { nombre: string }) => c.nombre === categoriaA));
    assert.ok(r.json.some((c: { nombre: string }) => c.nombre === categoriaB));
    assert.ok(!r.json.some((c: { nombre: string }) => c.nombre === `${marca} Inactiva`));
  });

  it('filtra publicados antes de contar y pagina de forma estable', async () => {
    const ruta = `/api/cursos?q=${marca}&orden=az&pagina=1&limite=1`;
    const primera = await pedir(ruta);
    assert.equal(primera.status, 200);
    assert.deepEqual([primera.json.total, primera.json.totalPaginas, primera.json.items.length], [3, 3, 1]);
    assert.equal(primera.json.items[0].id, publicadoA);
    assert.equal(primera.json.items[0].estado, 'PUBLICADO');
    const segunda = await pedir(`/api/cursos?q=${marca}&orden=az&pagina=2&limite=1`);
    assert.equal(segunda.json.items[0].id, publicadoB);
    const fuera = await pedir(`/api/cursos?q=${marca}&pagina=8&limite=1`);
    assert.deepEqual([fuera.json.total, fuera.json.totalPaginas, fuera.json.items], [3, 3, []]);
    const vacia = await pedir('/api/cursos?q=ningun-curso-con-este-nombre-irrepetible');
    assert.deepEqual([vacia.json.total, vacia.json.totalPaginas, vacia.json.items], [0, 0, []]);
  });

  it('combina OR dentro de categoría/nivel y AND entre filtros', async () => {
    const params = new URLSearchParams({ q: marca, orden: 'recientes' });
    params.append('categoria', categoriaA);
    params.append('categoria', categoriaB);
    params.append('nivel', 'PRINCIPIANTE');
    params.append('nivel', 'INTERMEDIO');
    const r = await pedir(`/api/cursos?${params}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.items.map((c: { id: number }) => c.id), [publicadoB, publicadoA]);
    assert.equal(r.json.total, 2);
    const descripcion = await pedir(`/api/cursos?q=${encodeURIComponent('Descripción A Python')}`);
    assert.equal(descripcion.json.total, 1);
    assert.equal(descripcion.json.items[0].id, publicadoA);
  });

  it('ordena populares por inscripciones', async () => {
    const r = await pedir(`/api/cursos?q=${marca}&orden=populares`);
    assert.equal(r.status, 200);
    assert.equal(r.json.items[0].id, publicadoB);
    assert.equal(r.json.items.length, 3);
    const recientes = await pedir(`/api/cursos?q=${marca}&orden=recientes`);
    assert.equal(recientes.json.items[0].id, publicadoC);
  });

  it('detalla solo publicados y no expone archivos privados', async () => {
    const r = await pedir(`/api/cursos/${publicadoA}`);
    assert.equal(r.status, 200);
    assert.equal(r.json.modulos, 1);
    assert.equal(r.json.lecciones, 1);
    assert.equal(r.json.minutos, 4);
    assert.equal(r.json.temario[0].lecciones[0].titulo, 'Primera lección');
    assert.ok(!JSON.stringify(r.json).includes('privado.mp4'));
    assert.ok(!JSON.stringify(r.json).includes('id_archivo'));
    const oculto = await pedir(`/api/cursos/${borrador}`);
    const inexistente = await pedir('/api/cursos/2147483647');
    assert.equal(oculto.status, 404);
    assert.deepEqual(oculto.json, inexistente.json);
  });

  it('rechaza parámetros inválidos', async () => {
    for (const ruta of ['/api/cursos?pagina=0', '/api/cursos?limite=51', '/api/cursos?orden=otro',
      '/api/cursos?nivel=EXPERTO', '/api/cursos?desconocido=1', '/api/cursos/no-es-id']) {
      const r = await pedir(ruta);
      assert.equal(r.status, 400, ruta);
      assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    }
  });
});
