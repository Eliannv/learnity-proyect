// Auditoría de seguridad (noviembre 2026): controles añadidos al endurecer la API.
//  - Ninguna escritura se acepta desde otro sitio (Origin / Sec-Fetch-Site), no solo las de /api/auth.
//  - Las respuestas de la API llevan una CSP que no permite cargar nada ni incrustarlas en marcos.
//  - En producción el servidor no arranca con una configuración insegura (fail-fast de env.ts).
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { crearMarca } from '../ayudas/datos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('seg_end');
const ORIGEN_PERMITIDO = (process.env['CORS_ORIGIN'] ?? 'http://localhost:4200').split(',')[0]!.trim();
let f: Fixtures;
let srv: Servidor;
let ana: Cuenta;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  ana = await fabricaCuentas(f, srv, marca).crearCuenta(['ESTUDIANTE']);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
});

describe('Auditoría · origen de las escrituras', () => {
  const cambiarPerfil = (headers: Record<string, string>) =>
    srv.pedir('/api/perfil', { metodo: 'PUT', token: ana.token, cuerpo: { nombres: marca, apellidos: 'Origen' }, headers });

  it('rechaza con 403 ORIGEN_NO_PERMITIDO una escritura privada desde otro origen o marcada cross-site', async () => {
    const intentos: Record<string, string>[] = [{ origin: 'https://atacante.example' }, { 'sec-fetch-site': 'cross-site' }];
    for (const headers of intentos) {
      const r = await cambiarPerfil(headers);
      assert.equal(r.status, 403, JSON.stringify(headers));
      assert.equal(r.json.error.codigo, 'ORIGEN_NO_PERMITIDO');
    }
    const foto = await srv.pedir('/api/perfil/foto', {
      metodo: 'PUT', token: ana.token, cuerpo: { fotoUrl: 'https://ejemplo.com/a.jpg' }, headers: { origin: 'https://atacante.example' },
    });
    assert.equal(foto.status, 403);
  });

  it('acepta la escritura desde el origen permitido o sin Origin, y no bloquea las lecturas', async () => {
    assert.equal((await cambiarPerfil({ origin: ORIGEN_PERMITIDO, 'sec-fetch-site': 'same-origin' })).status, 200);
    assert.equal((await cambiarPerfil({})).status, 200);
    assert.equal((await srv.pedir('/api/categorias', { headers: { origin: 'https://atacante.example' } })).status, 200);
  });
});

describe('Auditoría · cabeceras de la API', () => {
  it('CSP default-src none, sin marcos y nosniff en cualquier respuesta', async () => {
    const r = await srv.pedir('/api/categorias');
    const csp = r.headers.get('content-security-policy') ?? '';
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-powered-by'), null);
  });
});

describe('Auditoría · fail-fast de la configuración en producción', () => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const tsx = path.join(raiz, 'node_modules', '.bin', 'tsx');
  const modulo = path.join(raiz, 'src', 'shared', 'config', 'env.ts');
  const base = {
    NODE_ENV: 'production', DB_HOST: 'db.ejemplo', DB_NAME: 'learnity', DB_USER: 'learnity_app', DB_PASSWORD: 'x',
    DB_SSL: 'true', CORS_ORIGIN: 'https://learnity.ejemplo', FRONTEND_URL: 'https://learnity.ejemplo',
    JWT_SECRET: 'Qm9Zk3vR8tL1xW6pN2cJ5hA0sD7fG4yU9eI3oT8rB1n', CORREO_TRANSPORTE: 'gmail',
    GMAIL_CLIENT_ID: 'id', GMAIL_CLIENT_SECRET: 's', GMAIL_REFRESH_TOKEN: 't', GMAIL_REMITENTE: 'r@ejemplo.com',
  };

  /** Carga env.ts en un proceso aparte, desde una carpeta vacía (sin .env) y solo con estas variables. */
  function arrancar(extra: Record<string, string | undefined>) {
    const vacia = mkdtempSync(path.join(os.tmpdir(), 'learnity-env-'));
    try {
      const entorno = Object.fromEntries(Object.entries({ ...base, ...extra }).filter(([, v]) => v !== undefined)) as Record<string, string>;
      return spawnSync(tsx, ['-e', `import(${JSON.stringify(modulo)})`], {
        cwd: vacia, env: { PATH: process.env['PATH'] ?? '', ...entorno }, encoding: 'utf8',
      });
    } finally {
      rmSync(vacia, { recursive: true, force: true });
    }
  }

  it('TLS hacia PostgreSQL: verifica el certificado salvo que se desactive explícitamente', () => {
    const pool = path.join(raiz, 'src', 'shared', 'database', 'pool.ts');
    const tls = (extra: Record<string, string>) => {
      const vacia = mkdtempSync(path.join(os.tmpdir(), 'learnity-tls-'));
      try {
        const r = spawnSync(tsx, ['-e', `import(${JSON.stringify(pool)}).then(({ pool }) => { console.log(JSON.stringify(pool.options.ssl)); return pool.end(); })`], {
          cwd: vacia, env: { PATH: process.env['PATH'] ?? '', ...base, ...extra }, encoding: 'utf8',
        });
        assert.equal(r.status, 0, r.stderr);
        return JSON.parse(r.stdout.trim().split('\n').pop()!) as { rejectUnauthorized?: boolean; ca?: string };
      } finally {
        rmSync(vacia, { recursive: true, force: true });
      }
    };
    assert.equal(tls({}).rejectUnauthorized, true);
    const conCa = tls({ DB_SSL_CA: '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----' });
    assert.equal(conCa.rejectUnauthorized, true);
    assert.equal(conCa.ca, '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----', 'los \\n escritos se convierten en saltos de línea');
    assert.equal(tls({ DB_SSL_SIN_VERIFICAR: 'true' }).rejectUnauthorized, false);
  });

  it('arranca con una configuración de producción correcta', () => {
    const r = arrancar({});
    assert.equal(r.status, 0, r.stderr);
  });

  for (const [caso, extra, variable] of [
    ['sin TLS hacia PostgreSQL', { DB_SSL: 'false' }, 'DB_SSL'],
    ['CORS con comodín', { CORS_ORIGIN: '*' }, 'CORS_ORIGIN'],
    ['CORS por http', { CORS_ORIGIN: 'http://learnity.ejemplo' }, 'CORS_ORIGIN'],
    ['FRONTEND_URL por http', { FRONTEND_URL: 'http://learnity.ejemplo' }, 'FRONTEND_URL'],
    ['JWT_SECRET de ejemplo', { JWT_SECRET: 'cambia-esta-cadena-por-una-larga-y-aleatoria-de-32+' }, 'JWT_SECRET'],
    ['JWT_SECRET corto', { JWT_SECRET: 'corto' }, 'JWT_SECRET'],
    ['JWT_SECRET de poca variedad', { JWT_SECRET: 'abababababababababababababababab' }, 'JWT_SECRET'],
    ['cookies sin Secure', { COOKIE_SECURE: 'false' }, 'COOKIE_SECURE'],
  ] as const) {
    it(`no arranca: ${caso}`, () => {
      const r = arrancar(extra);
      assert.equal(r.status, 1, `${caso}: ${r.stderr}`);
      assert.match(r.stderr, new RegExp(`"variable":"${variable}"`));
      assert.doesNotMatch(r.stderr, /Qm9Zk3vR8tL1xW6pN2cJ5hA0sD7fG4yU9eI3oT8rB1n/, 'nunca imprime el secreto');
    });
  }
});
