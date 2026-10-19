// Caracterización de la gestión de cursos del docente (CAR-CUR-01..36, paquetes AUT/ID/IDOR/PREC).
// Fija el comportamiento ACTUAL. Lo marcado CONGELADO-INSEGURO está aprobado para cambiar en el
// ADR-011; se actualiza en el mismo commit que lo cambie. No se ajustan expectativas para "pasar".
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, pdfMinimo, subirPdf } from '../ayudas/archivos.js';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { capturar } from '../ayudas/captura.js';
import { forma, sinRutasPrivadas } from '../ayudas/contrato.js';
import { crearMarca } from '../ayudas/datos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('car_cur');
const pdfDir = carpetaPdfPropia();

let f: Fixtures;
let srv: Servidor;
let docA: Cuenta;
let docB: Cuenta;
let est: Cuenta;
let admin: Cuenta;
let docInactivo: Cuenta;
let categoriaId = 0;
let categoriaInactivaId = 0;
let n = 0;

const NO_AUTENTICADO = { codigo: 'NO_AUTENTICADO', mensaje: 'Debes iniciar sesión.' };

function datosCurso(sufijo: string, extra: Record<string, unknown> = {}) {
  return {
    titulo: `${marca} ${sufijo}`,
    subtitulo: 'Subtítulo de prueba',
    descripcion: 'Descripción de prueba',
    categoriaId,
    nivel: 'PRINCIPIANTE',
    portadaUrl: '/img/portada-prueba.jpg',
    objetivos: ['Primer objetivo', 'Segundo objetivo', 'Tercer objetivo'],
    requisitos: [],
    ...extra,
  };
}

const como = (c: Cuenta, metodo: string, ruta: string, cuerpo?: unknown) =>
  srv.pedir(ruta, { token: c.token, metodo, cuerpo });

async function crearCurso(c: Cuenta = docA, extra: Record<string, unknown> = {}): Promise<number> {
  const r = await como(c, 'POST', '/api/cursos', datosCurso(`curso ${++n}`, extra));
  assert.equal(r.status, 201, r.texto);
  return r.json.id as number;
}

async function crearModulo(idCurso: number, orden = 1, c: Cuenta = docA): Promise<number> {
  const r = await como(c, 'POST', `/api/cursos/${idCurso}/modulos`, { titulo: `Módulo ${orden}`, orden });
  assert.equal(r.status, 201, r.texto);
  const m = (r.json.modulos as any[]).find((x) => x.orden === orden);
  return m.id as number;
}

async function crearLeccion(idModulo: number, orden = 1, c: Cuenta = docA): Promise<number> {
  const r = await como(c, 'POST', `/api/modulos/${idModulo}/lecciones`, { titulo: `Lección ${orden}`, orden, tipo: 'DOCUMENTO' });
  assert.equal(r.status, 201, r.texto);
  const m = (r.json.modulos as any[]).find((x) => x.id === idModulo);
  return m.lecciones.find((l: any) => l.orden === orden).id as number;
}

async function cursoCompleto(c: Cuenta = docA) {
  const idCurso = await crearCurso(c);
  const idModulo = await crearModulo(idCurso, 1, c);
  const idLeccion = await crearLeccion(idModulo, 1, c);
  const sub = await subirPdf(srv, idLeccion, c.token, await pdfMinimo(2));
  assert.equal(sub.status, 200, sub.texto);
  return { idCurso, idModulo, idLeccion };
}

const forzarEstado = (idCurso: number, estado: string) =>
  f.query(
    `UPDATE curso SET estado = $2,
       motivo_rechazo = CASE WHEN $2 = 'RECHAZADO' THEN 'Motivo de prueba' ELSE NULL END,
       revisado_por = CASE WHEN $2 IN ('PUBLICADO', 'RECHAZADO') THEN $3::int ELSE NULL END,
       publicado_en = CASE WHEN $2 = 'PUBLICADO' THEN now() ELSE NULL END
     WHERE id_curso = $1`,
    [idCurso, estado, admin.idPersona]);

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  docA = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  docB = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  est = await fab.crearCuenta(['ESTUDIANTE']);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  docInactivo = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  await f.query("UPDATE docente SET estado = 'INACTIVO' WHERE id_docente = $1", [docInactivo.idDocente]);
  const c = await f.query<{ id: number }>('INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, docA.idPersona]);
  categoriaId = c.rows[0]!.id;
  const ci = await f.query<{ id: number }>('INSERT INTO categoria (nombre, activa, creada_por) VALUES ($1, FALSE, $2) RETURNING id_categoria AS id', [`${marca} inactiva`, docA.idPersona]);
  categoriaInactivaId = ci.rows[0]!.id;
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

const RUTAS: Array<[string, string]> = [
  ['GET', '/api/docente/cursos'], ['GET', '/api/docente/cursos/1'], ['POST', '/api/cursos'], ['PUT', '/api/cursos/1'],
  ['POST', '/api/cursos/1/modulos'], ['PUT', '/api/modulos/1'], ['DELETE', '/api/modulos/1'],
  ['POST', '/api/modulos/1/lecciones'], ['PUT', '/api/lecciones/1'], ['DELETE', '/api/lecciones/1'],
  ['POST', '/api/cursos/1/enviar-revision'],
];

describe('AUT: las 11 operaciones de gestión de cursos', () => {
  for (const [metodo, ruta] of RUTAS) {
    it(`${metodo} ${ruta}`, async () => {
      const sin = await srv.pedir(ruta, { metodo, cuerpo: {} });
      assert.equal(sin.status, 401);
      assert.deepEqual(sin.json, { error: NO_AUTENTICADO });
      // AUT-2: firma alterada
      const t = docA.token;
      const i = t.length - 4;
      const alterado = t.slice(0, i) + (t[i] === 'A' ? 'B' : 'A') + t.slice(i + 1);
      const r2 = await srv.pedir(ruta, { metodo, cuerpo: {}, token: alterado });
      assert.equal(r2.status, 401);
      assert.equal(r2.json.error.codigo, 'TOKEN_INVALIDO');
      // AUT-3: esquema distinto y Bearer sin token
      const r3 = await srv.pedir(ruta, { metodo, cuerpo: {}, headers: { authorization: 'Basic abc' } });
      assert.equal(r3.status, 401);
      assert.equal(r3.json.error.codigo, 'NO_AUTENTICADO');
      const r3b = await srv.pedir(ruta, { metodo, cuerpo: {}, headers: { authorization: 'Bearer' } });
      assert.equal(r3b.status, 401);
      assert.equal(r3b.json.error.codigo, 'NO_AUTENTICADO');
      // AUT-5 / IDOR-3: ESTUDIANTE y ADMIN sin DOCENTE
      for (const c of [est, admin]) {
        const r = await como(c, metodo, ruta, {});
        assert.equal(r.status, 403, `${c.roles}`);
        assert.equal(r.json.error.codigo, 'SIN_PERMISO');
      }
    });
  }

  it('PREC-1 y PREC-2: autorizar y autenticar van antes de validar el id', async () => {
    const e = await como(est, 'GET', '/api/docente/cursos/abc');
    assert.equal(e.status, 403);
    const s = await srv.pedir('/api/docente/cursos/abc');
    assert.equal(s.status, 401);
  });
});

describe('ID: identificadores en las rutas de gestión', () => {
  it('ID-1 e ID-2: no numéricos, cero, negativos, decimales y fuera de rango -> 400', async () => {
    for (const v of ['abc', '0', '-1', '1.5', '2147483648']) {
      const r = await como(docA, 'GET', `/api/docente/cursos/${v}`);
      assert.equal(r.status, 400, v);
      assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA', v);
      assert.equal(r.json.error.mensaje, 'Revisa los datos enviados.', v);
    }
  });
  it('ID-3: el entero máximo existe como valor y no en la BD -> 404', async () => {
    const r = await como(docA, 'GET', '/api/docente/cursos/2147483647');
    assert.equal(r.status, 404);
    assert.equal(r.json.error.codigo, 'NO_ENCONTRADO');
    assert.equal(r.json.error.mensaje, 'Curso no disponible.');
  });
  it('ID-4 CONGELADO-INSEGURO (ADR-011, punto 11.11): notación científica, hexadecimal y espacios se aceptan', async () => {
    for (const v of ['2.147483647e9', '0x7FFFFFFF', '%202147483647%20', '2147483647.0']) {
      const r = await como(docA, 'GET', `/api/docente/cursos/${v}`);
      assert.equal(r.status, 404, `${v} debería tratarse como 2147483647 hoy`);
    }
  });
});

describe('GET /api/docente/cursos (CAR-CUR-01, 02, 30)', () => {
  it('lista solo los cursos propios en los 5 estados y fija la forma', async () => {
    const ids: Record<string, number> = {};
    for (const e of ['BORRADOR', 'EN_REVISION', 'PUBLICADO', 'RECHAZADO', 'ARCHIVADO']) {
      ids[e] = await crearCurso(docA);
      if (e !== 'BORRADOR') await forzarEstado(ids[e]!, e);
    }
    const ajeno = await crearCurso(docB);
    const r = await como(docA, 'GET', '/api/docente/cursos');
    assert.equal(r.status, 200);
    capturar('CAR-CUR-01 forma', forma(r.json));
    const lista: any[] = Array.isArray(r.json) ? r.json : (r.json.items ?? r.json.cursos);
    capturar('CAR-CUR-01 orden-estados', lista.map((c) => c.estado));
    const propios = lista.filter((c) => c.titulo?.startsWith?.(marca));
    assert.equal(propios.length, 5);
    assert.ok(!lista.some((c) => c.id === ajeno), 'CAR-CUR-30: no incluye cursos de otro docente');
    assert.deepEqual(sinRutasPrivadas(r.json), []);
    const rech = lista.find((c) => c.id === ids['RECHAZADO']);
    capturar('CAR-CUR-01 rechazado', rech);
  });
  it('CAR-CUR-02: docente sin cursos', async () => {
    const nuevo = await fabricaCuentas(f, srv, marca).crearCuenta(['ESTUDIANTE', 'DOCENTE']);
    const r = await como(nuevo, 'GET', '/api/docente/cursos');
    assert.equal(r.status, 200);
    capturar('CAR-CUR-02', r.json);
  });
});

describe('GET /api/docente/cursos/:id (CAR-CUR-03..05)', () => {
  it('CAR-CUR-03: curso propio, CursoDetalle privado sin ruta', async () => {
    const { idCurso } = await cursoCompleto();
    const r = await como(docA, 'GET', `/api/docente/cursos/${idCurso}`);
    assert.equal(r.status, 200);
    capturar('CAR-CUR-03 forma', forma(r.json));
    assert.deepEqual(sinRutasPrivadas(r.json), []);
    assert.ok(!r.texto.includes(pdfDir.dir));
  });
  it('CAR-CUR-04 CONGELADO-INSEGURO (S10, ADR-011): inexistente 404 frente a ajeno 403 (enumeración)', async () => {
    const idB = await crearCurso(docB);
    const ajeno = await como(docA, 'GET', `/api/docente/cursos/${idB}`);
    assert.equal(ajeno.status, 403);
    assert.equal(ajeno.json.error.mensaje, 'No tienes permiso para consultar este curso.');
    const inexistente = await como(docA, 'GET', '/api/docente/cursos/2147483647');
    assert.equal(inexistente.status, 404);
    assert.equal(inexistente.json.error.mensaje, 'Curso no disponible.');
  });
  it('CAR-CUR-05: docente desactivado', async () => {
    const r = await como(docInactivo, 'GET', '/api/docente/cursos');
    capturar('CAR-CUR-05 lista', { status: r.status, codigo: r.json?.error?.codigo });
    const c = await como(docInactivo, 'POST', '/api/cursos', datosCurso('inactivo'));
    capturar('CAR-CUR-05 crear', { status: c.status, error: c.json?.error });
  });
});

describe('POST /api/cursos (CAR-CUR-06..10)', () => {
  it('CAR-CUR-06: curso válido -> 201 BORRADOR', async () => {
    const r = await como(docA, 'POST', '/api/cursos', datosCurso('valido'));
    assert.equal(r.status, 201);
    assert.equal(r.json.estado, 'BORRADOR');
    capturar('CAR-CUR-06 forma', forma(r.json));
    assert.deepEqual(sinRutasPrivadas(r.json), []);
  });

  it('CAR-CUR-07: portadaUrl', async () => {
    const validas = ['/img/a.png', 'https://externo.example/p.png'];
    const invalidas = ['//x', '/a/../b', '/a?b', 'javascript:x', 'https://u:p@x.example/a'];
    for (const p of validas) {
      const r = await como(docA, 'POST', '/api/cursos', datosCurso(`portada ${++n}`, { portadaUrl: p }));
      assert.equal(r.status, 201, p); // la URL externa está CONGELADO-INSEGURO (S6; el punto 11.9 no se aplica)
    }
    for (const p of invalidas) {
      const r = await como(docA, 'POST', '/api/cursos', datosCurso(`portada ${++n}`, { portadaUrl: p }));
      assert.equal(r.status, 400, p);
      assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    }
  });

  it('CAR-CUR-08: NUL en el título', async () => {
    const r = await como(docA, 'POST', '/api/cursos', datosCurso('nul', { titulo: `${marca} a\u0000b` }));
    capturar('CAR-CUR-08', { status: r.status, codigo: r.json?.error?.codigo });
  });

  it('CAR-CUR-09: límites y validación', async () => {
    const t = (len: number) => marca + ' ' + 'x'.repeat(len - marca.length - 1);
    const ok = async (extra: Record<string, unknown>) => (await como(docA, 'POST', '/api/cursos', datosCurso(`l ${++n}`, extra))).status;
    assert.equal(await ok({ titulo: t(150) }), 201);
    assert.equal(await ok({ titulo: t(151) }), 400);
    assert.equal(await ok({ titulo: '   ' }), 400);
    assert.equal(await ok({ descripcion: 'd'.repeat(10000) }), 201);
    assert.equal(await ok({ descripcion: 'd'.repeat(10001) }), 400);
    assert.equal(await ok({ objetivos: Array.from({ length: 10 }, (_, i) => `o${i}`) }), 201);
    assert.equal(await ok({ objetivos: Array.from({ length: 11 }, (_, i) => `o${i}`) }), 400);
    assert.equal(await ok({ objetivos: ['x'.repeat(200)] }), 201);
    assert.equal(await ok({ objetivos: ['x'.repeat(201)] }), 400);
    assert.equal(await ok({ categoriaId: String(categoriaId) }), 400);
    assert.equal(await ok({ nivel: 'EXPERTO' }), 400);
    assert.equal(await ok({ extra: 1 }), 400);
    const r = await como(docA, 'POST', '/api/cursos', datosCurso('x', { nivel: 'EXPERTO' }));
    assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    assert.equal(r.json.error.mensaje, 'Revisa los datos enviados.');
    assert.equal(r.json.error.detalles[0].campo, 'nivel');
  });

  it('CAR-CUR-10: categoría inactiva o inexistente', async () => {
    const a = await como(docA, 'POST', '/api/cursos', datosCurso('cat inactiva', { categoriaId: categoriaInactivaId }));
    capturar('CAR-CUR-10 inactiva', { status: a.status, error: a.json?.error });
    const b = await como(docA, 'POST', '/api/cursos', datosCurso('cat inexistente', { categoriaId: 2147483647 }));
    capturar('CAR-CUR-10 inexistente', { status: b.status, error: b.json?.error });
  });
});

describe('PUT /api/cursos/:id (CAR-CUR-11..13, PREC-3, PREC-4)', () => {
  it('CAR-CUR-11: edición válida en BORRADOR', async () => {
    const id = await crearCurso();
    const r = await como(docA, 'PUT', `/api/cursos/${id}`, datosCurso('editado', { titulo: `${marca} editado ${id}` }));
    assert.equal(r.status, 200);
    assert.equal(r.json.titulo, `${marca} editado ${id}`);
  });
  it('CAR-CUR-12: RECHAZADO edita; EN_REVISION, PUBLICADO y ARCHIVADO -> 409 CURSO_BLOQUEADO', async () => {
    const id = await crearCurso();
    await forzarEstado(id, 'RECHAZADO');
    assert.equal((await como(docA, 'PUT', `/api/cursos/${id}`, datosCurso('r'))).status, 200);
    for (const e of ['EN_REVISION', 'PUBLICADO', 'ARCHIVADO']) {
      await forzarEstado(id, e);
      const r = await como(docA, 'PUT', `/api/cursos/${id}`, datosCurso('b'));
      assert.equal(r.status, 409, e);
      assert.equal(r.json.error.codigo, 'CURSO_BLOQUEADO', e);
      assert.equal(r.json.error.mensaje, 'El curso no permite modificaciones.', e);
    }
  });
  it('CAR-CUR-13, PREC-3 y PREC-4: curso ajeno -> 403; cuerpo inválido sobre curso ajeno -> 400; ajeno PUBLICADO', async () => {
    const id = await crearCurso(docB);
    const a = await como(docA, 'PUT', `/api/cursos/${id}`, datosCurso('x'));
    assert.equal(a.status, 403);
    capturar('CAR-CUR-13 mensaje', a.json.error);
    const p3 = await como(docA, 'PUT', `/api/cursos/${id}`, { titulo: '' });
    assert.equal(p3.status, 400);
    await forzarEstado(id, 'PUBLICADO');
    const p4 = await como(docA, 'PUT', `/api/cursos/${id}`, datosCurso('x'));
    capturar('PREC-4', { status: p4.status, error: p4.json?.error });
  });
});

describe('Módulos (CAR-CUR-14..19, 31, 32)', () => {
  it('CAR-CUR-14 y 15: creación, límites de orden, duplicado y bloqueo', async () => {
    const id = await crearCurso();
    const r = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'M1', orden: 1 });
    assert.equal(r.status, 201);
    capturar('CAR-CUR-14 forma', forma(r.json));
    const m10 = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'M10', orden: 10 });
    assert.equal(m10.status, 201);
    for (const orden of [0, 11]) {
      const x = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'X', orden });
      assert.equal(x.status, 400, String(orden));
      assert.equal(x.json.error.mensaje, 'Revisa los datos del módulo.');
    }
    const dup = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'D', orden: 1 });
    assert.equal(dup.status, 409);
    capturar('CAR-CUR-15 duplicado', dup.json.error);
    await forzarEstado(id, 'EN_REVISION');
    const bl = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'B', orden: 2 });
    assert.equal(bl.status, 409);
    assert.equal(bl.json.error.codigo, 'CURSO_BLOQUEADO');
  });
  it('CAR-CUR-16 y 17: edición, orden propio, orden ajeno, bloqueo e inexistente', async () => {
    const id = await crearCurso();
    const m1 = await crearModulo(id, 1);
    const m2 = await crearModulo(id, 2);
    assert.equal((await como(docA, 'PUT', `/api/modulos/${m1}`, { titulo: 'Nuevo', orden: 1 })).status, 200);
    const ocupado = await como(docA, 'PUT', `/api/modulos/${m1}`, { titulo: 'Nuevo', orden: 2 });
    assert.equal(ocupado.status, 409);
    capturar('CAR-CUR-17 orden ocupado', ocupado.json.error);
    const inex = await como(docA, 'PUT', '/api/modulos/2147483647', { titulo: 'N', orden: 1 });
    assert.equal(inex.status, 404);
    capturar('CAR-CUR-17 inexistente', inex.json.error);
    await forzarEstado(id, 'PUBLICADO');
    const bl = await como(docA, 'PUT', `/api/modulos/${m2}`, { titulo: 'N', orden: 2 });
    assert.equal(bl.status, 409);
    assert.equal(bl.json.error.codigo, 'CURSO_BLOQUEADO');
  });
  it('CAR-CUR-18 y 19: borrado, bloqueo, inexistente y con lecciones y PDF', async () => {
    const { idCurso, idModulo } = await cursoCompleto();
    const antes = await f.query<{ n: string }>('SELECT count(*) AS n FROM archivo WHERE id_curso = $1', [idCurso]);
    assert.equal(antes.rows[0]!.n, '1');
    const del = await como(docA, 'DELETE', `/api/modulos/${idModulo}`);
    assert.equal(del.status, 200);
    assert.deepEqual(del.json.modulos, []);
    capturar('CAR-CUR-19 archivo_borrado_pendiente', (await f.query('SELECT count(*)::int AS n FROM archivo_borrado_pendiente')).rows[0]);
    const inex = await como(docA, 'DELETE', '/api/modulos/2147483647');
    assert.equal(inex.status, 404);
    const otro = await crearCurso();
    const m = await crearModulo(otro, 1);
    await forzarEstado(otro, 'EN_REVISION');
    const bl = await como(docA, 'DELETE', `/api/modulos/${m}`);
    assert.equal(bl.status, 409);
    assert.equal(bl.json.error.codigo, 'CURSO_BLOQUEADO');
  });
  it('CAR-CUR-31 y 32: módulo de un curso ajeno', async () => {
    const id = await crearCurso(docB);
    const m = await crearModulo(id, 1, docB);
    const put = await como(docA, 'PUT', `/api/modulos/${m}`, { titulo: 'X', orden: 1 });
    const del = await como(docA, 'DELETE', `/api/modulos/${m}`);
    assert.equal(put.status, 403);
    assert.equal(del.status, 403);
    capturar('CAR-CUR-31/32', { put: put.json.error, del: del.json.error });
    const crear = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'X', orden: 2 });
    assert.equal(crear.status, 403);
    const p3 = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: '', orden: 2 });
    assert.equal(p3.status, 400, 'PREC-3');
  });
});

describe('Lecciones (CAR-CUR-20..25, 33..35)', () => {
  it('CAR-CUR-20 y 21: creación, tipos, límites de orden, duplicado y bloqueo', async () => {
    const id = await crearCurso();
    const m = await crearModulo(id, 1);
    const r = await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 1, tipo: 'DOCUMENTO' });
    assert.equal(r.status, 201);
    capturar('CAR-CUR-20 forma', forma(r.json));
    for (const tipo of ['VIDEO', 'EVALUACION']) {
      const x = await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 2, tipo });
      assert.equal(x.status, 400, tipo);
      assert.equal(x.json.error.mensaje, 'Revisa los datos de la lección.');
    }
    assert.equal((await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 12, tipo: 'DOCUMENTO' })).status, 201);
    assert.equal((await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 13, tipo: 'DOCUMENTO' })).status, 400);
    assert.equal((await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 1, tipo: 'DOCUMENTO' })).status, 409);
    await forzarEstado(id, 'PUBLICADO');
    const bl = await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 3, tipo: 'DOCUMENTO' });
    assert.equal(bl.status, 409);
    assert.equal(bl.json.error.codigo, 'CURSO_BLOQUEADO');
  });
  it('CAR-CUR-22 y 23: edición, orden propio, orden ocupado y bloqueo', async () => {
    const id = await crearCurso();
    const m = await crearModulo(id, 1);
    const l1 = await crearLeccion(m, 1);
    await crearLeccion(m, 2);
    assert.equal((await como(docA, 'PUT', `/api/lecciones/${l1}`, { titulo: 'N', orden: 1, tipo: 'DOCUMENTO' })).status, 200);
    assert.equal((await como(docA, 'PUT', `/api/lecciones/${l1}`, { titulo: 'N', orden: 2, tipo: 'DOCUMENTO' })).status, 409);
    await forzarEstado(id, 'EN_REVISION');
    const bl = await como(docA, 'PUT', `/api/lecciones/${l1}`, { titulo: 'N', orden: 1, tipo: 'DOCUMENTO' });
    assert.equal(bl.status, 409);
    assert.equal(bl.json.error.codigo, 'CURSO_BLOQUEADO');
  });
  it('CAR-CUR-24 y 25: DELETE de una lección con PDF; bloqueo; inexistente', async () => {
    const { idCurso, idLeccion } = await cursoCompleto();
    const r = await como(docA, 'DELETE', `/api/lecciones/${idLeccion}`);
    assert.equal(r.status, 200);
    capturar('CAR-CUR-24 forma', forma(r.json));
    const fila = await f.query<{ n: string }>('SELECT count(*) AS n FROM leccion WHERE id_leccion = $1', [idLeccion]);
    assert.equal(fila.rows[0]!.n, '0');
    capturar('CAR-CUR-25 archivo_borrado_pendiente', (await f.query('SELECT count(*)::int AS n FROM archivo_borrado_pendiente')).rows[0]);
    assert.equal((await como(docA, 'DELETE', '/api/lecciones/2147483647')).status, 404);
    const m = await crearModulo(idCurso, 2);
    const l = await crearLeccion(m, 1);
    await forzarEstado(idCurso, 'EN_REVISION');
    const bl = await como(docA, 'DELETE', `/api/lecciones/${l}`);
    assert.equal(bl.status, 409);
    assert.equal(bl.json.error.codigo, 'CURSO_BLOQUEADO');
  });
  it('CAR-CUR-33, 34 y 35: lección o módulo de un curso ajeno', async () => {
    const id = await crearCurso(docB);
    const m = await crearModulo(id, 1, docB);
    const l = await crearLeccion(m, 1, docB);
    const post = await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'X', orden: 2, tipo: 'DOCUMENTO' });
    const put = await como(docA, 'PUT', `/api/lecciones/${l}`, { titulo: 'X', orden: 1, tipo: 'DOCUMENTO' });
    const del = await como(docA, 'DELETE', `/api/lecciones/${l}`);
    assert.deepEqual([post.status, put.status, del.status], [403, 403, 403]);
    capturar('CAR-CUR-33..35', { post: post.json.error, put: put.json.error, del: del.json.error });
    assert.equal((await como(docA, 'PUT', `/api/lecciones/${l}`, { titulo: '' })).status, 400, 'PREC-3');
  });
});

describe('POST /api/cursos/:id/enviar-revision (CAR-CUR-26..28, 36)', () => {
  it('CAR-CUR-26: curso completo -> 200 EN_REVISION', async () => {
    const { idCurso } = await cursoCompleto();
    const r = await como(docA, 'POST', `/api/cursos/${idCurso}/enviar-revision`);
    assert.equal(r.status, 200);
    assert.equal(r.json.estado, 'EN_REVISION');
    capturar('CAR-CUR-26 forma', forma(r.json));
    assert.deepEqual(sinRutasPrivadas(r.json), []);
  });
  it('CAR-CUR-27: curso incompleto -> 400 con detalles', async () => {
    const id = await crearCurso(docA, { objetivos: [] });
    const r = await como(docA, 'POST', `/api/cursos/${id}/enviar-revision`);
    assert.equal(r.status, 400);
    assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    assert.equal(r.json.error.mensaje, 'El curso todavía está incompleto.');
    capturar('CAR-CUR-27 detalles', r.json.error.detalles);
  });
  it('CAR-CUR-28: desde RECHAZADO -> 200 y motivoRechazo null; EN_REVISION y PUBLICADO -> 409', async () => {
    const { idCurso } = await cursoCompleto();
    await forzarEstado(idCurso, 'RECHAZADO');
    const r = await como(docA, 'POST', `/api/cursos/${idCurso}/enviar-revision`);
    assert.equal(r.status, 200);
    assert.equal(r.json.motivoRechazo, null);
    for (const e of ['EN_REVISION', 'PUBLICADO']) {
      await forzarEstado(idCurso, e);
      const x = await como(docA, 'POST', `/api/cursos/${idCurso}/enviar-revision`);
      assert.equal(x.status, 409, e);
      assert.equal(x.json.error.codigo, 'CURSO_BLOQUEADO');
      assert.equal(x.json.error.mensaje, 'Este curso ya no puede enviarse a revisión.');
    }
  });
  it('CAR-CUR-36: curso ajeno -> 403', async () => {
    const id = await crearCurso(docB);
    const r = await como(docA, 'POST', `/api/cursos/${id}/enviar-revision`);
    assert.equal(r.status, 403);
    assert.equal(r.json.error.mensaje, 'No puedes enviar este curso a revisión.');
  });
});
