// Panel de administración · Lote 4: pestañas de Revisión, suspensión y reactivación de cursos (migración 034, D2).
import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// El buzón de prueba se fija antes de cargar la app: `env` se lee al importarla.
const BUZON = await mkdtemp(path.join(os.tmpdir(), 'learnity-suspension-'));
process.env['BUZON_DIR'] = BUZON;
process.env['CORREO_TRANSPORTE'] = 'buzon';

const { crearFixtures } = await import('./ayudas/bd-fixtures.js');
const { crearMarca } = await import('./ayudas/datos.js');
const { iniciarServidor } = await import('./ayudas/servidor.js');
const { fabricaCuentas, limpiarMarca } = await import('./ayudas/sesiones.js');
const { esperarNotificaciones } = await import('../src/shared/correo/plantilla.js');

type Cuenta = Awaited<ReturnType<ReturnType<typeof fabricaCuentas>['crearCuenta']>>;

const marca = crearMarca('s4_susp');
const MOTIVO = 'Contenido con lenguaje ofensivo en el módulo 2.';
let f: Awaited<ReturnType<typeof crearFixtures>>;
let srv: Awaited<ReturnType<typeof iniciarServidor>>;
let admin: Cuenta;
let docente: Cuenta;
let alumna: Cuenta;
let publicado = 0;
let borrador = 0;
let publicadoEnOriginal = '';

async function correosPara(correo: string): Promise<{ asunto: string; texto: string }[]> {
  await esperarNotificaciones();
  const archivos = (await readdir(BUZON)).sort();
  const mensajes = await Promise.all(archivos.map(async (a) => JSON.parse(await readFile(path.join(BUZON, a), 'utf8'))));
  return mensajes.filter((m) => m.para === correo);
}

const suspender = (id: number, cuerpo: object, token = admin.token) =>
  srv.pedir(`/api/admin/cursos/${id}/suspension`, { metodo: 'POST', token, cuerpo });
const reactivar = (id: number, token = admin.token) =>
  srv.pedir(`/api/admin/cursos/${id}/suspension`, { metodo: 'DELETE', token });
const fila = async (id: number) => (await f.query<{
  estado: string; suspendido_por: number | null; motivo_suspension: string | null; revisado_por: number | null; publicado_en: Date | null;
}>('SELECT estado, suspendido_por, motivo_suspension, revisado_por, publicado_en FROM curso WHERE id_curso = $1', [id])).rows[0]!;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  docente = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  alumna = await fab.crearCuenta(['ESTUDIANTE']);
  const { rows: [cat] } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, admin.idPersona]);
  const { rows: [p] } = await f.query<{ id: number; publicado: Date }>(
    `INSERT INTO curso (id_docente, id_categoria, titulo, estado, revisado_por, publicado_en)
     VALUES ($1, $2, $3, 'PUBLICADO', $4, now() - interval '3 days') RETURNING id_curso AS id, publicado_en AS publicado`,
    [docente.idDocente, cat!.id, `${marca} Redacción`, admin.idPersona]);
  publicado = p!.id;
  publicadoEnOriginal = p!.publicado.toISOString();
  const { rows: [b] } = await f.query<{ id: number }>(
    'INSERT INTO curso (id_docente, id_categoria, titulo) VALUES ($1, $2, $3) RETURNING id_curso AS id',
    [docente.idDocente, cat!.id, `${marca} Borrador`]);
  borrador = b!.id;
  await f.query('INSERT INTO inscripcion (id_persona, id_curso, progreso_pct) VALUES ($1, $2, 40)', [alumna.idPersona, publicado]);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  await rm(BUZON, { recursive: true, force: true });
});

describe('Pestañas de Revisión de cursos', () => {
  it('lista por estado con inscritos y conteos; ARCHIVADO no es una pestaña', async () => {
    const pub = await srv.pedir('/api/admin/cursos?estado=PUBLICADO', { token: admin.token });
    assert.equal(pub.status, 200);
    const curso = pub.json.items.find((x: { id: number }) => x.id === publicado);
    assert.equal(curso.inscritos, 1);
    assert.equal(curso.suspension, null);
    assert.ok(pub.json.items.every((x: { estado: string }) => x.estado === 'PUBLICADO'));
    assert.ok(pub.json.conteos.PUBLICADO >= 1 && pub.json.conteos.BORRADOR >= 1);

    const bor = await srv.pedir('/api/admin/cursos?estado=BORRADOR', { token: admin.token });
    assert.ok(bor.json.items.some((x: { id: number }) => x.id === borrador));
    assert.equal((await srv.pedir('/api/admin/cursos?estado=ARCHIVADO', { token: admin.token })).status, 400);
  });

  it('el detalle de solo lectura se abre en cualquier estado', async () => {
    const r = await srv.pedir(`/api/admin/cursos/${borrador}`, { token: admin.token });
    assert.equal(r.status, 200);
    assert.equal(r.json.estado, 'BORRADOR');
    assert.equal(r.json.suspension, null);
  });
});

describe('Suspender un curso publicado', () => {
  it('valida permisos, confirmación, motivo, estado y existencia', async () => {
    assert.equal((await suspender(publicado, { motivo: MOTIVO, confirmo: true }, docente.token)).status, 403);
    const sinConfirmar = await suspender(publicado, { motivo: MOTIVO });
    assert.equal(sinConfirmar.status, 400);
    assert.ok(sinConfirmar.json.error.detalles.some((d: { campo: string }) => d.campo === 'confirmo'));
    assert.equal((await suspender(publicado, { motivo: MOTIVO, confirmo: false })).status, 400);
    assert.equal((await suspender(publicado, { motivo: '  ', confirmo: true })).status, 400);
    const enBorrador = await suspender(borrador, { motivo: MOTIVO, confirmo: true });
    assert.equal(enBorrador.status, 409);
    assert.equal(enBorrador.json.error.codigo, 'CURSO_NO_PUBLICADO');
    assert.equal((await suspender(2147483647, { motivo: MOTIVO, confirmo: true })).status, 404);
    assert.equal((await fila(publicado)).estado, 'PUBLICADO', 'nada cambió');
  });

  it('lo suspende: sale del catálogo, la alumna lo ve marcado sin poder abrirlo y el docente no puede editarlo (D2)', async () => {
    const r = await suspender(publicado, { motivo: `  ${MOTIVO} `, confirmo: true });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.estado, 'SUSPENDIDO');
    assert.equal(r.json.suspension.motivo, MOTIVO);
    const enBd = await fila(publicado);
    assert.equal(enBd.suspendido_por, admin.idPersona);

    assert.equal((await srv.pedir(`/api/cursos/${publicado}`)).status, 404, 'fuera del catálogo');
    const mio = await srv.pedir('/api/mi-aprendizaje', { token: alumna.token });
    const tarjeta = mio.json.items.find((x: { curso: { id: number } }) => x.curso.id === publicado);
    assert.ok(tarjeta, 'sigue en Mi aprendizaje');
    assert.equal(tarjeta.suspendido, true);
    assert.equal(tarjeta.inscripcion.progresoPct, 40, 'conserva su progreso');
    assert.ok(!('motivo' in tarjeta) && !JSON.stringify(tarjeta).includes('ofensivo'), 'la alumna no ve el motivo interno');
    assert.equal((await srv.pedir(`/api/mi-aprendizaje/cursos/${publicado}`, { token: alumna.token })).status, 404);

    const editar = await srv.pedir(`/api/cursos/${publicado}/modulos`, {
      metodo: 'POST', token: docente.token, cuerpo: { titulo: 'Nuevo módulo', orden: 1 } });
    assert.equal(editar.status, 409);
    assert.equal(editar.json.error.codigo, 'CURSO_BLOQUEADO');
    const delDocente = await srv.pedir(`/api/docente/cursos/${publicado}`, { token: docente.token });
    assert.equal(delDocente.json.suspension.motivo, MOTIVO, 'el docente ve el motivo en su curso');

    const sus = await srv.pedir('/api/admin/cursos?estado=SUSPENDIDO', { token: admin.token });
    assert.equal(sus.json.items.find((x: { id: number }) => x.id === publicado)?.suspension.motivo, MOTIVO);

    const { rows: [audit] } = await f.query<{ actor: number }>(
      `SELECT id_persona_actor AS actor FROM auditoria_cambio
        WHERE tabla = 'curso' AND operacion = 'UPDATE' AND (despues ->> 'id_curso')::int = $1
          AND despues ->> 'estado' = 'SUSPENDIDO'`, [publicado]);
    assert.equal(audit?.actor, admin.idPersona);
    const aviso = (await correosPara(docente.correo)).find((m) => m.asunto.startsWith('Suspendimos tu curso'));
    assert.ok(aviso, 'el docente recibe un correo');
    assert.match(aviso!.texto, /lenguaje ofensivo/);
  });

  it('suspender un curso ya suspendido responde 409', async () => {
    const r = await suspender(publicado, { motivo: MOTIVO, confirmo: true });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.codigo, 'CURSO_NO_PUBLICADO');
  });
});

describe('Reactivar un curso suspendido', () => {
  it('vuelve a publicarlo con su revisor y su fecha; la alumna recupera el acceso', async () => {
    assert.equal((await reactivar(publicado, docente.token)).status, 403);
    const r = await reactivar(publicado);
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.estado, 'PUBLICADO');
    assert.equal(r.json.suspension, null);
    const enBd = await fila(publicado);
    assert.deepEqual([enBd.suspendido_por, enBd.motivo_suspension, enBd.revisado_por, enBd.publicado_en?.toISOString()],
      [null, null, admin.idPersona, publicadoEnOriginal]);

    assert.equal((await srv.pedir(`/api/cursos/${publicado}`)).status, 200, 'vuelve al catálogo');
    const mio = await srv.pedir('/api/mi-aprendizaje', { token: alumna.token });
    assert.equal(mio.json.items.find((x: { curso: { id: number } }) => x.curso.id === publicado).suspendido, false);
    assert.equal((await srv.pedir(`/api/mi-aprendizaje/cursos/${publicado}`, { token: alumna.token })).status, 200);

    const aviso = (await correosPara(docente.correo)).find((m) => m.asunto.includes('vuelve a estar publicado'));
    assert.ok(aviso, 'el docente recibe un correo');
  });

  it('reactivar un curso que no está suspendido responde 409', async () => {
    const r = await reactivar(publicado);
    assert.equal(r.status, 409);
    assert.equal(r.json.error.codigo, 'CURSO_NO_SUSPENDIDO');
    assert.equal((await reactivar(2147483647)).status, 404);
  });
});
