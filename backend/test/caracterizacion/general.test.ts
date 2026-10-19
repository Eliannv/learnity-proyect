// Caracterización transversal (CAR-GEN-01..11): salud, docs, 404, errores del parser JSON y cabeceras.
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { capturar } from '../ayudas/captura.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';

let srv: Servidor;

before(async () => { srv = await iniciarServidor(); });
after(async () => { await srv?.cerrar(); });

describe('rutas generales', () => {
  it('CAR-GEN-01 CONGELADO-INSEGURO (S4, ADR-011 11.1): /api/salud expone base, usuario y roles', async () => {
    const r = await srv.pedir('/api/salud');
    assert.equal(r.status, 200);
    assert.equal(r.json.estado, 'ok');
    assert.deepEqual(Object.keys(r.json.baseDeDatos), ['base', 'usuario', 'roles']);
    assert.match(r.json.baseDeDatos.base, /_test$/);
  });

  it('CAR-GEN-02: ruta inexistente -> 404 NO_ENCONTRADO', async () => {
    const a = await srv.pedir('/api/no-existe');
    assert.equal(a.status, 404);
    assert.deepEqual(a.json, { error: { codigo: 'NO_ENCONTRADO', mensaje: 'La ruta GET /api/no-existe no existe.' } });
    const b = await srv.pedir('/api/cursos/1', { metodo: 'PATCH' });
    assert.equal(b.status, 404);
    assert.equal(b.json.error.mensaje, 'La ruta PATCH /api/cursos/1 no existe.');
  });

  it('CAR-GEN-04 CONGELADO-INSEGURO (S4, ADR-011 11.3): /api/docs es público', async () => {
    const a = await srv.pedir('/api/docs');
    const b = await srv.pedir('/api/docs/');
    capturar('CAR-GEN-04', { sinBarra: a.status, location: a.headers.get('location'), conBarra: b.status, tipo: b.headers.get('content-type') });
  });

  it('CAR-GEN-08: rutas previstas de aprendizaje y evaluaciones', async () => {
    const rutas: Array<[string, string]> = [
      ['POST', '/api/cursos/1/inscripcion'], ['GET', '/api/mi-aprendizaje'], ['PUT', '/api/lecciones/1/progreso'],
      ['GET', '/api/evaluaciones/1'], ['POST', '/api/evaluaciones/1/intentos'], ['PUT', '/api/evaluaciones/1'],
    ];
    const vistos: unknown[] = [];
    for (const [metodo, ruta] of rutas) {
      const r = await srv.pedir(ruta, { metodo });
      vistos.push([metodo, ruta, r.status, r.json?.error?.codigo]);
    }
    capturar('CAR-GEN-08', vistos);
  });
});

describe('transversales sobre POST /api/auth/login', () => {
  const login = (o: { crudo?: string; headers?: Record<string, string> }) =>
    srv.pedir('/api/auth/login', { metodo: 'POST', headers: { 'content-type': 'application/json', ...(o.headers ?? {}) }, crudo: o.crudo });

  it('CAR-GEN-05 CONGELADO-INSEGURO (H1, ADR-011 11.6): JSON mal formado -> 500', async () => {
    const r = await login({ crudo: '{' });
    assert.equal(r.status, 500);
    assert.deepEqual(r.json, { error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' } });
  });

  it('CAR-GEN-06 CONGELADO-INSEGURO (ADR-011 11.6): cuerpo > 1 MB -> 500', async () => {
    const r = await login({ crudo: JSON.stringify({ correo: 'a'.repeat(1_100_000) }) });
    assert.equal(r.status, 500);
    assert.equal(r.json.error.codigo, 'ERROR_INTERNO');
  });

  it('CAR-GEN-11 CONGELADO-INSEGURO (ADR-011 11.6): charset no admitido -> 500', async () => {
    const r = await login({ crudo: '{}', headers: { 'content-type': 'application/json; charset=latin1' } });
    assert.equal(r.status, 500);
  });

  it('CAR-GEN-07: text/plain con cuerpo JSON', async () => {
    const r = await login({ crudo: '{"correo":"a@b.co","contrasena":"x"}', headers: { 'content-type': 'text/plain' } });
    capturar('CAR-GEN-07', { status: r.status, error: r.json?.error });
  });

  it('CAR-GEN-09: cabeceras de helmet', async () => {
    const r = await srv.pedir('/api/categorias');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-powered-by'), null);
    capturar('CAR-GEN-09 CSP', r.headers.get('content-security-policy'));
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
