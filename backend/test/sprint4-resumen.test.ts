import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

// Lote 9 del panel de administración: resumen con los contadores de atención rápida y los indicadores globales.

const marca = crearMarca('s4_res');
const pdfDir = carpetaPdfPropia();
let f: Fixtures;
let srv: Servidor;
let admin: Cuenta;
let docente: Cuenta;
let aspirante: Cuenta;
let bloqueada: Cuenta;
let c: ReturnType<typeof fabricaCursos>;

const resumen = async () => {
  const r = await srv.pedir('/api/admin/resumen', { token: admin.token });
  assert.equal(r.status, 200, r.texto);
  return r.json;
};

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  aspirante = await cuentas.crearCuenta(['ESTUDIANTE']);
  bloqueada = await cuentas.crearCuenta(['ESTUDIANTE']);
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, admin.idPersona]);
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

describe('Lote 9 · resumen del administrador', () => {
  it('solo el administrador lo ve', async () => {
    assert.equal((await srv.pedir('/api/admin/resumen')).status, 401);
    assert.equal((await srv.pedir('/api/admin/resumen', { token: docente.token })).status, 403);
    assert.equal((await srv.pedir('/api/admin/resumen?x=1', { token: admin.token })).status, 400);
  });

  it('los indicadores coinciden con lo que hay en la base', async () => {
    const r = await resumen();
    const { rows: [u] } = await f.query<{ activos: number; inactivos: number; admins: number }>(
      `SELECT count(*) FILTER (WHERE estado = 'ACTIVO')::int AS activos, count(*) FILTER (WHERE estado = 'INACTIVO')::int AS inactivos,
              count(*) FILTER (WHERE estado = 'ACTIVO' AND EXISTS (
                SELECT 1 FROM usuario_rol ur JOIN rol ro ON ro.id_rol = ur.id_rol
                 WHERE ur.id_usuario = usuario.id_usuario AND ro.nombre = 'ADMIN'))::int AS admins
         FROM usuario`);
    assert.equal(r.usuarios.activos, u!.activos);
    assert.equal(r.usuarios.inactivos, u!.inactivos);
    assert.equal(r.usuarios.porRol.ADMIN, u!.admins);
    assert.ok(r.usuarios.porRol.ESTUDIANTE >= 4 && r.usuarios.porRol.DOCENTE >= 1);

    const { rows: estados } = await f.query<{ estado: string; n: number }>('SELECT estado, count(*)::int AS n FROM curso GROUP BY estado');
    for (const { estado, n } of estados) assert.equal(r.cursos.porEstado[estado], n, estado);
    assert.equal(r.cursos.total, estados.reduce((a, e) => a + e.n, 0));

    const { rows: [i] } = await f.query<{ total: number; completadas: number }>(
      "SELECT count(*)::int AS total, count(*) FILTER (WHERE estado = 'COMPLETADA')::int AS completadas FROM inscripcion");
    assert.equal(r.inscripciones.total, i!.total);
    assert.equal(r.inscripciones.completadas, i!.completadas);
    assert.equal(r.inscripciones.activas + r.inscripciones.completadas, r.inscripciones.total);

    assert.ok(r.resenas.promedio === null || (r.resenas.promedio >= 1 && r.resenas.promedio <= 5));
    assert.ok(r.atencion.alertasAltas <= r.atencion.alertasSeguridad);
    assert.ok(Math.abs(Date.parse(r.generadoEn) - Date.now()) < 60_000);
  });

  it('los contadores de atención suben con una solicitud, un curso en revisión y una cuenta bloqueada', async () => {
    const antes = await resumen();
    const solicitud = await srv.pedir('/api/solicitudes-docente', {
      token: aspirante.token, metodo: 'POST',
      cuerpo: { especialidad: 'Matemáticas', motivo: 'Quiero compartir mi experiencia enseñando matemáticas con ejemplos prácticos.' },
    });
    assert.equal(solicitud.status, 201, solicitud.texto);
    const curso = await c.cursoCompleto(docente);
    await c.enviarARevision(docente, curso.idCurso);
    await f.query("UPDATE usuario SET bloqueado_hasta = now() + interval '10 minutes' WHERE id_usuario = $1", [bloqueada.idUsuario]);

    const despues = await resumen();
    assert.equal(despues.atencion.solicitudesDocente, antes.atencion.solicitudesDocente + 1);
    assert.equal(despues.atencion.cursosEnRevision, antes.atencion.cursosEnRevision + 1);
    assert.equal(despues.cursos.porEstado.EN_REVISION, despues.atencion.cursosEnRevision);
    assert.equal(despues.atencion.cuentasBloqueadas, antes.atencion.cuentasBloqueadas + 1);
    assert.equal(despues.cursos.total, antes.cursos.total + 1);
  });
});
