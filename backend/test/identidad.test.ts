// Pruebas de integración del módulo Identidad contra PostgreSQL real (Sprint 1).
// Ejecutar con:  npm test   (lee .env.test; ver .env.test.example)
// Solo crea y borra cuentas del dominio @pruebas.test, pero por seguridad exige NODE_ENV=test.
import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

if (process.env['NODE_ENV'] !== 'test') {
  throw new Error('Las pruebas exigen NODE_ENV=test (usa npm test, que lee .env.test).');
}
const BUZON = await mkdtemp(path.join(os.tmpdir(), 'learnity-buzon-'));
process.env['BUZON_DIR'] = BUZON;
process.env['CORREO_TRANSPORTE'] = 'buzon';
process.env['LOG_EN_PRUEBAS'] = 'true';

// Captura de los logs para comprobar que nunca contienen secretos.
const logs: string[] = [];
for (const metodo of ['log', 'error', 'warn'] as const) {
  const original = console[metodo].bind(console);
  console[metodo] = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
    if (process.env['VER_LOGS'] === 'true') original(...args);
  };
}

const express = (await import('express')).default;
const { crearApp } = await import('../src/app.js');
const { pool } = await import('../src/shared/database/pool.js');
const { autenticar, autorizar } = await import('../src/shared/auth/middlewares.js');
const { manejadorErrores } = await import('../src/shared/http/manejador-errores.js');
const { reiniciarLimites } = await import('../src/shared/http/limite-peticiones.js');
const { identidadService } = await import('../src/modules/identidad/identidad.service.js');

const ORIGEN = 'http://localhost:4200';
const DOMINIO = '@pruebas.test';
const CLAVE = 'una frase larga para entrar 2026';
const CLAVE_NUEVA = 'otra frase distinta y bastante larga';
const secretosUsados = new Set<string>([CLAVE, CLAVE_NUEVA]);

let base = '';
let servidor: ReturnType<ReturnType<typeof express>['listen']>;

interface Respuesta {
  status: number;
  json: any;
  headers: Headers;
  setCookies: string[];
}

/** Cliente HTTP con su propio "navegador": guarda cookies y el access token en memoria. */
class Navegador {
  readonly cookies = new Map<string, string>();
  access: string | null = null;

  async pedir(
    metodo: string,
    ruta: string,
    op: { cuerpo?: unknown; token?: string | null; csrf?: boolean | string; origen?: string | null } = {},
  ): Promise<Respuesta> {
    const h: Record<string, string> = {};
    const origen = op.origen === undefined ? ORIGEN : op.origen;
    if (origen) h['origin'] = origen;
    if (op.cuerpo !== undefined) h['content-type'] = 'application/json';
    const token = op.token === undefined ? this.access : op.token;
    if (token) h['authorization'] = `Bearer ${token}`;
    if (this.cookies.size) h['cookie'] = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const csrf = op.csrf ?? true;
    if (typeof csrf === 'string') h['x-xsrf-token'] = csrf;
    else if (csrf && this.cookies.has('XSRF-TOKEN')) h['x-xsrf-token'] = this.cookies.get('XSRF-TOKEN')!;

    const res = await fetch(base + ruta, {
      method: metodo,
      headers: h,
      body: op.cuerpo === undefined ? undefined : JSON.stringify(op.cuerpo),
    });
    const setCookies = res.headers.getSetCookie();
    for (const c of setCookies) {
      const [par = ''] = c.split(';');
      const i = par.indexOf('=');
      const [k, v] = [par.slice(0, i), par.slice(i + 1)];
      if (!v || /Expires=Thu, 01 Jan 1970/i.test(c)) this.cookies.delete(k);
      else {
        this.cookies.set(k, v);
        secretosUsados.add(decodeURIComponent(v));
      }
    }
    const texto = await res.text();
    const json = texto ? JSON.parse(texto) : null;
    if (json?.accessToken) {
      this.access = json.accessToken;
      secretosUsados.add(json.accessToken);
    }
    return { status: res.status, json, headers: res.headers, setCookies };
  }

  registrar(correo: string, contrasena = CLAVE, nombres = 'Prueba', apellidos = 'Automática') {
    return this.pedir('POST', '/api/auth/registro', { cuerpo: { nombres, apellidos, correo, contrasena } });
  }
  login(correo: string, contrasena = CLAVE) {
    return this.pedir('POST', '/api/auth/login', { cuerpo: { correo, contrasena } });
  }
  refresh(op: { csrf?: boolean | string; origen?: string | null } = {}) {
    return this.pedir('POST', '/api/auth/refresh', { token: null, ...op });
  }
}

let correlativo = 0;
const correoNuevo = (prefijo: string) => `${prefijo}.${Date.now()}.${++correlativo}${DOMINIO}`;

async function limpiarCuentasDePrueba() {
  await pool.query(`DELETE FROM usuario_rol WHERE id_usuario IN (SELECT id_usuario FROM usuario WHERE correo LIKE '%' || $1)`, [DOMINIO]);
  await pool.query(
    `WITH u AS (DELETE FROM usuario WHERE correo LIKE '%' || $1 RETURNING id_persona)
     DELETE FROM persona WHERE id_persona IN (SELECT id_persona FROM u)`,
    [DOMINIO],
  );
}

async function correosPara(correo: string): Promise<{ asunto: string; texto: string; html: string }[]> {
  await identidadService.esperarTareas();
  const archivos = (await readdir(BUZON)).sort();
  const mensajes = await Promise.all(archivos.map(async (a) => JSON.parse(await readFile(path.join(BUZON, a), 'utf8'))));
  return mensajes.filter((m) => m.para === correo);
}

function tokenDelEnlace(texto: string): string {
  const m = texto.match(/\/restablecer-contrasena#token=([A-Za-z0-9_-]{43})/);
  assert.ok(m, 'el correo trae el enlace con el token en el fragmento');
  secretosUsados.add(m[1]!);
  return m[1]!;
}

const fila = async (sql: string, params: unknown[]) => (await pool.query(sql, params)).rows[0];

before(async () => {
  await limpiarCuentasDePrueba();
  const app = crearApp();
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

beforeEach(() => reiniciarLimites());

after(async () => {
  await identidadService.esperarTareas();
  await limpiarCuentasDePrueba();
  await new Promise((r) => servidor.close(r));
  await pool.end();
  await rm(BUZON, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Registro (RF-01)', () => {
  it('crea la cuenta como Estudiante en una transacción y abre sesión con cookies seguras', async () => {
    const nav = new Navegador();
    const correo = correoNuevo('registro');
    const r = await nav.registrar(correo);
    assert.equal(r.status, 201);
    assert.deepEqual(r.json.usuario.roles, ['ESTUDIANTE']);
    assert.ok(r.json.accessToken && !('refreshToken' in r.json) && !('token' in r.json));
    const rt = r.setCookies.find((c) => c.startsWith('learnity_rt='))!;
    assert.match(rt, /HttpOnly/i);
    assert.match(rt, /SameSite=Lax/i);
    assert.match(rt, /Path=\/api\/auth/i);
    const xsrf = r.setCookies.find((c) => c.startsWith('XSRF-TOKEN='))!;
    assert.doesNotMatch(xsrf, /HttpOnly/i);
    assert.equal(r.headers.get('cache-control'), 'no-store');

    const bd = await fila('SELECT contrasena_hash FROM usuario WHERE correo = $1', [correo]);
    assert.match(bd.contrasena_hash, /^\$2b\$12\$/, 'bcrypt con costo 12');
    const sesion = await fila('SELECT token_hash FROM sesion s JOIN usuario u USING (id_usuario) WHERE u.correo = $1', [correo]);
    assert.notEqual(sesion.token_hash, nav.cookies.get('learnity_rt'), 'la base guarda solo el hash del refresh token');
  });

  it('rechaza un correo ya registrado (409) aunque cambien mayúsculas', async () => {
    const correo = correoNuevo('duplicado');
    assert.equal((await new Navegador().registrar(correo)).status, 201);
    const r = await new Navegador().registrar(correo.toUpperCase());
    assert.equal(r.status, 409);
  });

  it('aplica la política de contraseña: largo, 72 bytes, comunes, datos propios', async () => {
    const casos: [string, RegExp][] = [
      ['corta 2026', /al menos 15/],
      ['ñ'.repeat(40), /72 bytes/],
      ['aaaaaaaaaaaaaaaaaaa', /común o repetitiva/],
      ['passwordpassword', /común o repetitiva/],
    ];
    for (const [contrasena, esperado] of casos) {
      const r = await new Navegador().registrar(correoNuevo('politica'), contrasena);
      assert.equal(r.status, 400, contrasena);
      assert.match(JSON.stringify(r.json.error), esperado);
    }
    const correo = correoNuevo('mariagarcia');
    const r = await new Navegador().registrar(correo, `${correo.split('@')[0]}2026`, 'María', 'García');
    assert.equal(r.status, 400);
    assert.match(r.json.error.mensaje, /tu nombre, tu correo/);
  });

  it('rechaza contraseñas expuestas en filtraciones (Have I Been Pwned, k-anonimato)', async (t) => {
    const disponible = await fetch('https://api.pwnedpasswords.com/range/21BD1', { signal: AbortSignal.timeout(4000) })
      .then((r) => r.ok)
      .catch(() => false);
    if (!disponible) return t.skip('sin acceso a api.pwnedpasswords.com');
    const r = await new Navegador().registrar(correoNuevo('pwned'), 'correcthorsebatterystaple');
    assert.equal(r.status, 400);
    assert.match(r.json.error.mensaje, /filtraciones/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Inicio de sesión y bloqueo (RF-02)', () => {
  it('entra con credenciales correctas', async () => {
    const correo = correoNuevo('login');
    await new Navegador().registrar(correo);
    const r = await new Navegador().login(correo);
    assert.equal(r.status, 200);
    assert.equal(r.json.usuario.correo, correo);
  });

  it('responde lo mismo para correo inexistente y contraseña errónea', async () => {
    const correo = correoNuevo('generico');
    await new Navegador().registrar(correo);
    const a = await new Navegador().login(correo, 'contraseña equivocada larga');
    const b = await new Navegador().login(correoNuevo('noexiste'), 'contraseña equivocada larga');
    assert.equal(a.status, 401);
    assert.deepEqual(a.json, b.json);
  });

  it('bloquea la cuenta 15 minutos tras 5 fallos, con el mismo mensaje genérico', async () => {
    const correo = correoNuevo('bloqueo');
    await new Navegador().registrar(correo);
    for (let i = 0; i < 5; i++) assert.equal((await new Navegador().login(correo, `incorrecta número ${i} larga`)).status, 401);
    const conBloqueo = await new Navegador().login(correo); // contraseña correcta
    assert.equal(conBloqueo.status, 401);
    assert.equal(conBloqueo.json.error.mensaje, 'Correo o contraseña incorrectos.');
    const bd = await fila('SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE correo = $1', [correo]);
    assert.equal(bd.intentos_fallidos, 5);
    const minutos = (new Date(bd.bloqueado_hasta).getTime() - Date.now()) / 60_000;
    assert.ok(minutos > 14 && minutos <= 15, `bloqueo de ~15 min (${minutos.toFixed(1)})`);

    // Vencido el bloqueo, entra y los contadores vuelven a cero.
    await pool.query(`UPDATE usuario SET bloqueado_hasta = now() - INTERVAL '1 second' WHERE correo = $1`, [correo]);
    assert.equal((await new Navegador().login(correo)).status, 200);
    const despues = await fila('SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE correo = $1', [correo]);
    assert.equal(despues.intentos_fallidos, 0);
    assert.equal(despues.bloqueado_hasta, null);
  });

  it('una cuenta desactivada no entra (403 solo con la contraseña correcta)', async () => {
    const correo = correoNuevo('inactiva');
    await new Navegador().registrar(correo);
    await pool.query(`UPDATE usuario SET estado = 'INACTIVO' WHERE correo = $1`, [correo]);
    assert.equal((await new Navegador().login(correo, 'contraseña equivocada larga')).status, 401);
    const r = await new Navegador().login(correo);
    assert.equal(r.status, 403);
    assert.equal(r.json.error.codigo, 'CUENTA_INACTIVA');
  });

  it('limita los intentos por IP (429 con Retry-After)', async () => {
    let ultima: Respuesta | undefined;
    for (let i = 0; i < 21; i++) ultima = await new Navegador().login(correoNuevo('ip'), 'contraseña cualquiera larga');
    assert.equal(ultima!.status, 429);
    assert.ok(Number(ultima!.headers.get('retry-after')) > 0);
  });

  it('valida la entrada (400) y rechaza otros orígenes (403)', async () => {
    assert.equal((await new Navegador().pedir('POST', '/api/auth/login', { cuerpo: { correo: 'no-es-correo' } })).status, 400);
    const r = await new Navegador().pedir('POST', '/api/auth/login', {
      cuerpo: { correo: correoNuevo('x'), contrasena: 'x' },
      origen: 'https://sitio-malicioso.example',
    });
    assert.equal(r.status, 403);
    assert.equal(r.json.error.codigo, 'ORIGEN_NO_PERMITIDO');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Perfil (RF-04) y permisos', () => {
  it('exige sesión: sin token o con token alterado responde 401', async () => {
    assert.equal((await new Navegador().pedir('GET', '/api/perfil')).status, 401);
    assert.equal((await new Navegador().pedir('GET', '/api/perfil', { token: 'abc.def.ghi' })).status, 401);
  });

  it('muestra y actualiza el perfil sin exponer el hash', async () => {
    const nav = new Navegador();
    const correo = correoNuevo('perfil');
    await nav.registrar(correo);
    const ver = await nav.pedir('GET', '/api/perfil');
    assert.equal(ver.status, 200);
    assert.equal(ver.json.correo, correo);
    assert.ok(!('contrasenaHash' in ver.json));
    const editar = await nav.pedir('PUT', '/api/perfil', {
      cuerpo: { nombres: 'Rosa', apellidos: 'Vera', ciudad: 'Machala', biografia: 'Estudio programación.' },
    });
    assert.equal(editar.status, 200);
    assert.equal(editar.json.ciudad, 'Machala');
    assert.equal((await nav.pedir('PUT', '/api/perfil', { cuerpo: { nombres: '' } })).status, 400);
  });

  it('autoriza por rol: Estudiante recibe 403 en una ruta de Administrador; Administrador pasa', async () => {
    const appRol = express();
    appRol.get('/solo-admin', autenticar, autorizar('ADMIN'), (_req, res) => {
      res.json({ ok: true });
    });
    appRol.use(manejadorErrores);
    const srv = appRol.listen(0);
    await new Promise((r) => srv.once('listening', r));
    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/solo-admin`;
    try {
      const nav = new Navegador();
      const correo = correoNuevo('rol');
      await nav.registrar(correo);
      const comoEstudiante = await fetch(url, { headers: { authorization: `Bearer ${nav.access}` } });
      assert.equal(comoEstudiante.status, 403);

      await pool.query(
        `INSERT INTO usuario_rol (id_usuario, id_rol)
         SELECT u.id_usuario, r.id_rol FROM usuario u, rol r WHERE u.correo = $1 AND r.nombre = 'ADMIN'`,
        [correo],
      );
      // El rol nuevo llega al renovar la sesión, sin volver a escribir la contraseña.
      const renovada = await nav.refresh();
      assert.deepEqual(renovada.json.usuario.roles, ['ESTUDIANTE', 'ADMIN']);
      const comoAdmin = await fetch(url, { headers: { authorization: `Bearer ${nav.access}` } });
      assert.equal(comoAdmin.status, 200);
    } finally {
      await new Promise((r) => srv.close(r));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Refresh rotatorio, CSRF y cierre de sesión', () => {
  it('sin cookie no hay sesión (401); sin token CSRF o con uno falso se rechaza (403)', async () => {
    assert.equal((await new Navegador().refresh()).status, 401);
    const nav = new Navegador();
    await nav.registrar(correoNuevo('csrf'));
    assert.equal((await nav.refresh({ csrf: false })).json.error.codigo, 'CSRF_INVALIDO');
    assert.equal((await nav.refresh({ csrf: 'nonce.firmafalsa' })).status, 403);
    assert.equal((await nav.refresh({ origen: 'https://otro.example' })).status, 403);
  });

  it('rota el refresh token y detecta la reutilización de uno viejo revocando la sesión', async () => {
    const nav = new Navegador();
    await nav.registrar(correoNuevo('rotacion'));
    const viejo = { rt: nav.cookies.get('learnity_rt')!, xsrf: nav.cookies.get('XSRF-TOKEN')! };

    const r1 = await nav.refresh();
    assert.equal(r1.status, 200);
    assert.notEqual(nav.cookies.get('learnity_rt'), viejo.rt, 'el refresh token cambia en cada uso');
    assert.equal((await nav.pedir('GET', '/api/perfil')).status, 200);

    // Otra pestaña con el token anterior, dentro del margen: 409 y no se cierra nada.
    const pestana = new Navegador();
    pestana.cookies.set('learnity_rt', viejo.rt);
    pestana.cookies.set('XSRF-TOKEN', viejo.xsrf);
    assert.equal((await pestana.refresh()).status, 409);
    assert.equal((await nav.pedir('GET', '/api/perfil')).status, 200);

    // Fuera del margen: es un token robado. Se revoca toda la familia.
    await pool.query(`UPDATE sesion SET reemplazado_en = now() - INTERVAL '1 minute' WHERE reemplazado_en IS NOT NULL AND token_hash = encode(sha256($1::bytea), 'hex')`, [viejo.rt]);
    const robo = await pestana.refresh();
    assert.equal(robo.status, 401);
    assert.equal((await nav.refresh()).status, 401, 'el token legítimo también queda revocado');
    assert.equal((await nav.pedir('GET', '/api/perfil')).status, 401, 'y el access token deja de valer');
  });

  it('cerrar sesión revoca el refresh y el access token, y borra las cookies', async () => {
    const nav = new Navegador();
    await nav.registrar(correoNuevo('logout'));
    const rt = nav.cookies.get('learnity_rt')!;
    const xsrf = nav.cookies.get('XSRF-TOKEN')!;
    assert.equal((await nav.pedir('POST', '/api/auth/logout', { csrf: false })).status, 403, 'logout también exige CSRF');
    const r = await nav.pedir('POST', '/api/auth/logout');
    assert.equal(r.status, 204);
    assert.ok(!nav.cookies.has('learnity_rt') && !nav.cookies.has('XSRF-TOKEN'));
    assert.equal((await nav.pedir('GET', '/api/perfil')).status, 401);
    const copia = new Navegador();
    copia.cookies.set('learnity_rt', rt);
    copia.cookies.set('XSRF-TOKEN', xsrf);
    assert.equal((await copia.refresh()).status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Cambio de contraseña (RF-04)', () => {
  it('exige la actual, aplica la política y cierra las demás sesiones', async () => {
    const correo = correoNuevo('cambio');
    const actual = new Navegador();
    await actual.registrar(correo);
    const otroEquipo = new Navegador();
    await otroEquipo.login(correo);

    const mal = await actual.pedir('PUT', '/api/perfil/contrasena', { cuerpo: { actual: 'no es la contraseña', nueva: CLAVE_NUEVA } });
    assert.equal(mal.status, 400);
    assert.equal(mal.json.error.detalles[0].campo, 'actual');
    assert.equal((await actual.pedir('PUT', '/api/perfil/contrasena', { cuerpo: { actual: CLAVE, nueva: CLAVE } })).status, 400);
    assert.equal((await actual.pedir('PUT', '/api/perfil/contrasena', { cuerpo: { actual: CLAVE, nueva: 'corta' } })).status, 400);

    const ok = await actual.pedir('PUT', '/api/perfil/contrasena', { cuerpo: { actual: CLAVE, nueva: CLAVE_NUEVA } });
    assert.equal(ok.status, 200);
    assert.equal((await actual.pedir('GET', '/api/perfil')).status, 200, 'la sesión actual sigue');
    assert.equal((await otroEquipo.pedir('GET', '/api/perfil')).status, 401, 'la otra sesión se cerró');
    assert.equal((await otroEquipo.refresh()).status, 401);
    assert.equal((await new Navegador().login(correo, CLAVE)).status, 401);
    assert.equal((await new Navegador().login(correo, CLAVE_NUEVA)).status, 200);
    const avisos = await correosPara(correo);
    assert.ok(avisos.some((m) => m.asunto === 'Tu contraseña de Learnity cambió'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Recuperación de contraseña por correo (RF-06)', () => {
  it('responde igual para correos existentes e inexistentes; solo envía a la cuenta real', async () => {
    const correo = correoNuevo('recuperar');
    await new Navegador().registrar(correo);
    const inexistente = correoNuevo('fantasma');
    const a = await new Navegador().pedir('POST', '/api/auth/recuperar', { cuerpo: { correo } });
    const b = await new Navegador().pedir('POST', '/api/auth/recuperar', { cuerpo: { correo: inexistente } });
    assert.equal(a.status, 202);
    assert.deepEqual(a.json, b.json);
    assert.equal((await correosPara(correo)).length, 1);
    assert.equal((await correosPara(inexistente)).length, 0);
  });

  it('enlace de un solo uso: cambia la contraseña, invalida sesiones anteriores y no se puede reutilizar', async () => {
    const correo = correoNuevo('restablecer');
    const sesionVieja = new Navegador();
    await sesionVieja.registrar(correo);
    await new Navegador().pedir('POST', '/api/auth/recuperar', { cuerpo: { correo } });
    const [mensaje] = await correosPara(correo);
    assert.ok(mensaje);
    assert.ok(!mensaje.texto.includes(CLAVE), 'el correo nunca lleva la contraseña');
    const token = tokenDelEnlace(mensaje.texto);

    const bd = await fila(
      `SELECT t.token_hash, extract(epoch FROM t.expira_en - t.creado_en) / 60 AS minutos
         FROM token_recuperacion t JOIN usuario u USING (id_usuario) WHERE u.correo = $1`,
      [correo],
    );
    assert.notEqual(bd.token_hash, token, 'la base guarda solo el hash');
    assert.ok(Number(bd.minutos) >= 15 && Number(bd.minutos) <= 30);

    const debil = await new Navegador().pedir('POST', '/api/auth/restablecer', { cuerpo: { token, contrasena: 'corta' } });
    assert.equal(debil.status, 400);

    const ok = await new Navegador().pedir('POST', '/api/auth/restablecer', { cuerpo: { token, contrasena: CLAVE_NUEVA } });
    assert.equal(ok.status, 200);
    assert.equal((await sesionVieja.pedir('GET', '/api/perfil')).status, 401, 'access token anterior revocado');
    assert.equal((await sesionVieja.refresh()).status, 401, 'refresh token anterior revocado');

    const otraVez = await new Navegador().pedir('POST', '/api/auth/restablecer', { cuerpo: { token, contrasena: 'una tercera frase muy larga' } });
    assert.equal(otraVez.status, 400, 'el enlace no se puede reutilizar');
    assert.equal((await new Navegador().login(correo, CLAVE_NUEVA)).status, 200);
  });

  it('rechaza enlaces vencidos, inventados y los anteriores a uno nuevo; limita los envíos por hora', async () => {
    const correo = correoNuevo('vencido');
    await new Navegador().registrar(correo);
    const pedir = () => new Navegador().pedir('POST', '/api/auth/recuperar', { cuerpo: { correo } });
    await pedir();
    const primero = tokenDelEnlace((await correosPara(correo))[0]!.texto);
    await pedir();
    const segundo = tokenDelEnlace((await correosPara(correo))[1]!.texto);
    const restablecer = (token: string) =>
      new Navegador().pedir('POST', '/api/auth/restablecer', { cuerpo: { token, contrasena: CLAVE_NUEVA } });

    assert.equal((await restablecer(primero)).status, 400, 'el primer enlace quedó invalidado por el segundo');
    await pool.query(
      `UPDATE token_recuperacion SET creado_en = now() - INTERVAL '40 minutes', expira_en = now() - INTERVAL '20 minutes'
        WHERE token_hash = encode(sha256($1::bytea), 'hex')`,
      [segundo],
    );
    assert.equal((await restablecer(segundo)).status, 400, 'vencido');
    assert.equal((await restablecer('x'.repeat(43))).status, 400, 'inventado');

    await pedir(); // 3.º de la hora
    await pedir(); // 4.º: ya no se envía
    assert.equal((await correosPara(correo)).length, 3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Cierre del Sprint 1', () => {
  it('ninguna ruta de Identidad responde 501', async () => {
    const nav = new Navegador();
    await nav.registrar(correoNuevo('sin501'));
    const rutas: [string, string, unknown?][] = [
      ['POST', '/api/auth/registro', {}],
      ['POST', '/api/auth/login', {}],
      ['POST', '/api/auth/refresh'],
      ['POST', '/api/auth/recuperar', {}],
      ['POST', '/api/auth/restablecer', {}],
      ['GET', '/api/perfil'],
      ['PUT', '/api/perfil', {}],
      ['PUT', '/api/perfil/contrasena', {}],
      ['POST', '/api/auth/logout'],
    ];
    for (const [metodo, ruta, cuerpo] of rutas) {
      const r = await nav.pedir(metodo, ruta, { cuerpo });
      assert.notEqual(r.status, 501, `${metodo} ${ruta}`);
      assert.ok(r.status < 500, `${metodo} ${ruta} → ${r.status}`);
    }
  });

  it('los logs registran eventos de seguridad sin contraseñas, tokens ni cookies', async () => {
    await identidadService.esperarTareas();
    const texto = logs.join('\n');
    assert.match(texto, /"evento":"login_fallido"/);
    assert.match(texto, /"evento":"cuenta_bloqueada"/);
    assert.match(texto, /"evento":"refresh_reutilizado"/);
    for (const secreto of secretosUsados) {
      assert.ok(!texto.includes(secreto), `un log contiene un secreto (${secreto.slice(0, 6)}…)`);
    }
    assert.doesNotMatch(texto, /\$2b\$12\$/, 'ningún hash bcrypt en los logs');
  });
});
