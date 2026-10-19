// Caracterización de la gestión de cursos del docente (CAR-CUR-01..36, paquetes AUT/ID/IDOR/PREC).
// Fija el comportamiento ACTUAL. Lo marcado CONGELADO-INSEGURO está aprobado para cambiar en el
// ADR-011; se actualiza en el mismo commit que lo cambie. No se ajustan expectativas para "pasar".
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, pdfMinimo, subirPdf } from '../ayudas/archivos.js';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { errorIdInvalido, forma, ID_DEMASIADO_GRANDE, ID_NO_DECIMAL, IDS_NO_DECIMALES, sinRutasPrivadas } from '../ayudas/contrato.js';
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
let fab: ReturnType<typeof fabricaCuentas>;

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
    `UPDATE curso SET estado = $2::text,
       motivo_rechazo = CASE WHEN $2::text = 'RECHAZADO' THEN 'Motivo de prueba' ELSE NULL END,
       revisado_por = CASE WHEN $2::text IN ('PUBLICADO', 'RECHAZADO') THEN $3::int ELSE NULL END,
       publicado_en = CASE WHEN $2::text = 'PUBLICADO' THEN now() ELSE NULL END
     WHERE id_curso = $1`,
    [idCurso, estado, admin.idPersona]);

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  fab = fabricaCuentas(f, srv, marca);
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
      const cuerpo = metodo === 'GET' ? undefined : {};
      const sin = await srv.pedir(ruta, { metodo, cuerpo });
      assert.equal(sin.status, 401);
      assert.deepEqual(sin.json, { error: NO_AUTENTICADO });
      // AUT-2: firma alterada
      const t = docA.token;
      const i = t.length - 4;
      const alterado = t.slice(0, i) + (t[i] === 'A' ? 'B' : 'A') + t.slice(i + 1);
      const r2 = await srv.pedir(ruta, { metodo, cuerpo, token: alterado });
      assert.equal(r2.status, 401);
      assert.equal(r2.json.error.codigo, 'TOKEN_INVALIDO');
      // AUT-3: esquema distinto y Bearer sin token
      const r3 = await srv.pedir(ruta, { metodo, cuerpo, headers: { authorization: 'Basic abc' } });
      assert.equal(r3.status, 401);
      assert.equal(r3.json.error.codigo, 'NO_AUTENTICADO');
      const r3b = await srv.pedir(ruta, { metodo, cuerpo, headers: { authorization: 'Bearer' } });
      assert.equal(r3b.status, 401);
      assert.equal(r3b.json.error.codigo, 'NO_AUTENTICADO');
      // AUT-5 / IDOR-3: ESTUDIANTE y ADMIN sin DOCENTE
      for (const c of [est, admin]) {
        const r = await como(c, metodo, ruta, cuerpo);
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
  // ADR-011, punto 11.11: el id de ruta es un entero positivo en decimal (nada de 1e3, 0x10, " 7 ", 7.0 ni 007).
  const RUTAS_CON_ID: Array<[string, string]> = [
    ['GET', '/api/docente/cursos/:id'], ['PUT', '/api/cursos/:id'], ['POST', '/api/cursos/:id/modulos'], ['PUT', '/api/modulos/:id'],
    ['DELETE', '/api/modulos/:id'], ['POST', '/api/modulos/:id/lecciones'], ['PUT', '/api/lecciones/:id'], ['DELETE', '/api/lecciones/:id'],
    ['POST', '/api/cursos/:id/enviar-revision'], ['POST', '/api/lecciones/:id/archivo'], ['GET', '/api/archivos/:id'],
  ];
  it('ID-1, ID-2 e ID-4 (11.11): ids no decimales, ceros, negativos y fuera de rango -> 400 con detalle del campo id', async () => {
    for (const [metodo, plantilla] of RUTAS_CON_ID) {
      for (const v of IDS_NO_DECIMALES) {
        const r = await como(docA, metodo, plantilla.replace(':id', v), metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
        assert.equal(r.status, 400, `${metodo} ${plantilla} ${v}`);
        assert.deepEqual(r.json, errorIdInvalido(ID_NO_DECIMAL), `${metodo} ${plantilla} ${v}`);
      }
      const grande = await como(docA, metodo, plantilla.replace(':id', '2147483648'), metodo === 'GET' || metodo === 'DELETE' ? undefined : {});
      assert.equal(grande.status, 400, `${metodo} ${plantilla} 2147483648`);
      assert.deepEqual(grande.json, errorIdInvalido(ID_DEMASIADO_GRANDE), `${metodo} ${plantilla} 2147483648`);
    }
  });
  it('ID-3: el entero máximo existe como valor y no en la BD -> 404', async () => {
    const r = await como(docA, 'GET', '/api/docente/cursos/2147483647');
    assert.equal(r.status, 404);
    assert.equal(r.json.error.codigo, 'NO_ENCONTRADO');
    assert.equal(r.json.error.mensaje, 'Curso no disponible.');
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
    assert.deepEqual(forma(r.json), { items: [{ id: 'number', titulo: 'string', estado: 'string', motivoRechazo: 'null', docente: 'string', modulos: 'number' }] });
    const lista: any[] = r.json.items;
    assert.deepEqual(lista.map((c) => c.estado), ['ARCHIVADO', 'RECHAZADO', 'PUBLICADO', 'EN_REVISION', 'BORRADOR'], 'orden por id descendente');
    const propios = lista.filter((c) => c.titulo?.startsWith?.(marca));
    assert.equal(propios.length, 5);
    assert.ok(!lista.some((c) => c.id === ajeno), 'CAR-CUR-30: no incluye cursos de otro docente');
    assert.deepEqual(sinRutasPrivadas(r.json), []);
    const rech = lista.find((c) => c.id === ids['RECHAZADO']);
    assert.equal(rech.motivoRechazo, 'Motivo de prueba');
  });
  it('CAR-CUR-02: docente sin cursos', async () => {
    const nuevo = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
    const r = await como(nuevo, 'GET', '/api/docente/cursos');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { items: [] });
  });
});

describe('GET /api/docente/cursos/:id (CAR-CUR-03..05)', () => {
  it('CAR-CUR-03: curso propio, CursoDetalle privado sin ruta', async () => {
    const { idCurso } = await cursoCompleto();
    const r = await como(docA, 'GET', `/api/docente/cursos/${idCurso}`);
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json), ['id', 'titulo', 'subtitulo', 'descripcion', 'categoriaId', 'categoriaNombre', 'nivel', 'portadaUrl', 'objetivos', 'requisitos', 'estado', 'motivoRechazo', 'docente', 'modulos', 'validacion']);
    assert.deepEqual(Object.keys(r.json.modulos[0].lecciones[0].archivo), ['id', 'tipo', 'nombreOriginal', 'tamanoBytes']);
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
    assert.equal(r.status, 200, 'la lista de un docente inactivo responde 200 hoy');
    const c = await como(docInactivo, 'POST', '/api/cursos', datosCurso('inactivo'));
    assert.equal(c.status, 403);
    assert.deepEqual(c.json.error, { codigo: 'SIN_PERMISO', mensaje: 'No tienes un perfil docente activo.' });
  });
});

describe('POST /api/cursos (CAR-CUR-06..10)', () => {
  it('CAR-CUR-06: curso válido -> 201 BORRADOR', async () => {
    const r = await como(docA, 'POST', '/api/cursos', datosCurso('valido'));
    assert.equal(r.status, 201);
    assert.equal(r.json.estado, 'BORRADOR');
    assert.deepEqual(Object.keys(r.json), ['id', 'titulo', 'subtitulo', 'descripcion', 'categoriaId', 'categoriaNombre', 'nivel', 'portadaUrl', 'objetivos', 'requisitos', 'estado', 'motivoRechazo', 'docente', 'modulos', 'validacion']);
    assert.deepEqual(r.json.modulos, []);
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

  it('CAR-CUR-08 (ADR-011, 11.7): NUL en el título -> 400 SOLICITUD_INVALIDA (por ahora sin detalles)', async () => {
    const r = await como(docA, 'POST', '/api/cursos', datosCurso('nul', { titulo: `${marca} a\u0000b` }));
    assert.equal(r.status, 400);
    assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    assert.equal(r.json.error.detalles, undefined);
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
    assert.equal(a.status, 400);
    assert.equal(a.json.error.mensaje, 'Selecciona una categoría existente y activa.');
    assert.deepEqual(a.json.error.detalles, [{ campo: 'categoriaId', mensaje: 'La categoría no existe o está inactiva.' }]);
    const b = await como(docA, 'POST', '/api/cursos', datosCurso('cat inexistente', { categoriaId: 2147483647 }));
    assert.equal(b.status, 400);
    assert.deepEqual(b.json.error, a.json.error);
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
    assert.equal(a.json.error.mensaje, 'No puedes editar este curso.');
    const p3 = await como(docA, 'PUT', `/api/cursos/${id}`, { titulo: '' });
    assert.equal(p3.status, 400);
    await forzarEstado(id, 'PUBLICADO');
    const p4 = await como(docA, 'PUT', `/api/cursos/${id}`, datosCurso('x'));
    assert.equal(p4.status, 403, 'el propietario se comprueba antes que el estado');
  });
});

describe('Módulos (CAR-CUR-14..19, 31, 32)', () => {
  it('CAR-CUR-14 y 15: creación, límites de orden, duplicado y bloqueo', async () => {
    const id = await crearCurso();
    const r = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'M1', orden: 1 });
    assert.equal(r.status, 201);
    assert.deepEqual(Object.keys(r.json), ['id', 'titulo', 'subtitulo', 'descripcion', 'categoriaId', 'categoriaNombre', 'nivel', 'portadaUrl', 'objetivos', 'requisitos', 'estado', 'motivoRechazo', 'docente', 'modulos', 'validacion']);
    const m10 = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'M10', orden: 10 });
    assert.equal(m10.status, 201);
    for (const orden of [0, 11]) {
      const x = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'X', orden });
      assert.equal(x.status, 400, String(orden));
      assert.equal(x.json.error.mensaje, 'Revisa los datos del módulo.');
    }
    const dup = await como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'D', orden: 1 });
    // El plan decía 409; el comportamiento real es 400 SOLICITUD_INVALIDA (se fija lo real).
    assert.equal(dup.status, 400);
    assert.equal(dup.json.error.codigo, 'SOLICITUD_INVALIDA');
    assert.equal(dup.json.error.mensaje, 'El orden del módulo ya está ocupado.');
    assert.deepEqual(dup.json.error.detalles, [{ campo: 'orden', mensaje: 'Selecciona un orden disponible.' }]);
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
    assert.equal(ocupado.status, 400);
    assert.equal(ocupado.json.error.mensaje, 'El orden del módulo ya está ocupado.');
    assert.equal(ocupado.json.error.detalles[0].mensaje, 'Selecciona otro orden.');
    const inex = await como(docA, 'PUT', '/api/modulos/2147483647', { titulo: 'N', orden: 1 });
    assert.equal(inex.status, 404);
    assert.deepEqual(inex.json.error, { codigo: 'NO_ENCONTRADO', mensaje: 'Módulo no disponible.' });
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
    assert.equal((await f.query('SELECT count(*) AS n FROM archivo WHERE id_curso = $1', [idCurso])).rows[0]!.n, '0');
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
    assert.equal(put.json.error.mensaje, 'No puedes modificar este módulo.');
    assert.equal(del.json.error.mensaje, 'No puedes eliminar este módulo.');
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
    assert.deepEqual(Object.keys(r.json.modulos[0].lecciones[0]), ['id', 'titulo', 'orden', 'tipo', 'archivo']);
    assert.equal(r.json.modulos[0].lecciones[0].archivo, null);
    for (const tipo of ['VIDEO', 'EVALUACION']) {
      const x = await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 2, tipo });
      assert.equal(x.status, 400, tipo);
      assert.equal(x.json.error.mensaje, 'Revisa los datos de la lección.');
    }
    assert.equal((await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 12, tipo: 'DOCUMENTO' })).status, 201);
    assert.equal((await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 13, tipo: 'DOCUMENTO' })).status, 400);
    const dupL = await como(docA, 'POST', `/api/modulos/${m}/lecciones`, { titulo: 'L', orden: 1, tipo: 'DOCUMENTO' });
    assert.equal(dupL.status, 400);
    assert.equal(dupL.json.error.mensaje, 'El orden de la lección ya está ocupado.');
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
    const ocL = await como(docA, 'PUT', `/api/lecciones/${l1}`, { titulo: 'N', orden: 2, tipo: 'DOCUMENTO' });
    assert.equal(ocL.status, 400);
    assert.equal(ocL.json.error.mensaje, 'El orden de la lección ya está ocupado.');
    await forzarEstado(id, 'EN_REVISION');
    const bl = await como(docA, 'PUT', `/api/lecciones/${l1}`, { titulo: 'N', orden: 1, tipo: 'DOCUMENTO' });
    assert.equal(bl.status, 409);
    assert.equal(bl.json.error.codigo, 'CURSO_BLOQUEADO');
  });
  it('CAR-CUR-24 y 25: DELETE de una lección con PDF; bloqueo; inexistente', async () => {
    const { idCurso, idLeccion } = await cursoCompleto();
    const r = await como(docA, 'DELETE', `/api/lecciones/${idLeccion}`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.modulos[0].lecciones, []);
    const fila = await f.query<{ n: string }>('SELECT count(*) AS n FROM leccion WHERE id_leccion = $1', [idLeccion]);
    assert.equal(fila.rows[0]!.n, '0');
    assert.equal((await f.query('SELECT count(*) AS n FROM archivo WHERE id_curso = $1', [idCurso])).rows[0]!.n, '0');
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
    assert.equal(post.json.error.mensaje, 'No puedes modificar este curso.');
    assert.equal(put.json.error.mensaje, 'No puedes modificar esta lección.');
    assert.equal(del.json.error.mensaje, 'No puedes eliminar esta lección.');
    assert.equal((await como(docA, 'PUT', `/api/lecciones/${l}`, { titulo: '' })).status, 400, 'PREC-3');
  });
});

describe('POST /api/cursos/:id/enviar-revision (CAR-CUR-26..28, 36)', () => {
  it('CAR-CUR-26: curso completo -> 200 EN_REVISION', async () => {
    const { idCurso } = await cursoCompleto();
    const r = await como(docA, 'POST', `/api/cursos/${idCurso}/enviar-revision`);
    assert.equal(r.status, 200);
    assert.equal(r.json.estado, 'EN_REVISION');
    assert.deepEqual(r.json.validacion, { completo: true, problemas: [] });
    assert.deepEqual(sinRutasPrivadas(r.json), []);
  });
  it('CAR-CUR-27: curso incompleto -> 400 con detalles', async () => {
    const id = await crearCurso(docA, { objetivos: [] });
    const r = await como(docA, 'POST', `/api/cursos/${id}/enviar-revision`);
    assert.equal(r.status, 400);
    assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    assert.equal(r.json.error.mensaje, 'El curso todavía está incompleto.');
    assert.deepEqual(r.json.error.detalles, [
      { campo: 'objetivos', mensaje: 'Indica entre 3 y 10 objetivos de hasta 200 caracteres.' },
      { campo: 'modulos', mensaje: 'El curso requiere entre 1 y 10 módulos.' },
      { campo: 'modulos', mensaje: 'Agrega al menos una lección DOCUMENTO con PDF válido.' },
    ]);
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
