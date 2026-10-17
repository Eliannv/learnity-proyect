// Pruebas de integración: solicitud para ser docente (estudiante) y su revisión (administrador).
// Requiere NODE_ENV=test y una base cuyo nombre termine en _test (ver .env.test.example).
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { Rol, UsuarioSesion } from '../src/shared/auth/tipos.js';

if (process.env['NODE_ENV'] !== 'test' || !process.env['DB_NAME']?.endsWith('_test')) {
  throw new Error('Usa NODE_ENV=test y una base exclusiva cuyo nombre termine en _test.');
}

const { crearApp } = await import('../src/app.js');
const { pool } = await import('../src/shared/database/pool.js');
const { firmarAccessToken } = await import('../src/shared/auth/jwt.js');
const { reiniciarLimites } = await import('../src/shared/http/limite-peticiones.js');

const marca = 'sd_' + randomUUID().slice(0, 8);
const personas: number[] = [];
let base = '';
let servidor: ReturnType<ReturnType<typeof crearApp>['listen']> | undefined;

interface Cuenta {
  sesion: UsuarioSesion;
  token: string;
}

const MOTIVO = 'Enseño programación web desde hace cinco años y quiero publicar un curso para principiantes.';

async function cuenta(roles: Rol[]): Promise<Cuenta> {
  const p = await pool.query<{ id: number }>(
    'INSERT INTO persona (nombres, apellidos) VALUES ($1, $2) RETURNING id_persona AS id',
    [marca, roles.join(' ')],
  );
  const idPersona = p.rows[0]!.id;
  personas.push(idPersona);
  const correo = `${marca}_${idPersona}@pruebas.test`;
  const u = await pool.query<{ id: number }>(
    'INSERT INTO usuario (id_persona, correo, contrasena_hash) VALUES ($1, $2, $3) RETURNING id_usuario AS id',
    [idPersona, correo, 'x'.repeat(60)],
  );
  const idUsuario = u.rows[0]!.id;
  await pool.query(
    'INSERT INTO usuario_rol (id_usuario, id_rol) SELECT $1, id_rol FROM rol WHERE nombre = ANY($2::text[])',
    [idUsuario, roles],
  );
  const sid = randomUUID();
  await pool.query(
    `INSERT INTO sesion (id_usuario, familia, token_hash, iniciada_en, expira_en)
     VALUES ($1, $2, $3, now(), now() + interval '1 day')`,
    [idUsuario, sid, randomUUID().replaceAll('-', '').repeat(2)],
  );
  const sesion: UsuarioSesion = { idUsuario, idPersona, correo, roles, sid };
  return { sesion, token: firmarAccessToken(sesion).token };
}

async function pedir(ruta: string, quien: Cuenta | null, metodo = 'GET', cuerpo?: unknown) {
  const headers: Record<string, string> = {};
  if (quien) headers['authorization'] = 'Bearer ' + quien.token;
  if (cuerpo !== undefined) headers['content-type'] = 'application/json';
  const r = await fetch(base + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
}

const enviar = (quien: Cuenta | null, cuerpo: unknown = { especialidad: 'Programación web', motivo: MOTIVO }) =>
  pedir('/api/solicitudes-docente', quien, 'POST', cuerpo);

// El límite por IP (10 envíos por hora) se prueba aparte; aquí cada prueba empieza de cero.
beforeEach(() => reiniciarLimites());

before(async () => {
  servidor = crearApp().listen(0);
  await new Promise<void>((r) => servidor!.once('listening', r));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

after(async () => {
  if (servidor) await new Promise<void>((r) => servidor!.close(() => r()));
  if (personas.length) {
    await pool.query(
      'DELETE FROM solicitud_docente WHERE id_persona = ANY($1::int[]) OR revisada_por = ANY($1::int[])',
      [personas],
    );
    await pool.query('DELETE FROM docente WHERE id_persona = ANY($1::int[])', [personas]);
    await pool.query('DELETE FROM usuario WHERE id_persona = ANY($1::int[])', [personas]);
    await pool.query('DELETE FROM persona WHERE id_persona = ANY($1::int[])', [personas]);
  }
  await pool.end();
});

describe('Solicitud para ser docente', () => {
  it('el estudiante sin solicitudes ve null; sin sesión no puede enviar', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const mia = await pedir('/api/solicitudes-docente/mia', est);
    assert.equal(mia.status, 200);
    assert.equal(mia.json.solicitud, null);
    assert.equal((await enviar(null)).status, 401);
  });

  it('valida especialidad y motivo (mínimo 50 caracteres)', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const corto = await enviar(est, { especialidad: 'Programación', motivo: 'Quiero enseñar.' });
    assert.equal(corto.status, 400);
    assert.equal(corto.json.error.codigo, 'SOLICITUD_INVALIDA');
    assert.equal((await enviar(est, { especialidad: 'Programación', motivo: MOTIVO, extra: 1 })).status, 400);
  });

  it('crea la solicitud PENDIENTE y no permite otra mientras siga pendiente', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const r = await enviar(est);
    assert.equal(r.status, 201);
    assert.equal(r.json.estado, 'PENDIENTE');
    assert.equal(r.json.solicitante.correo, est.sesion.correo);
    const otra = await enviar(est);
    assert.equal(otra.status, 409);
    assert.equal(otra.json.error.codigo, 'SOLICITUD_PENDIENTE');
    const mia = await pedir('/api/solicitudes-docente/mia', est);
    assert.equal(mia.json.solicitud.id, r.json.id);
  });

  it('dos envíos simultáneos dejan una sola solicitud pendiente', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const estados = (await Promise.all([enviar(est), enviar(est), enviar(est)])).map((r) => r.status).sort();
    assert.deepEqual(estados, [201, 409, 409]);
    const n = await pool.query("SELECT count(*)::int AS n FROM solicitud_docente WHERE id_persona = $1 AND estado = 'PENDIENTE'", [
      est.sesion.idPersona,
    ]);
    assert.equal(n.rows[0].n, 1);
  });

  it('solo el administrador lista y decide', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const doc = await cuenta(['ESTUDIANTE', 'DOCENTE']);
    const s = await enviar(est);
    assert.equal((await pedir('/api/admin/solicitudes', est)).status, 403);
    assert.equal((await pedir('/api/admin/solicitudes', doc)).status, 403);
    assert.equal((await pedir(`/api/admin/solicitudes/${s.json.id}`, est, 'PUT', { decision: 'APROBAR' })).status, 403);
    assert.equal((await pedir('/api/admin/solicitudes', null)).status, 401);
  });

  it('el administrador ve la solicitud pendiente con los datos del solicitante', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const adm = await cuenta(['ESTUDIANTE', 'ADMIN']);
    const s = await enviar(est);
    const lista = await pedir('/api/admin/solicitudes?estado=PENDIENTE', adm);
    assert.equal(lista.status, 200);
    const fila = lista.json.find((x: { id: number }) => x.id === s.json.id);
    assert.ok(fila, 'la solicitud aparece en la lista de pendientes');
    assert.equal(fila.solicitante.correo, est.sesion.correo);
    assert.equal(fila.motivo, MOTIVO);
    assert.equal((await pedir('/api/admin/solicitudes?estado=OTRO', adm)).status, 400);
  });

  it('rechazar exige observación; el estudiante la ve y puede volver a solicitar', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const adm = await cuenta(['ESTUDIANTE', 'ADMIN']);
    const s = await enviar(est);
    const sinObs = await pedir(`/api/admin/solicitudes/${s.json.id}`, adm, 'PUT', { decision: 'RECHAZAR', observacion: '  ' });
    assert.equal(sinObs.status, 400);
    const r = await pedir(`/api/admin/solicitudes/${s.json.id}`, adm, 'PUT', {
      decision: 'RECHAZAR',
      observacion: 'Agrega un ejemplo del curso que quieres publicar.',
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.estado, 'RECHAZADA');
    const mia = await pedir('/api/solicitudes-docente/mia', est);
    assert.equal(mia.json.solicitud.estado, 'RECHAZADA');
    assert.equal(mia.json.solicitud.observacion, 'Agrega un ejemplo del curso que quieres publicar.');
    const roles = await pool.query(
      "SELECT 1 FROM usuario_rol ur JOIN rol r USING (id_rol) WHERE ur.id_usuario = $1 AND r.nombre = 'DOCENTE'",
      [est.sesion.idUsuario],
    );
    assert.equal(roles.rowCount, 0);
    assert.equal((await enviar(est)).status, 201);
  });

  it('aprobar asigna DOCENTE, conserva ESTUDIANTE y crea el perfil docente', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const adm = await cuenta(['ESTUDIANTE', 'ADMIN']);
    const s = await enviar(est);
    const r = await pedir(`/api/admin/solicitudes/${s.json.id}`, adm, 'PUT', { decision: 'APROBAR' });
    assert.equal(r.status, 200);
    assert.equal(r.json.estado, 'APROBADA');

    const roles = await pool.query<{ nombre: string; asignado_por: number | null }>(
      'SELECT r.nombre, ur.asignado_por FROM usuario_rol ur JOIN rol r USING (id_rol) WHERE ur.id_usuario = $1 ORDER BY r.nombre',
      [est.sesion.idUsuario],
    );
    assert.deepEqual(roles.rows.map((f) => f.nombre), ['DOCENTE', 'ESTUDIANTE']);
    assert.equal(roles.rows.find((f) => f.nombre === 'DOCENTE')!.asignado_por, adm.sesion.idPersona);
    const docente = await pool.query('SELECT especialidad, estado FROM docente WHERE id_persona = $1', [est.sesion.idPersona]);
    assert.deepEqual(docente.rows[0], { especialidad: 'Programación web', estado: 'ACTIVO' });

    const otraVez = await pedir(`/api/admin/solicitudes/${s.json.id}`, adm, 'PUT', { decision: 'RECHAZAR', observacion: 'x' });
    assert.equal(otraVez.status, 409);
    assert.equal(otraVez.json.error.codigo, 'SOLICITUD_YA_REVISADA');
    const ya = await enviar(est);
    assert.equal(ya.status, 409);
    assert.equal(ya.json.error.codigo, 'YA_ES_DOCENTE');
  });

  it('dos administradores a la vez: solo una decisión gana', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const a1 = await cuenta(['ESTUDIANTE', 'ADMIN']);
    const a2 = await cuenta(['ESTUDIANTE', 'ADMIN']);
    const s = await enviar(est);
    const [x, y] = await Promise.all([
      pedir(`/api/admin/solicitudes/${s.json.id}`, a1, 'PUT', { decision: 'APROBAR' }),
      pedir(`/api/admin/solicitudes/${s.json.id}`, a2, 'PUT', { decision: 'RECHAZAR', observacion: 'Falta experiencia.' }),
    ]);
    assert.deepEqual([x.status, y.status].sort(), [200, 409]);
  });

  it('un administrador no decide su propia solicitud; una inexistente responde 404', async () => {
    const adm = await cuenta(['ESTUDIANTE', 'ADMIN']);
    const s = await enviar(adm);
    assert.equal(s.status, 201);
    assert.equal((await pedir(`/api/admin/solicitudes/${s.json.id}`, adm, 'PUT', { decision: 'APROBAR' })).status, 403);
    assert.equal((await pedir('/api/admin/solicitudes/2147483647', adm, 'PUT', { decision: 'APROBAR' })).status, 404);
  });

  it('limita los envíos por IP (10 por hora)', async () => {
    const est = await cuenta(['ESTUDIANTE']);
    const estados: number[] = [];
    for (let i = 0; i < 11; i++) estados.push((await enviar(est, { especialidad: 'x', motivo: 'y' })).status);
    assert.deepEqual(estados.slice(0, 10), Array(10).fill(400));
    assert.equal(estados[10], 429);
  });
});
