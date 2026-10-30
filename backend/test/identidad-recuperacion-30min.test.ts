// Regresión: con RECUPERACION_MINUTOS=30 (el máximo), el vencimiento calculado en Node quedaba unos milisegundos por
// encima del CHECK de token_recuperacion (creado_en + 30 min) y el enlace no se creaba. Ahora lo calcula PostgreSQL.
import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, it } from 'node:test';

// Configuración fijada antes de cargar la app: `env` se lee al importarla.
const BUZON = await mkdtemp(path.join(os.tmpdir(), 'learnity-recuperacion-30-'));
process.env['BUZON_DIR'] = BUZON;
process.env['CORREO_TRANSPORTE'] = 'buzon';
process.env['RECUPERACION_MINUTOS'] = '30';

const { crearFixtures } = await import('./ayudas/bd-fixtures.js');
const { crearMarca } = await import('./ayudas/datos.js');
const { iniciarServidor } = await import('./ayudas/servidor.js');
const { fabricaCuentas, limpiarMarca } = await import('./ayudas/sesiones.js');
const { identidadApi } = await import('../src/modules/identidad/index.js');

const marca = crearMarca('rec30');
let f: Awaited<ReturnType<typeof crearFixtures>>;
let srv: Awaited<ReturnType<typeof iniciarServidor>>;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  await rm(BUZON, { recursive: true, force: true });
});

it('con RECUPERACION_MINUTOS=30 el enlace se crea, vence a los 30 minutos exactos y llega por correo', async () => {
  const cuenta = await fabricaCuentas(f, srv, marca).crearCuenta(['ESTUDIANTE'], { sinSesion: true });
  const r = await srv.pedir('/api/auth/recuperar', { metodo: 'POST', cuerpo: { correo: cuenta.correo } });
  assert.equal(r.status, 202);
  await identidadApi.esperarTareas();

  const { rows } = await f.query<{ minutos: string; proposito: string }>(
    `SELECT extract(epoch FROM expira_en - creado_en) / 60 AS minutos, proposito
       FROM token_recuperacion WHERE id_usuario = $1`, [cuenta.idUsuario]);
  assert.deepEqual(rows.map((x) => [Number(x.minutos), x.proposito]), [[30, 'RECUPERACION']]);

  const mensajes = await Promise.all((await readdir(BUZON)).map(async (a) => JSON.parse(await readFile(path.join(BUZON, a), 'utf8'))));
  assert.ok(mensajes.some((m) => m.para === cuenta.correo && /#token=/.test(m.texto)), 'el correo trae el enlace');
});
