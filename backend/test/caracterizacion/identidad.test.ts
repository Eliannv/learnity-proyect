// Caracterización de identidad: lo que NO cubre identidad.test.ts (CAR-IDE-02, 05..07, 09, 14, 16, 24, 26, 27, 32, 33, 37,
// 42..44, 47) más SEG-04..07 resumidos. Los límites por IP se reinician con reiniciarLimites().
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { claves, sinRutasPrivadas } from '../ayudas/contrato.js';
import { CONTRASENA_PRUEBA, crearMarca, generadorCorreos } from '../ayudas/datos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('car_ide');
const correo = generadorCorreos(`${marca}.reg`);

let f: Fixtures;
let srv: Servidor;
let fab: ReturnType<typeof fabricaCuentas>;
let reiniciar: () => void;
let cuenta: Cuenta;

const registrar = (extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  srv.pedir('/api/auth/registro', {
    metodo: 'POST', headers,
    cuerpo: { nombres: marca, apellidos: 'Prueba', correo: correo(), contrasena: CONTRASENA_PRUEBA, ...extra },
  });

/** Cookies crudas como las enviaría el navegador, y el valor CSRF decodificado para la cabecera. */
function sesionNavegador(r: { headers: Headers }) {
  const c = cookies(r);
  const rt = c['learnity_rt']!.split(';')[0]!;
  const xsrf = c['XSRF-TOKEN']!.split(';')[0]!;
  return { rt, xsrf, csrf: decodeURIComponent(xsrf.split('=')[1]!) };
}

function cookies(r: { headers: Headers }): Record<string, string> {
  return Object.fromEntries(r.headers.getSetCookie().map((c) => [c.split('=')[0]!, c]));
}

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  ({ reiniciarLimites: reiniciar } = await import('../../src/shared/http/limite-peticiones.js'));
  fab = fabricaCuentas(f, srv, marca);
  cuenta = await fab.crearCuenta(['ESTUDIANTE']);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
});

describe('registro (CAR-IDE-01, 02, 05..07, 09)', () => {
  it('CAR-IDE-01 y 02: forma de la sesión y cookies', async () => {
    const r = await registrar();
    assert.equal(r.status, 201, r.texto);
    assert.deepEqual(claves(r.json), ['accessToken', 'expiraEn', 'usuario']);
    assert.deepEqual(claves(r.json.usuario), ['idUsuario', 'idPersona', 'nombres', 'apellidos', 'correo', 'fotoUrl', 'roles']);
    assert.deepEqual(r.json.usuario.roles, ['ESTUDIANTE']);
    assert.deepEqual(sinRutasPrivadas(r.json), []);
    const c = cookies(r);
    assert.match(c['learnity_rt']!, /HttpOnly/i);
    assert.match(c['learnity_rt']!, /SameSite=Lax/i);
    assert.match(c['learnity_rt']!, /Path=\/api\/auth/);
    assert.match(c['learnity_rt']!, /Expires=/);
    assert.doesNotMatch(c['XSRF-TOKEN']!, /HttpOnly/i);
    assert.match(c['XSRF-TOKEN']!, /Path=\//);
    assert.doesNotMatch(c['learnity_rt']!, /Secure/i, 'COOKIE_SECURE es false en la configuración de pruebas');
  });

  it('CAR-IDE-05: campo ausente o extra', async () => {
    const sinNombre = await srv.pedir('/api/auth/registro', { metodo: 'POST', cuerpo: { apellidos: 'x', correo: correo(), contrasena: CONTRASENA_PRUEBA } });
    assert.equal(sinNombre.status, 400);
    assert.equal(sinNombre.json.error.codigo, 'SOLICITUD_INVALIDA');
    assert.equal(sinNombre.json.error.mensaje, 'Revisa los datos enviados.');
    assert.equal(sinNombre.json.error.detalles[0].campo, 'nombres');
    const extra = await registrar({ rol: 'ADMIN' });
    assert.equal(extra.status, 201, 'el registro no es estricto: ignora campos extra');
    assert.deepEqual(extra.json.usuario.roles, ['ESTUDIANTE'], 'un campo rol no escala privilegios');
  });

  it('CAR-IDE-06: nombres de 80 y 81 caracteres, emoji y NFD', async () => {
    assert.equal((await registrar({ nombres: marca.padEnd(80, 'x').slice(0, 80) })).status, 201);
    assert.equal((await registrar({ nombres: 'x'.repeat(81) })).status, 400);
    const emoji = await registrar({ nombres: `${marca} 😀` });
    assert.equal(emoji.status, 201);
    const nfd = await registrar({ nombres: `${marca} café` });
    assert.equal(nfd.status, 201);
    const { rows } = await f.query<{ nombres: string }>("SELECT nombres FROM persona WHERE nombres LIKE $1 || ' cafe%'", [marca]);
    assert.deepEqual(rows.map((x) => x.nombres === `${marca} caf\u00e9`), [false], 'el nombre se guarda tal cual, sin normalizar a NFC');
  });

  it('CAR-IDE-07 (ADR-011, 11.7): NUL en nombres -> 400 SOLICITUD_INVALIDA', async () => {
    const r = await registrar({ nombres: `${marca} a\u0000b` });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    assert.deepEqual(r.json.error.detalles, [{ campo: 'nombres', mensaje: 'No puede contener caracteres nulos.' }]);
  });

  it('CAR-IDE-09: el 11.º registro desde la misma IP en 60 min -> 429', async () => {
    reiniciar();
    let r;
    for (let i = 0; i < 11; i++) r = await registrar({ nombres: 'x'.repeat(81) });
    assert.equal(r!.status, 429);
    assert.equal(r!.json.error.codigo, 'DEMASIADAS_PETICIONES');
    assert.ok(Number(r!.headers.get('retry-after')) > 0);
    assert.equal(typeof r!.json.error.detalles.reintentarEnSegundos, 'number');
    reiniciar();
  });

  it('SEG-06: dos registros simultáneos con el mismo correo', async () => {
    const mismo = correo('dup');
    const [a, b] = await Promise.all([registrar({ correo: mismo }), registrar({ correo: mismo })]);
    assert.equal((a.status === 409 ? a : b).json.error.codigo, 'CONFLICTO');
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  });

  it('SEG-07: origen cruzado -> 403 ORIGEN_NO_PERMITIDO; sin Origin pasa', async () => {
    reiniciar();
    const cruzado = await registrar({}, { 'sec-fetch-site': 'cross-site' });
    assert.equal(cruzado.status, 403);
    assert.equal(cruzado.json.error.codigo, 'ORIGEN_NO_PERMITIDO');
    const ajeno = await registrar({}, { origin: 'https://malo.example' });
    assert.equal(ajeno.status, 403);
  });
});

describe('login y sesión (CAR-IDE-14, 16, 24, 26, 27)', () => {
  it('CAR-IDE-16: correo con mayúsculas y espacios', async () => {
    reiniciar();
    const r = await srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo: `  ${cuenta.correo.toUpperCase()}  `, contrasena: CONTRASENA_PRUEBA } });
    assert.equal(r.status, 200, 'el correo se normaliza (recorte y minúsculas)');
    assert.equal(r.status, 200);
  });

  it('CAR-IDE-26 y 27: logout sin cookie y con CSRF falso', async () => {
    const sin = await srv.pedir('/api/auth/logout', { metodo: 'POST' });
    assert.equal(sin.status, 204);
    assert.equal(sin.texto, '');
    const login = await srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo: cuenta.correo, contrasena: CONTRASENA_PRUEBA } });
    const rt = cookies(login)['learnity_rt']!.split(';')[0]!;
    const falso = await srv.pedir('/api/auth/logout', { metodo: 'POST', headers: { cookie: rt, 'x-xsrf-token': 'falso.falso' } });
    assert.equal(falso.status, 403);
    assert.equal(falso.json.error.codigo, 'CSRF_INVALIDO');
  });

  it('SEG-04 y CAR-IDE-22: refresh con el CSRF de otra cuenta -> 403 CSRF_INVALIDO', async () => {
    const otra = await fab.crearCuenta(['ESTUDIANTE'], { sinSesion: true });
    const a = await srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo: cuenta.correo, contrasena: CONTRASENA_PRUEBA } });
    const b = await srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo: otra.correo, contrasena: CONTRASENA_PRUEBA } });
    const sa = sesionNavegador(a);
    const sb = sesionNavegador(b);
    const ok = await srv.pedir('/api/auth/refresh', { metodo: 'POST', headers: { cookie: `${sb.rt}; ${sb.xsrf}`, 'x-xsrf-token': sb.csrf } });
    assert.equal(ok.status, 200, 'control: la sesión B con su propio CSRF refresca');
    const r = await srv.pedir('/api/auth/refresh', { metodo: 'POST', headers: { cookie: `${sa.rt}; ${sb.xsrf}`, 'x-xsrf-token': sb.csrf } });
    assert.equal(r.status, 403);
    assert.equal(r.json.error.codigo, 'CSRF_INVALIDO');
  });

  it('SEG-05: dos refresh simultáneos con la misma cookie', async () => {
    const l = await srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo: cuenta.correo, contrasena: CONTRASENA_PRUEBA } });
    const s = sesionNavegador(l);
    const pedir = () => srv.pedir('/api/auth/refresh', { metodo: 'POST', headers: { cookie: `${s.rt}; ${s.xsrf}`, 'x-xsrf-token': s.csrf } });
    const [a, b] = await Promise.all([pedir(), pedir()]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal((a.status === 409 ? a : b).json.error.codigo, 'REFRESCO_CONCURRENTE');
  });

  it('CAR-IDE-24: refresh tras aprobar la solicitud incluye DOCENTE', async () => {
    const est = await fab.crearCuenta(['ESTUDIANTE'], { sinSesion: true });
    await f.query("INSERT INTO usuario_rol (id_usuario, id_rol) SELECT $1, id_rol FROM rol WHERE nombre = 'DOCENTE'", [est.idUsuario]);
    await f.query("INSERT INTO docente (id_persona, especialidad) VALUES ($1, 'x')", [est.idPersona]);
    const l = await srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo: est.correo, contrasena: CONTRASENA_PRUEBA } });
    assert.ok(l.json.usuario.roles.includes('DOCENTE'));
  });
});

describe('recuperación y perfil (CAR-IDE-32, 33, 37, 40..44, 47)', () => {
  it('CAR-IDE-32 y 33: validación y 429 en el 6.º intento', async () => {
    reiniciar();
    assert.equal((await srv.pedir('/api/auth/recuperar', { metodo: 'POST', cuerpo: { correo: 'no-es-correo' } })).status, 400);
    assert.equal((await srv.pedir('/api/auth/recuperar', { metodo: 'POST', cuerpo: { correo: correo('ext'), extra: 1 } })).status, 202);
    reiniciar();
    let r;
    for (let i = 0; i < 6; i++) r = await srv.pedir('/api/auth/recuperar', { metodo: 'POST', cuerpo: { correo: `${correo('rec')}` } });
    assert.equal(r!.status, 429);
    assert.ok(Number(r!.headers.get('retry-after')) > 0);
    reiniciar();
  });

  it('CAR-IDE-37: token inventado con contraseña débil', async () => {
    const r = await srv.pedir('/api/auth/restablecer', { metodo: 'POST', cuerpo: { token: 'inventado', contrasena: 'corta' } });
    assert.equal(r.status, 400);
    assert.deepEqual(r.json.error.detalles, [{ campo: 'contrasena', mensaje: 'La contraseña debe tener al menos 15 caracteres' }]);
  });

  it('CAR-IDE-40, 41, 42, 43: perfil', async () => {
    const t = cuenta.token;
    const get = await srv.pedir('/api/perfil', { token: t });
    assert.equal(get.status, 200);
    assert.deepEqual(claves(get.json), ['idUsuario', 'idPersona', 'correo', 'nombres', 'apellidos', 'ciudad', 'biografia', 'fotoUrl', 'creadoEn', 'roles']);
    assert.deepEqual(sinRutasPrivadas(get.json), []);
    const put = (cuerpo: unknown) => srv.pedir('/api/perfil', { token: t, metodo: 'PUT', cuerpo });
    const base = { nombres: marca, apellidos: 'Prueba' };
    assert.equal((await put({ ...base, ciudad: 'c'.repeat(60), biografia: 'b'.repeat(300) })).status, 200);
    assert.equal((await put({ ...base, ciudad: 'c'.repeat(61) })).status, 400);
    assert.equal((await put({ ...base, biografia: 'b'.repeat(301) })).status, 400);
    assert.equal((await put({ ...base, ciudad: null, biografia: null })).status, 200);
    assert.equal((await put({ nombres: 'x'.repeat(81), apellidos: 'y' })).status, 400);
    assert.equal((await put({ ...base, extra: 1 })).status, 200, 'el perfil ignora campos extra');
    const xss = await put({ ...base, biografia: '<img src=x onerror=alert(1)>' });
    assert.equal(xss.status, 200);
    assert.equal((await srv.pedir('/api/perfil', { token: t })).json.biografia, '<img src=x onerror=alert(1)>');
    assert.match(xss.headers.get('content-type') ?? '', /application\/json; charset=utf-8/);
  });

  it('CAR-IDE-47: el 11.º cambio de contraseña en 15 min -> 429', async () => {
    reiniciar();
    let r;
    for (let i = 0; i < 11; i++) r = await srv.pedir('/api/perfil/contrasena', { token: cuenta.token, metodo: 'PUT', cuerpo: { actual: 'mal', nueva: 'corta' } });
    assert.equal(r!.status, 429);
    reiniciar();
  });
});
