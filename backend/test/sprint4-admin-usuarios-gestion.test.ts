// Panel de administración · Lote 2: alta por invitación, ficha de la cuenta y cierre de sesiones (motivo ADMIN).
import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

// El buzón de prueba se fija antes de cargar la app: `env` se lee al importarla.
const BUZON = await mkdtemp(path.join(os.tmpdir(), 'learnity-invitaciones-'));
process.env['BUZON_DIR'] = BUZON;
process.env['CORREO_TRANSPORTE'] = 'buzon';

const { crearFixtures } = await import('./ayudas/bd-fixtures.js');
const { crearMarca } = await import('./ayudas/datos.js');
const { iniciarServidor } = await import('./ayudas/servidor.js');
const { fabricaCuentas, iniciarSesion, limpiarMarca } = await import('./ayudas/sesiones.js');
const { esperarNotificaciones } = await import('../src/shared/correo/plantilla.js');

type Cuenta = Awaited<ReturnType<ReturnType<typeof fabricaCuentas>['crearCuenta']>>;

const marca = crearMarca('s4_alta');
const CLAVE_NUEVA = 'mi frase de invitacion muy larga 2026';
let f: Awaited<ReturnType<typeof crearFixtures>>;
let srv: Awaited<ReturnType<typeof iniciarServidor>>;
let fab: ReturnType<typeof fabricaCuentas>;
let admin: Cuenta;
let estudiante: Cuenta;
let reiniciar: () => void;

async function correosPara(correo: string): Promise<{ asunto: string; texto: string; html: string }[]> {
  await esperarNotificaciones();
  const archivos = (await readdir(BUZON)).sort();
  const mensajes = await Promise.all(archivos.map(async (a) => JSON.parse(await readFile(path.join(BUZON, a), 'utf8'))));
  return mensajes.filter((m) => m.para === correo);
}

const crear = (cuerpo: object, token = admin.token) => srv.pedir('/api/admin/usuarios', { metodo: 'POST', token, cuerpo });

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  ({ reiniciarLimites: reiniciar } = await import('../src/shared/http/limite-peticiones.js'));
  fab = fabricaCuentas(f, srv, marca);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  estudiante = await fab.crearCuenta(['ESTUDIANTE']);
});

beforeEach(() => reiniciar());

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  await rm(BUZON, { recursive: true, force: true });
});

describe('Permisos', () => {
  it('un estudiante no puede crear cuentas, ver fichas ni cerrar sesiones (403)', async () => {
    assert.equal((await crear({ nombres: marca, apellidos: 'X', correo: fab.correo('x') }, estudiante.token)).status, 403);
    assert.equal((await srv.pedir(`/api/admin/usuarios/${admin.idUsuario}`, { token: estudiante.token })).status, 403);
    assert.equal((await srv.pedir(`/api/admin/usuarios/${admin.idUsuario}/sesiones`, { metodo: 'DELETE', token: estudiante.token })).status, 403);
  });
});

describe('Alta por invitación (D1)', () => {
  it('crea un docente con especialidad, envía la invitación de 72 h y la persona entra con la contraseña que elige', async () => {
    const correo = fab.correo('invitada');
    const r = await crear({ nombres: marca, apellidos: 'Invitada', correo: `  ${correo.toUpperCase()} `, roles: ['DOCENTE'],
      especialidad: 'Matemáticas' });
    assert.equal(r.status, 201, r.texto);
    assert.equal(r.json.correo, correo, 'el correo se guarda normalizado');
    assert.deepEqual(r.json.roles, ['ESTUDIANTE', 'DOCENTE']);
    assert.equal(r.json.activo, true);
    assert.equal(r.json.bloqueadoHasta, null);

    const { rows: [doc] } = await f.query<{ especialidad: string; estado: string }>(
      'SELECT especialidad, estado FROM docente WHERE id_persona = $1', [r.json.idPersona]);
    assert.deepEqual(doc, { especialidad: 'Matemáticas', estado: 'ACTIVO' });
    const { rows: [inv] } = await f.query<{ proposito: string; horas: number }>(
      `SELECT proposito, round(extract(epoch FROM expira_en - creado_en) / 3600)::int AS horas
         FROM token_recuperacion WHERE id_usuario = $1`, [r.json.id]);
    assert.deepEqual(inv, { proposito: 'INVITACION', horas: 72 });

    // Nadie conoce la contraseña inicial: ni la de prueba ni una vacía sirven.
    assert.equal((await srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena: 'Qa-Edge#2026-clave-larga' } })).status, 401);

    const [mensaje] = await correosPara(correo);
    assert.equal(mensaje?.asunto, 'Te invitamos a Learnity');
    assert.match(mensaje!.texto, /Estudiante, Docente/);
    assert.match(mensaje!.texto, /vence en 72 horas/);
    const m = mensaje!.texto.match(/\/restablecer-contrasena#token=([A-Za-z0-9_-]{43})&invitacion=1/);
    assert.ok(m, 'el correo trae el enlace de invitación con el token en el fragmento');

    const ficha = await srv.pedir(`/api/admin/usuarios/${r.json.id}`, { token: admin.token });
    assert.ok(ficha.json.invitacionPendienteHasta, 'la ficha muestra la invitación pendiente');
    assert.equal(ficha.json.especialidad, 'Matemáticas');

    const usar = await srv.pedir('/api/auth/restablecer', { metodo: 'POST', cuerpo: { token: m[1], contrasena: CLAVE_NUEVA } });
    assert.equal(usar.status, 200, usar.texto);
    assert.ok(await iniciarSesion(srv, correo, CLAVE_NUEVA), 'entra con la contraseña que eligió');
    const despues = await srv.pedir(`/api/admin/usuarios/${r.json.id}`, { token: admin.token });
    assert.equal(despues.json.invitacionPendienteHasta, null, 'la invitación ya se usó');

    const { rows: [audit] } = await f.query<{ actor: number }>(
      `SELECT id_persona_actor AS actor FROM auditoria_cambio
        WHERE tabla = 'usuario' AND operacion = 'INSERT' AND (despues ->> 'id_usuario')::int = $1`, [r.json.id]);
    assert.equal(audit?.actor, admin.idPersona, 'el alta queda auditada con el administrador como autor');
  });

  it('un administrador nuevo recibe ESTUDIANTE y ADMIN', async () => {
    const r = await crear({ nombres: marca, apellidos: 'Admin', correo: fab.correo('admin2'), roles: ['ADMIN', 'ESTUDIANTE'] });
    assert.equal(r.status, 201, r.texto);
    assert.deepEqual(r.json.roles, ['ESTUDIANTE', 'ADMIN']);
  });

  it('rechaza un DOCENTE sin especialidad, un correo inválido o campos desconocidos (400)', async () => {
    const sinEsp = await crear({ nombres: marca, apellidos: 'Doc', correo: fab.correo('sinesp'), roles: ['DOCENTE'] });
    assert.equal(sinEsp.status, 400);
    assert.ok(sinEsp.json.error.detalles.some((d: { campo: string }) => d.campo === 'especialidad'));
    assert.equal((await crear({ nombres: marca, apellidos: 'X', correo: 'no-es-correo' })).status, 400);
    assert.equal((await crear({ nombres: marca, apellidos: 'X', correo: fab.correo('extra'), contrasena: 'x' })).status, 400);
  });

  it('un correo ya registrado responde 409 CORREO_EN_USO sin crear nada', async () => {
    const r = await crear({ nombres: marca, apellidos: 'Repetida', correo: estudiante.correo });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.codigo, 'CORREO_EN_USO');
  });
});

describe('Ficha de la cuenta', () => {
  it('muestra sesiones abiertas, inscripciones y cursos creados', async () => {
    const docente = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
    const alumna = await fab.crearCuenta(['ESTUDIANTE']);
    const { rows: [cat] } = await f.query<{ id: number }>(
      'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, admin.idPersona]);
    const { rows: [curso] } = await f.query<{ id: number }>(
      'INSERT INTO curso (id_docente, id_categoria, titulo) VALUES ($1, $2, $3) RETURNING id_curso AS id',
      [docente.idDocente, cat!.id, `${marca} Álgebra`]);
    await f.query('INSERT INTO inscripcion (id_persona, id_curso, progreso_pct) VALUES ($1, $2, 40)', [alumna.idPersona, curso!.id]);

    const fichaAlumna = await srv.pedir(`/api/admin/usuarios/${alumna.idUsuario}`, { token: admin.token });
    assert.equal(fichaAlumna.status, 200);
    assert.equal(fichaAlumna.json.sesiones.length, 1, 'la sesión que abrió la fábrica de cuentas');
    assert.deepEqual(Object.keys(fichaAlumna.json.sesiones[0]).sort(), ['agente', 'expiraEn', 'id', 'iniciadaEn', 'renovadaEn']);
    assert.deepEqual(fichaAlumna.json.inscripciones.map((i: { curso: { id: number }; estado: string; progresoPct: number }) =>
      [i.curso.id, i.estado, i.progresoPct]), [[curso!.id, 'ACTIVA', 40]]);
    assert.deepEqual(fichaAlumna.json.cursosCreados, []);
    assert.equal(fichaAlumna.json.especialidad, null);
    assert.equal(fichaAlumna.json.invitacionPendienteHasta, null);
    assert.equal(fichaAlumna.json.intentosFallidos, 0);

    const fichaDocente = await srv.pedir(`/api/admin/usuarios/${docente.idUsuario}`, { token: admin.token });
    assert.deepEqual(fichaDocente.json.cursosCreados, [{ id: curso!.id, titulo: `${marca} Álgebra`, estado: 'BORRADOR', inscritos: 1 }]);
    assert.equal(fichaDocente.json.especialidad, 'Pruebas');
  });

  it('una cuenta que no existe responde 404', async () => {
    assert.equal((await srv.pedir('/api/admin/usuarios/2147483647', { token: admin.token })).status, 404);
  });

  it('el listado indica las cuentas bloqueadas ahora', async () => {
    const bloqueada = await fab.crearCuenta(['ESTUDIANTE'], { sinSesion: true });
    await f.query("UPDATE usuario SET intentos_fallidos = 5, bloqueado_hasta = now() + interval '10 minutes' WHERE id_usuario = $1",
      [bloqueada.idUsuario]);
    const r = await srv.pedir(`/api/admin/usuarios?q=${encodeURIComponent(bloqueada.correo)}`, { token: admin.token });
    assert.ok(r.json.items[0].bloqueadoHasta, 'bloqueada');
    const libre = await srv.pedir(`/api/admin/usuarios?q=${encodeURIComponent(estudiante.correo)}`, { token: admin.token });
    assert.equal(libre.json.items[0].bloqueadoHasta, null);
  });
});

describe('Cerrar sesiones (motivo ADMIN)', () => {
  it('cierra todas las sesiones de la cuenta: su access token deja de valer', async () => {
    const cuenta = await fab.crearCuenta(['ESTUDIANTE']);
    const otro = await iniciarSesion(srv, cuenta.correo);
    assert.equal((await srv.pedir('/api/perfil', { token: otro })).status, 200);

    const r = await srv.pedir(`/api/admin/usuarios/${cuenta.idUsuario}/sesiones`, { metodo: 'DELETE', token: admin.token });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { cerradas: 2 });
    assert.equal((await srv.pedir('/api/perfil', { token: cuenta.token })).status, 401);
    assert.equal((await srv.pedir('/api/perfil', { token: otro })).status, 401);

    const { rows } = await f.query<{ motivo: string }>(
      'SELECT DISTINCT motivo_revocacion AS motivo FROM sesion WHERE id_usuario = $1', [cuenta.idUsuario]);
    assert.deepEqual(rows.map((x) => x.motivo), ['ADMIN']);
    const ficha = await srv.pedir(`/api/admin/usuarios/${cuenta.idUsuario}`, { token: admin.token });
    assert.deepEqual(ficha.json.sesiones, []);
  });

  it('no sirve para la propia cuenta (400) ni para una que no existe (404)', async () => {
    assert.equal((await srv.pedir(`/api/admin/usuarios/${admin.idUsuario}/sesiones`, { metodo: 'DELETE', token: admin.token })).status, 400);
    assert.equal((await srv.pedir('/api/admin/usuarios/2147483647/sesiones', { metodo: 'DELETE', token: admin.token })).status, 404);
  });
});
