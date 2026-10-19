// Caracterización transversal (CAR-GEN-01..11): salud, docs, 404, errores del parser JSON y cabeceras.
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';

const { pool } = await import('../../src/shared/database/pool.js');

let srv: Servidor;

before(async () => { srv = await iniciarServidor(); });
after(async () => { await srv?.cerrar(); });

describe('rutas generales', () => {
  it('CAR-GEN-01 (ADR-011, 11.1): /api/salud responde solo { estado: "ok" }', async () => {
    const r = await srv.pedir('/api/salud');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { estado: 'ok' });
  });

  it('CAR-GEN-02: ruta inexistente -> 404 NO_ENCONTRADO', async () => {
    const a = await srv.pedir('/api/no-existe');
    assert.equal(a.status, 404);
    assert.deepEqual(a.json, { error: { codigo: 'NO_ENCONTRADO', mensaje: 'La ruta GET /api/no-existe no existe.' } });
    const b = await srv.pedir('/api/cursos/1', { metodo: 'PATCH' });
    assert.equal(b.status, 404);
    assert.equal(b.json.error.mensaje, 'La ruta PATCH /api/cursos/1 no existe.');
  });

  it('CAR-GEN-03 (ADR-011, 11.2): con la base caída /api/salud responde 503 { estado: "sin_bd" }', async () => {
    // Doble sobre pool.query (la consulta de salud pasa por ahí). Se restaura siempre y se exige que se haya llamado.
    const original = pool.query;
    let llamadas = 0;
    (pool as { query: unknown }).query = async () => {
      llamadas++;
      throw Object.assign(new Error('conexión terminada'), { code: '57P01' });
    };
    try {
      const r = await srv.pedir('/api/salud');
      assert.ok(llamadas > 0, 'el doble de la base no se llamó: la prueba no ejercitó el fallo');
      assert.equal(r.status, 503);
      assert.deepEqual(r.json, { estado: 'sin_bd' });
    } finally {
      (pool as { query: unknown }).query = original;
    }
    assert.equal((await srv.pedir('/api/salud')).status, 200, 'el pool vuelve a servir');
  });

  it('CAR-GEN-04 (ADR-011, 11.3): /api/docs y /api/docs/ no existen fuera de desarrollo', async () => {
    for (const ruta of ['/api/docs', '/api/docs/']) {
      const r = await srv.pedir(ruta);
      assert.equal(r.status, 404, ruta);
      assert.equal(r.json.error.codigo, 'NO_ENCONTRADO', ruta);
    }
  });

  it('CAR-GEN-08: rutas previstas de aprendizaje y evaluaciones', async () => {
    const rutas: Array<[string, string]> = [
      ['POST', '/api/cursos/1/inscripcion'], ['GET', '/api/mi-aprendizaje'], ['PUT', '/api/lecciones/1/progreso'],
      ['GET', '/api/evaluaciones/1'], ['POST', '/api/evaluaciones/1/intentos'], ['PUT', '/api/evaluaciones/1'],
    ];
    const vistos: unknown[] = [];
    const esperado = rutas.map(([m, r]) => [m, r, 404, 'NO_ENCONTRADO']);
    for (const [metodo, ruta] of rutas) {
      const r = await srv.pedir(ruta, { metodo });
      vistos.push([metodo, ruta, r.status, r.json?.error?.codigo]);
    }
    assert.deepEqual(vistos, esperado);
  });
});

describe('transversales sobre POST /api/auth/login', () => {
  const login = (o: { crudo?: string; headers?: Record<string, string> }) =>
    srv.pedir('/api/auth/login', { metodo: 'POST', headers: { 'content-type': 'application/json', ...(o.headers ?? {}) }, crudo: o.crudo });

  it('CAR-GEN-05 (ADR-011, 11.6): JSON mal formado -> 400 SOLICITUD_INVALIDA', async () => {
    const r = await login({ crudo: '{' });
    assert.equal(r.status, 400);
    assert.deepEqual(r.json, { error: { codigo: 'SOLICITUD_INVALIDA', mensaje: 'El cuerpo de la petición no es un JSON válido.' } });
  });

  it('CAR-GEN-06 (ADR-011, 11.6): cuerpo > 1 MB -> 413 CUERPO_DEMASIADO_GRANDE', async () => {
    const r = await login({ crudo: JSON.stringify({ correo: 'a'.repeat(1_100_000) }) });
    assert.equal(r.status, 413);
    assert.equal(r.json.error.codigo, 'CUERPO_DEMASIADO_GRANDE');
  });

  it('CAR-GEN-11 (ADR-011, 11.6): charset no admitido -> 415 TIPO_NO_ADMITIDO', async () => {
    const r = await login({ crudo: '{}', headers: { 'content-type': 'application/json; charset=latin1' } });
    assert.equal(r.status, 415);
    assert.equal(r.json.error.codigo, 'TIPO_NO_ADMITIDO');
  });

  it('CAR-GEN-07: text/plain con cuerpo JSON', async () => {
    const r = await login({ crudo: '{"correo":"a@b.co","contrasena":"x"}', headers: { 'content-type': 'text/plain' } });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    assert.equal(r.json.error.mensaje, 'Revisa los datos enviados.');
  });

  it('CAR-GEN-09: cabeceras de helmet', async () => {
    const r = await srv.pedir('/api/categorias');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.match(r.headers.get('content-security-policy') ?? '', /^default-src 'self';/);
    assert.match(r.headers.get('content-security-policy') ?? '', /script-src 'self'/);
  });

  it('CAR-GEN-10: forma de todo error', async () => {
    for (const [ruta, metodo] of [['/api/no-existe', 'GET'], ['/api/perfil', 'GET'], ['/api/cursos?limite=0', 'GET']] as const) {
      const r = await srv.pedir(ruta, { metodo });
      assert.deepEqual(Object.keys(r.json), ['error'], ruta);
      const claves = Object.keys(r.json.error);
      assert.ok(['codigo', 'mensaje'].every((k) => claves.includes(k)), ruta);
      assert.ok(claves.every((k) => ['codigo', 'mensaje', 'detalles'].includes(k)), ruta);
    }
  });
});
