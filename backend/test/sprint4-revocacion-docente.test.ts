// Panel de administración · Lote 3: revocación del rol docente de una solicitud aprobada (migración 033, D3).
import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

// El buzón de prueba se fija antes de cargar la app: `env` se lee al importarla.
const BUZON = await mkdtemp(path.join(os.tmpdir(), 'learnity-revocacion-'));
process.env['BUZON_DIR'] = BUZON;
process.env['CORREO_TRANSPORTE'] = 'buzon';

const { crearFixtures } = await import('./ayudas/bd-fixtures.js');
const { crearMarca } = await import('./ayudas/datos.js');
const { iniciarServidor } = await import('./ayudas/servidor.js');
const { fabricaCuentas, limpiarMarca } = await import('./ayudas/sesiones.js');
const { esperarNotificaciones } = await import('../src/shared/correo/plantilla.js');

type Cuenta = Awaited<ReturnType<ReturnType<typeof fabricaCuentas>['crearCuenta']>>;

const marca = crearMarca('s4_revoca');
const MOTIVO_SOLICITUD = 'Quiero enseñar programación web a estudiantes que empiezan desde cero en la carrera.';
const MOTIVO_REVOCACION = 'Publicó material que infringe derechos de autor.';
let f: Awaited<ReturnType<typeof crearFixtures>>;
let srv: Awaited<ReturnType<typeof iniciarServidor>>;
let admin: Cuenta;
let aspirante: Cuenta;
let idSolicitud = 0;
let idCurso = 0;

async function correosPara(correo: string): Promise<{ asunto: string; texto: string }[]> {
  await esperarNotificaciones();
  const archivos = (await readdir(BUZON)).sort();
  const mensajes = await Promise.all(archivos.map(async (a) => JSON.parse(await readFile(path.join(BUZON, a), 'utf8'))));
  return mensajes.filter((m) => m.para === correo);
}

const revocar = (id: number, cuerpo: object, token = admin.token) =>
  srv.pedir(`/api/admin/solicitudes/${id}/revocacion`, { metodo: 'POST', token, cuerpo });

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  aspirante = await fab.crearCuenta(['ESTUDIANTE']);

  // Solicita, se aprueba y publica un curso (con revisor y fecha, como exige la 023).
  const s = await srv.pedir('/api/solicitudes-docente', {
    metodo: 'POST', token: aspirante.token, cuerpo: { especialidad: 'Programación web', motivo: MOTIVO_SOLICITUD } });
  assert.equal(s.status, 201, s.texto);
  idSolicitud = s.json.id;
  const ok = await srv.pedir(`/api/admin/solicitudes/${idSolicitud}`, { metodo: 'PUT', token: admin.token, cuerpo: { decision: 'APROBAR' } });
  assert.equal(ok.status, 200, ok.texto);
  const { rows: [cat] } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, admin.idPersona]);
  const { rows: [curso] } = await f.query<{ id: number }>(
    `INSERT INTO curso (id_docente, id_categoria, titulo, estado, revisado_por, publicado_en)
     SELECT d.id_docente, $2, $3, 'PUBLICADO', $4, now() FROM docente d WHERE d.id_persona = $1
     RETURNING id_curso AS id`,
    [aspirante.idPersona, cat!.id, `${marca} HTML desde cero`, admin.idPersona]);
  idCurso = curso!.id;
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  await rm(BUZON, { recursive: true, force: true });
});

describe('Revocación del rol docente (D3)', () => {
  it('las aprobadas indican cuántos cursos publicados tiene el docente', async () => {
    const r = await srv.pedir('/api/admin/solicitudes?estado=APROBADA', { token: admin.token });
    const propia = r.json.find((x: { id: number }) => x.id === idSolicitud);
    assert.equal(propia.cursosPublicados, 1);
    assert.equal(propia.revocacion, null);
  });

  it('valida permisos, motivo y existencia', async () => {
    assert.equal((await revocar(idSolicitud, { motivo: MOTIVO_REVOCACION }, aspirante.token)).status, 403);
    const vacio = await revocar(idSolicitud, { motivo: '   ' });
    assert.equal(vacio.status, 400);
    assert.ok(vacio.json.error.detalles.some((d: { campo: string }) => d.campo === 'motivo'));
    assert.equal((await revocar(idSolicitud, { motivo: 'x'.repeat(301) })).status, 400);
    assert.equal((await revocar(2147483647, { motivo: MOTIVO_REVOCACION })).status, 404);
  });

  it('una solicitud que no está aprobada no se puede revocar (409)', async () => {
    const otro = await fabricaCuentas(f, srv, marca).crearCuenta(['ESTUDIANTE']);
    const s = await srv.pedir('/api/solicitudes-docente', {
      metodo: 'POST', token: otro.token, cuerpo: { especialidad: 'Diseño', motivo: MOTIVO_SOLICITUD } });
    const r = await revocar(s.json.id, { motivo: MOTIVO_REVOCACION });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.codigo, 'SOLICITUD_NO_APROBADA');
  });

  it('retira el rol e inactiva el perfil docente; el curso sigue publicado pero ya no lo puede gestionar', async () => {
    assert.equal((await srv.pedir('/api/docente/analiticas', { token: aspirante.token })).status, 200, 'antes es docente');

    const r = await revocar(idSolicitud, { motivo: `  ${MOTIVO_REVOCACION}  ` });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.estado, 'REVOCADA');
    assert.equal(r.json.revocacion.motivo, MOTIVO_REVOCACION);
    assert.equal(r.json.cursosPublicados, 1);

    const { rows: roles } = await f.query<{ nombre: string }>(
      'SELECT r.nombre FROM usuario_rol ur JOIN rol r ON r.id_rol = ur.id_rol WHERE ur.id_usuario = $1', [aspirante.idUsuario]);
    assert.deepEqual(roles.map((x) => x.nombre), ['ESTUDIANTE']);
    const { rows: [doc] } = await f.query<{ estado: string }>('SELECT estado FROM docente WHERE id_persona = $1', [aspirante.idPersona]);
    assert.equal(doc!.estado, 'INACTIVO');
    const { rows: [curso] } = await f.query<{ estado: string }>('SELECT estado FROM curso WHERE id_curso = $1', [idCurso]);
    assert.equal(curso!.estado, 'PUBLICADO', 'D3: sus cursos publicados siguen publicados');

    // El rol se lee de la base en cada petición: el mismo access token ya no entra al panel docente.
    assert.equal((await srv.pedir('/api/docente/analiticas', { token: aspirante.token })).status, 403);
    assert.equal((await srv.pedir(`/api/cursos/${idCurso}`)).status, 200, 'el curso sigue en el catálogo');

    const { rows: [audit] } = await f.query<{ actor: number }>(
      `SELECT id_persona_actor AS actor FROM auditoria_cambio
        WHERE tabla = 'solicitud_docente' AND operacion = 'UPDATE' AND (despues ->> 'id_solicitud')::int = $1
          AND despues ->> 'estado' = 'REVOCADA'`, [idSolicitud]);
    assert.equal(audit?.actor, admin.idPersona);

    const [aviso] = (await correosPara(aspirante.correo)).filter((m) => m.asunto === 'Tu rol de docente en Learnity');
    assert.ok(aviso, 'la persona recibe un correo');
    assert.match(aviso!.texto, /infringe derechos de autor/);
  });

  it('revocar otra vez responde 409; la lista de revocadas y el perfil de la persona la muestran', async () => {
    assert.equal((await revocar(idSolicitud, { motivo: MOTIVO_REVOCACION })).status, 409);
    const lista = await srv.pedir('/api/admin/solicitudes?estado=REVOCADA', { token: admin.token });
    assert.ok(lista.json.some((x: { id: number }) => x.id === idSolicitud));
    const mia = await srv.pedir('/api/solicitudes-docente/mia', { token: aspirante.token });
    assert.equal(mia.json.solicitud.estado, 'REVOCADA');
    assert.equal(mia.json.solicitud.revocacion.motivo, MOTIVO_REVOCACION);
  });

  it('la persona puede volver a solicitar el rol', async () => {
    const r = await srv.pedir('/api/solicitudes-docente', {
      metodo: 'POST', token: aspirante.token, cuerpo: { especialidad: 'Programación web', motivo: MOTIVO_SOLICITUD } });
    assert.equal(r.status, 201, r.texto);
  });
});
