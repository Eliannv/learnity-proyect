// Seguridad por HTTP sin inyección de fallos: tokens (SEG-01..03), enumeración/IDOR (SEG-13), inyección (SEG-14),
// XSS almacenado (SEG-15), concurrencia (SEG-10, 12, 22), subidas sin límite (SEG-28) y límites por IP (SEG-32).
// Lo que usa fallos de disco o de BD (SEG-23..30) espera el seam acordado con be-b.
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia, filasYFicheros, pdfMinimo, subirPdf } from '../ayudas/archivos.js';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { capturar } from '../ayudas/captura.js';
import { sinRutasPrivadas } from '../ayudas/contrato.js';
import { fabricaCursos } from '../ayudas/cursos-http.js';
import { crearMarca } from '../ayudas/datos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('seg_acc');
const pdfDir = carpetaPdfPropia();

let f: Fixtures;
let srv: Servidor;
let docA: Cuenta;
let docB: Cuenta;
let admin: Cuenta;
let categoriaId = 0;
let c: ReturnType<typeof fabricaCursos>;
let reiniciar: () => void;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  ({ reiniciarLimites: reiniciar } = await import('../../src/shared/http/limite-peticiones.js'));
  const fab = fabricaCuentas(f, srv, marca);
  docA = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  docB = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  const r = await f.query<{ id: number }>('INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, admin.idPersona]);
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

function tokenForjado(opciones: { secreto?: string; algoritmo?: 'HS256' | 'none'; expira?: number } = {}) {
  const sid = '00000000-0000-4000-8000-000000000000';
  const carga = { idPersona: docA.idPersona, correo: docA.correo, roles: ['ESTUDIANTE', 'DOCENTE'], sid };
  const base = { subject: String(docA.idUsuario), issuer: 'learnity-api', audience: 'learnity-web' };
  if (opciones.algoritmo === 'none') return jwt.sign(carga, '', { ...base, algorithm: 'none', expiresIn: 600 });
  return jwt.sign(carga, opciones.secreto ?? process.env['JWT_SECRET']!, { ...base, algorithm: 'HS256', expiresIn: opciones.expira ?? 600 });
}

describe('Tokens (SEG-01..03)', () => {
  it('SEG-01: alg none o secreto ajeno -> 401 TOKEN_INVALIDO', async () => {
    for (const token of [tokenForjado({ algoritmo: 'none' }), tokenForjado({ secreto: 'otro-secreto-que-no-es-el-del-servidor-1234567890' })]) {
      const r = await srv.pedir('/api/docente/cursos', { token });
      assert.equal(r.status, 401);
      assert.equal(r.json.error.codigo, 'TOKEN_INVALIDO');
    }
  });

  it('SEG-02: token caducado -> 401 TOKEN_INVALIDO', async () => {
    const r = await srv.pedir('/api/docente/cursos', { token: tokenForjado({ expira: -60 }) });
    assert.equal(r.status, 401);
    assert.equal(r.json.error.codigo, 'TOKEN_INVALIDO');
  });

  it('token bien firmado pero con sesión inexistente -> 401 SESION_REVOCADA', async () => {
    const r = await srv.pedir('/api/docente/cursos', { token: tokenForjado() });
    assert.equal(r.status, 401);
    assert.equal(r.json.error.codigo, 'SESION_REVOCADA');
  });

  it('SEG-03: cuenta desactivada con un access token vigente', async () => {
    const otra = await fabricaCuentas(f, srv, marca).crearCuenta(['ESTUDIANTE', 'DOCENTE']);
    await f.query("UPDATE usuario SET estado = 'INACTIVO' WHERE id_usuario = $1", [otra.idUsuario]);
    const r = await srv.pedir('/api/docente/cursos', { token: otra.token });
    capturar('SEG-03', { status: r.status, error: r.json?.error });
  });
});

describe('Enumeración e IDOR (SEG-13)', () => {
  it('el docente B recorre cursos, módulos, lecciones y archivos de A: nunca 200', async () => {
    const { idCurso, idModulo, idLeccion, idArchivo } = await c.cursoCompleto(docA);
    const intentos: Array<[string, string, unknown?]> = [
      ['GET', `/api/docente/cursos/${idCurso}`],
      ['PUT', `/api/cursos/${idCurso}`, c.datosCurso('x')],
      ['POST', `/api/cursos/${idCurso}/modulos`, { titulo: 'x', orden: 5 }],
      ['PUT', `/api/modulos/${idModulo}`, { titulo: 'x', orden: 1 }],
      ['DELETE', `/api/modulos/${idModulo}`],
      ['POST', `/api/modulos/${idModulo}/lecciones`, { titulo: 'x', orden: 5, tipo: 'DOCUMENTO' }],
      ['PUT', `/api/lecciones/${idLeccion}`, { titulo: 'x', orden: 1, tipo: 'DOCUMENTO' }],
      ['DELETE', `/api/lecciones/${idLeccion}`],
      ['POST', `/api/cursos/${idCurso}/enviar-revision`],
      ['GET', `/api/archivos/${idArchivo}`],
    ];
    for (const [metodo, ruta, cuerpo] of intentos) {
      const r = await c.como(docB, metodo, ruta, cuerpo);
      assert.ok([403, 404].includes(r.status), `${metodo} ${ruta} -> ${r.status}`);
    }
    const subida = await subirPdf(srv, idLeccion, docB.token, await pdfMinimo());
    assert.ok([403, 404].includes(subida.status), `subida ajena -> ${subida.status}`);
    const intactoA = await c.como(docA, 'GET', `/api/docente/cursos/${idCurso}`);
    assert.equal(intactoA.json.modulos.length, 1);
  });
});

describe('Inyección y XSS almacenado (SEG-14, 15)', () => {
  it('SEG-14: q y categoria con comillas, $1 y comentarios no rompen ni amplían el resultado', async () => {
    const base = await srv.pedir(`/api/cursos?q=${encodeURIComponent(marca)}`);
    for (const q of ["' OR 1=1 --", '$1', "\\'", `${marca}' OR '1'='1`, '"; DROP TABLE curso; --']) {
      const r = await srv.pedir(`/api/cursos?q=${encodeURIComponent(q)}`);
      assert.equal(r.status, 200, q);
      assert.equal(r.json.total, 0, q);
    }
    for (const cat of ["' OR 1=1 --", "a'b", '"']) {
      const r = await srv.pedir(`/api/cursos?q=${encodeURIComponent(marca)}&categoria=${encodeURIComponent(cat)}`);
      assert.equal(r.status, 200, cat);
      assert.equal(r.json.total, 0, cat);
    }
    assert.equal(base.status, 200);
    const sigue = await srv.pedir('/api/categorias');
    assert.equal(sigue.status, 200);
  });

  it('SEG-15: payloads XSS se guardan y devuelven literales como JSON', async () => {
    const xss = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const creado = await c.como(docA, 'POST', '/api/cursos', c.datosCurso('xss', { titulo: `${marca} ${xss}`, descripcion: xss, objetivos: [xss, xss, xss] }));
    assert.equal(creado.status, 201);
    assert.equal(creado.json.descripcion, xss);
    assert.match(creado.headers.get('content-type') ?? '', /^application\/json; charset=utf-8/);
    const leido = await c.como(docA, 'GET', `/api/docente/cursos/${creado.json.id}`);
    assert.deepEqual(leido.json.objetivos, [xss, xss, xss]);
    const idMod = await c.crearModulo(docA, creado.json.id, 1);
    const idLec = await c.crearLeccion(docA, idMod, 1);
    const sub = await subirPdf(srv, idLec, docA.token, await pdfMinimo(), '<img src=x onerror=1>.pdf');
    assert.equal(sub.status, 200);
    assert.equal(sub.json.modulos[0].lecciones[0].archivo.nombreOriginal, '<img src=x onerror=1>.pdf');
    assert.match(sub.headers.get('content-type') ?? '', /^application\/json/);
    assert.equal(sub.headers.get('x-content-type-options'), 'nosniff');
  });
});

describe('Concurrencia (SEG-10, 12, 22)', () => {
  it('SEG-12: dos POST de módulo con el mismo orden a la vez', async () => {
    const id = await c.crearCurso(docA);
    const pedir = () => c.como(docA, 'POST', `/api/cursos/${id}/modulos`, { titulo: 'M', orden: 1 });
    const [a, b] = await Promise.all([pedir(), pedir()]);
    capturar('SEG-12', [a.status, b.status, a.json?.error?.codigo, b.json?.error?.codigo]);
    assert.equal([a.status, b.status].filter((s) => s === 201).length, 1);
    const { rows } = await f.query<{ n: string }>('SELECT count(*) AS n FROM modulo WHERE id_curso = $1', [id]);
    assert.equal(rows[0]!.n, '1');
  });

  it('SEG-10: dos enviar-revision a la vez', async () => {
    const { idCurso } = await c.cursoCompleto(docA);
    const pedir = () => c.como(docA, 'POST', `/api/cursos/${idCurso}/enviar-revision`);
    const [a, b] = await Promise.all([pedir(), pedir()]);
    capturar('SEG-10', [a.status, b.status, a.json?.error?.codigo, b.json?.error?.codigo]);
    assert.equal([a.status, b.status].filter((s) => s === 200).length, 1);
    const { rows } = await f.query('SELECT estado FROM curso WHERE id_curso = $1', [idCurso]);
    assert.equal(rows[0]!.estado, 'EN_REVISION');
  });

  it('SEG-22: dos subidas simultáneas a la misma lección dejan un solo archivo', async () => {
    const id = await c.crearCurso(docA);
    const m = await c.crearModulo(docA, id, 1);
    const l = await c.crearLeccion(docA, m, 1);
    const [a, b] = await Promise.all([
      subirPdf(srv, l, docA.token, await pdfMinimo(1), 'a.pdf'),
      subirPdf(srv, l, docA.token, await pdfMinimo(2), 'b.pdf'),
    ]);
    capturar('SEG-22', [a.status, b.status, a.json?.error?.codigo, b.json?.error?.codigo]);
    const { filas, ficheros } = await filasYFicheros(f, pdfDir.dir, [id]);
    assert.equal(filas, 1, 'una sola fila asociada');
    const total = await f.query<{ n: string }>('SELECT count(*) AS n FROM archivo');
    capturar('SEG-22 filas globales vs ficheros', { filas: total.rows[0]!.n, ficheros });
  });
});

describe('Sin límite de subidas y límites por IP (SEG-28, SEG-32)', () => {
  it('SEG-28 CONGELADO-INSEGURO (S5, ADR-011 11.4): 20 subidas seguidas sin 429', async () => {
    reiniciar();
    const id = await c.crearCurso(docA);
    const m = await c.crearModulo(docA, id, 1);
    const l = await c.crearLeccion(docA, m, 1);
    const pdf = await pdfMinimo();
    const estados: number[] = [];
    for (let i = 0; i < 20; i++) estados.push((await subirPdf(srv, l, docA.token, pdf, `s${i}.pdf`)).status);
    assert.ok(estados.every((s) => s === 200), estados.join());
  });

  it('SEG-32: límites de registro (10), recuperar (5) y cambio de contraseña (10) devuelven 429 con Retry-After', async () => {
    reiniciar();
    const casos: Array<[string, string, number, unknown]> = [
      ['POST', '/api/auth/recuperar', 5, { correo: 'a@b.co' }],
      ['POST', '/api/auth/restablecer', 10, { token: 'x', contrasena: 'corta' }],
      ['POST', '/api/auth/registro', 10, {}],
    ];
    for (const [metodo, ruta, maximo, cuerpo] of casos) {
      reiniciar();
      let ultima;
      for (let i = 0; i < maximo + 1; i++) ultima = await srv.pedir(ruta, { metodo, cuerpo });
      assert.equal(ultima!.status, 429, ruta);
      assert.equal(ultima!.json.error.codigo, 'DEMASIADAS_PETICIONES', ruta);
      assert.ok(Number(ultima!.headers.get('retry-after')) > 0, ruta);
    }
    reiniciar();
  });
});

describe('Rutas privadas (SEG-31)', () => {
  it('ninguna respuesta de cursos, revisión o perfil contiene hash, contraseña ni ruta', async () => {
    const { idCurso } = await c.cursoCompleto(docA);
    await c.enviarARevision(docA, idCurso);
    await c.como(admin, 'PUT', `/api/admin/cursos/${idCurso}/revision`, { decision: 'APROBAR' });
    const respuestas = [
      await c.como(docA, 'GET', `/api/docente/cursos/${idCurso}`),
      await c.como(docA, 'GET', '/api/docente/cursos'),
      await c.como(admin, 'GET', `/api/admin/cursos/${idCurso}`),
      await c.como(admin, 'GET', '/api/admin/solicitudes'),
      await c.como(docA, 'GET', '/api/perfil'),
      await srv.pedir(`/api/cursos/${idCurso}`),
      await srv.pedir(`/api/cursos?q=${encodeURIComponent(marca)}`),
    ];
    for (const r of respuestas) {
      assert.equal(r.status, 200);
      assert.deepEqual(sinRutasPrivadas(r.json), []);
      assert.doesNotMatch(r.texto, /contrasena|password|\.pdf"/i, r.texto.slice(0, 40));
    }
  });
});
