import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// El buzón de prueba se fija antes de cargar la app: `env` se lee al importarla.
const BUZON = await mkdtemp(path.join(os.tmpdir(), 'learnity-avisos-'));
process.env['BUZON_DIR'] = BUZON;
process.env['CORREO_TRANSPORTE'] = 'buzon';

const { crearFixtures } = await import('./ayudas/bd-fixtures.js');
const { fabricaCursos } = await import('./ayudas/cursos-http.js');
const { carpetaPdfPropia } = await import('./ayudas/archivos.js');
const { crearMarca } = await import('./ayudas/datos.js');
const { iniciarServidor } = await import('./ayudas/servidor.js');
const { fabricaCuentas, limpiarMarca } = await import('./ayudas/sesiones.js');
const { esperarNotificaciones } = await import('../src/shared/correo/plantilla.js');

type Cuenta = Awaited<ReturnType<ReturnType<typeof fabricaCuentas>['crearCuenta']>>;

const marca = crearMarca('s4_aviso');
const pdfDir = carpetaPdfPropia();
let f: Awaited<ReturnType<typeof crearFixtures>>;
let srv: Awaited<ReturnType<typeof iniciarServidor>>;
let admin: Cuenta;
let docente: Cuenta;
let aspirante: Cuenta;
let c: ReturnType<typeof fabricaCursos>;

async function correosPara(correo: string): Promise<{ asunto: string; texto: string; html: string }[]> {
  await esperarNotificaciones();
  const archivos = (await readdir(BUZON)).sort();
  const mensajes = await Promise.all(archivos.map(async (a) => JSON.parse(await readFile(path.join(BUZON, a), 'utf8'))));
  return mensajes.filter((m) => m.para === correo);
}

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  aspirante = await cuentas.crearCuenta(['ESTUDIANTE']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id',
    [marca, admin.idPersona],
  );
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
  await rm(BUZON, { recursive: true, force: true });
});

describe('Sprint 4 · avisos por correo de las decisiones administrativas', () => {
  it('avisa al docente cuando su curso se rechaza (con el motivo) y cuando se publica', async () => {
    const { idCurso } = await c.cursoCompleto(docente);
    await c.enviarARevision(docente, idCurso);
    const rechazo = await c.como(admin, 'PUT', `/api/admin/cursos/${idCurso}/revision`, {
      decision: 'RECHAZAR', motivo: 'Añade <b>ejemplos</b> prácticos.',
    });
    assert.equal(rechazo.status, 200, rechazo.texto);

    let avisos = await correosPara(docente.correo);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0]!.asunto, /necesita cambios/);
    assert.match(avisos[0]!.texto, /Añade <b>ejemplos<\/b> prácticos\./);
    assert.match(avisos[0]!.texto, new RegExp(`/docente/cursos/${idCurso}/editar`));
    assert.ok(!avisos[0]!.html.includes('<b>ejemplos'), 'el motivo se escapa en el HTML');

    await c.enviarARevision(docente, idCurso);
    const aprobado = await c.como(admin, 'PUT', `/api/admin/cursos/${idCurso}/revision`, { decision: 'APROBAR' });
    assert.equal(aprobado.status, 200, aprobado.texto);
    avisos = await correosPara(docente.correo);
    assert.equal(avisos.length, 2);
    assert.match(avisos[1]!.asunto, /ya está publicado/);
    assert.match(avisos[1]!.texto, new RegExp(`/cursos/${idCurso}\\b`));
  });

  it('avisa a quien pidió ser docente cuando se aprueba su solicitud', async () => {
    const solicitud = await srv.pedir('/api/solicitudes-docente', {
      token: aspirante.token, metodo: 'POST',
      cuerpo: { especialidad: 'Matemáticas', motivo: 'Enseño matemáticas desde hace años y quiero compartir mis cursos aquí.' },
    });
    assert.equal(solicitud.status, 201, solicitud.texto);
    const decision = await srv.pedir(`/api/admin/solicitudes/${solicitud.json.id}`, {
      token: admin.token, metodo: 'PUT', cuerpo: { decision: 'APROBAR' },
    });
    assert.equal(decision.status, 200, decision.texto);
    const avisos = await correosPara(aspirante.correo);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0]!.asunto, /Ya eres docente/);
    assert.match(avisos[0]!.texto, /\/docente\/cursos/);
  });
});
