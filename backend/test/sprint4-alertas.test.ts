import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { carpetaPdfPropia } from './ayudas/archivos.js';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

// Lote 8 del panel de administración (migración 038): reglas de alertas de seguridad, análisis bajo demanda,
// deduplicación por clave y «Marcar atendida» auditado.

const marca = crearMarca('s4_alr');
const pdfDir = carpetaPdfPropia();
let f: Fixtures;
let srv: Servidor;
let reiniciar: () => void;
let inicio: Date;
let admin: Cuenta;
let docente: Cuenta;
let ana: Cuenta;
let cinco: Cuenta;
let diez: Cuenta;
let cuatro: Cuenta;
let espaciados: Cuenta;
let creciente: Cuenta;
let promovido: Cuenta;
let docenteDirecto: Cuenta;
let aspirante: Cuenta;
let cursoId = 0;
let c: ReturnType<typeof fabricaCursos>;

interface FilaAlerta { id: string; tipo: string; severidad: string; descripcion: string; clave: string; evidencia: { auditoria?: number[]; accesos?: number[] } }

const como = (cuenta: Cuenta | null, metodo: string, ruta: string, cuerpo?: unknown) =>
  srv.pedir(ruta, { token: cuenta?.token ?? null, metodo, cuerpo });

/** Fallos de contraseña ya ocurridos (minutos atrás), como los registra Identidad. */
async function fallos(cuenta: Cuenta, minutos: number[], motivo = 'CLAVE_INCORRECTA'): Promise<void> {
  for (const m of minutos) {
    await f.query(
      `INSERT INTO evento_acceso (id_usuario, correo, paso, exito, motivo, agente, ocurrido_en)
       VALUES ($1, $2, 'CLAVE', false, $3, 'Prueba/1.0', now() - make_interval(mins => $4))`,
      [cuenta.idUsuario, cuenta.correo, motivo, m]);
  }
}

const alertasDe = async (tipo: string, cuenta: Cuenta) => (await f.query<FilaAlerta>(
  `SELECT id_alerta AS id, tipo, severidad, descripcion, clave, evidencia FROM alerta_seguridad
    WHERE tipo = $1 AND id_usuario = $2 ORDER BY id_alerta`, [tipo, cuenta.idUsuario])).rows;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  ({ reiniciarLimites: reiniciar } = await import('../src/shared/http/limite-peticiones.js'));
  inicio = (await f.query<{ ahora: Date }>('SELECT now() AS ahora')).rows[0]!.ahora;
  const cuentas = fabricaCuentas(f, srv, marca);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  ana = await cuentas.crearCuenta(['ESTUDIANTE']);
  [cinco, diez, cuatro, espaciados, creciente, promovido, docenteDirecto, aspirante] = await Promise.all(
    Array.from({ length: 8 }, () => cuentas.crearCuenta(['ESTUDIANTE'])));

  // INTENTOS_FALLIDOS: 5 en 15 min (MEDIA), 10 (ALTA), 4 (nada), 5 espaciados 20 min (nada) y 5 que luego crecen.
  await fallos(cinco!, [14, 12, 9, 5, 1]);
  await fallos(diez!, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  await fallos(cuatro!, [4, 3, 2, 1]);
  await fallos(espaciados!, [100, 80, 60, 40, 20]);
  await fallos(creciente!, [9, 8, 7, 6, 5]);

  // CAMBIO_PRIVILEGIOS: ADMIN concedido por el administrador (ALTA), DOCENTE directo (MEDIA) y por solicitud (BAJA).
  assert.equal((await como(admin, 'PUT', `/api/admin/usuarios/${promovido!.idUsuario}/roles`, { roles: ['ESTUDIANTE', 'ADMIN'] })).status, 200);
  assert.equal((await como(admin, 'PUT', `/api/admin/usuarios/${docenteDirecto!.idUsuario}/roles`, { roles: ['ESTUDIANTE', 'DOCENTE'] })).status, 200);
  const solicitud = await como(aspirante!, 'POST', '/api/solicitudes-docente',
    { especialidad: 'Seguridad informática', motivo: 'Quiero enseñar buenas prácticas de seguridad a los estudiantes de la plataforma.' });
  assert.equal(solicitud.status, 201, solicitud.texto);
  const aprobada = await como(admin, 'PUT', `/api/admin/solicitudes/${solicitud.json.id}`, { decision: 'APROBAR' });
  assert.equal(aprobada.status, 200, aprobada.texto);

  // RAFAGA_RESENAS: Ana publica y edita su reseña seis veces seguidas en un curso publicado.
  const { rows } = await f.query<{ id: number }>(
    'INSERT INTO categoria (nombre, creada_por) VALUES ($1, $2) RETURNING id_categoria AS id', [marca, admin.idPersona]);
  c = fabricaCursos(srv, marca, () => rows[0]!.id);
  const curso = await c.cursoCompleto(docente);
  await c.enviarARevision(docente, curso.idCurso);
  assert.equal((await c.como(admin, 'PUT', `/api/admin/cursos/${curso.idCurso}/revision`, { decision: 'APROBAR' })).status, 200);
  cursoId = curso.idCurso;
  assert.equal((await como(ana, 'POST', `/api/cursos/${cursoId}/inscripcion`)).status, 201);
  for (const estrellas of [1, 2, 3, 4, 5, 4]) {
    assert.equal((await como(ana, 'PUT', `/api/cursos/${cursoId}/resena`, { estrellas })).status, 200);
  }

  // MODIFICACION_MASIVA: el docente (como actor) borra tres módulos del curso publicado.
  const modulos = await f.query<{ id: number }>(
    `INSERT INTO modulo (id_curso, titulo, orden) SELECT $1, 'Extra ' || n, 7 + n FROM generate_series(1, 3) n
     RETURNING id_modulo AS id`, [cursoId]);
  await f.transaccion(async (cliente) => {
    await cliente.query("SELECT set_config('learnity.id_persona', $1, true)", [String(docente.idPersona)]);
    await cliente.query('DELETE FROM modulo WHERE id_modulo = ANY ($1::int[])', [modulos.rows.map((m) => m.id)]);
  });
});

beforeEach(() => reiniciar());

after(async () => {
  await srv?.cerrar();
  if (f) {
    await f.query('DELETE FROM alerta_seguridad WHERE detectada_en >= $1', [inicio]);
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
  pdfDir.borrar();
});

describe('Lote 8 · análisis de alertas', () => {
  it('solo el administrador lo ejecuta; repetirlo no duplica hallazgos', async () => {
    assert.equal((await como(ana, 'POST', '/api/admin/alertas/analisis')).status, 403);
    const r = await como(admin, 'POST', '/api/admin/alertas/analisis');
    assert.equal(r.status, 200, r.texto);
    assert.ok(r.json.nuevas >= 7, `nuevas: ${r.json.nuevas}`);
    assert.ok(Math.abs(Date.parse(r.json.desde) - (Date.now() - 24 * 3_600_000)) < 60_000);
    const otra = await como(admin, 'POST', '/api/admin/alertas/analisis');
    assert.equal(otra.json.nuevas, 0);
  });

  it('INTENTOS_FALLIDOS: 5 en 15 minutos es MEDIA y 10 es ALTA, con los accesos como evidencia', async () => {
    const [media] = await alertasDe('INTENTOS_FALLIDOS', cinco);
    assert.equal(media?.severidad, 'MEDIA');
    assert.equal(media!.evidencia.accesos!.length, 5);
    assert.match(media!.descripcion, new RegExp(`5 intentos fallidos .* ${cinco.correo.replace(/[.+]/g, '\\$&')}`));
    assert.equal((await alertasDe('INTENTOS_FALLIDOS', diez))[0]?.severidad, 'ALTA');
    assert.deepEqual(await alertasDe('INTENTOS_FALLIDOS', cuatro), [], 'cuatro fallos no bastan');
    assert.deepEqual(await alertasDe('INTENTOS_FALLIDOS', espaciados), [], 'separados por 20 minutos no son una ráfaga');
  });

  it('un hallazgo pendiente que crece sube de severidad sin duplicarse', async () => {
    const [antes] = await alertasDe('INTENTOS_FALLIDOS', creciente);
    assert.equal(antes?.severidad, 'MEDIA');
    await fallos(creciente, [0], 'CUENTA_BLOQUEADA');
    assert.equal((await como(admin, 'POST', '/api/admin/alertas/analisis')).json.nuevas, 0);
    const despues = await alertasDe('INTENTOS_FALLIDOS', creciente);
    assert.equal(despues.length, 1);
    assert.equal(despues[0]!.id, antes!.id);
    assert.equal(despues[0]!.severidad, 'ALTA');
    assert.match(despues[0]!.descripcion, /cuenta bloqueada/);
  });

  it('CAMBIO_PRIVILEGIOS: ADMIN es ALTA; DOCENTE directo, MEDIA; DOCENTE al aprobar la solicitud, BAJA', async () => {
    const [deAdmin] = await alertasDe('CAMBIO_PRIVILEGIOS', promovido);
    assert.equal(deAdmin?.severidad, 'ALTA');
    assert.match(deAdmin!.descripcion, /Se concedió el rol ADMIN .* \(lo hizo /);
    assert.equal((await alertasDe('CAMBIO_PRIVILEGIOS', docenteDirecto))[0]?.severidad, 'MEDIA');
    const [porSolicitud] = await alertasDe('CAMBIO_PRIVILEGIOS', aspirante);
    assert.equal(porSolicitud?.severidad, 'BAJA');
    assert.match(porSolicitud!.descripcion, /al aprobar su solicitud de docente/);
    assert.equal(porSolicitud!.evidencia.auditoria!.length, 2, 'el rol y la solicitud aprobada');
  });

  it('RAFAGA_RESENAS y MODIFICACION_MASIVA señalan al actor', async () => {
    const [rafaga] = await alertasDe('RAFAGA_RESENAS', ana);
    assert.equal(rafaga?.severidad, 'MEDIA');
    assert.equal(rafaga!.evidencia.auditoria!.length, 6);
    const [masiva] = await alertasDe('MODIFICACION_MASIVA', docente);
    assert.equal(masiva?.severidad, 'ALTA');
    assert.match(masiva!.descripcion, /3 cambios \(3 borrados\)/);
  });
});

describe('Lote 8 · listado y atención', () => {
  it('lista con filtros y contadores; solo ADMIN', async () => {
    assert.equal((await como(ana, 'GET', '/api/admin/alertas')).status, 403);
    const r = await como(admin, 'GET', '/api/admin/alertas?estado=todas&tipo=CAMBIO_PRIVILEGIOS&severidad=BAJA&limite=50');
    assert.equal(r.status, 200, r.texto);
    assert.ok(r.json.items.every((a: { tipo: string; severidad: string }) => a.tipo === 'CAMBIO_PRIVILEGIOS' && a.severidad === 'BAJA'));
    const deAspirante = r.json.items.find((a: { usuario: { id: number } | null }) => a.usuario?.id === aspirante.idUsuario);
    assert.equal(deAspirante.usuario.correo, aspirante.correo);
    assert.equal(deAspirante.evidencia.auditoria.length, 2);
    assert.deepEqual(deAspirante.evidencia.accesos, []);
    assert.equal(deAspirante.atencion, null);
    assert.ok(r.json.contadores.todas >= r.json.contadores.pendientes);
    assert.equal((await como(admin, 'GET', '/api/admin/alertas?severidad=CRITICA')).status, 400);
  });

  it('«Marcar atendida» guarda quién, cuándo y la nota, queda auditado y no se repite', async () => {
    const [alerta] = await alertasDe('INTENTOS_FALLIDOS', cinco);
    const ruta = `/api/admin/alertas/${alerta!.id}/atencion`;
    assert.equal((await como(ana, 'PUT', ruta, {})).status, 403);
    assert.equal((await como(admin, 'PUT', ruta, { nota: 'x'.repeat(301) })).status, 400);
    assert.equal((await como(admin, 'PUT', '/api/admin/alertas/999999999999/atencion', {})).status, 404);

    const r = await como(admin, 'PUT', ruta, { nota: '  Revisado con la persona.  ' });
    assert.equal(r.status, 200, r.texto);
    assert.equal(r.json.atencion.nota, 'Revisado con la persona.');
    assert.equal(r.json.atencion.por.id, admin.idPersona);
    const otra = await como(admin, 'PUT', ruta, {});
    assert.equal(otra.status, 409);
    assert.equal(otra.json.error.codigo, 'ALERTA_ATENDIDA');

    const pendientes = await como(admin, 'GET', '/api/admin/alertas?tipo=INTENTOS_FALLIDOS&severidad=MEDIA&limite=50');
    assert.ok(!pendientes.json.items.some((a: { id: number }) => a.id === Number(alerta!.id)));
    // La pestaña «Atendidas» la lista, con su contador; las tres cifras cuadran.
    const atendidas = await como(admin, 'GET', '/api/admin/alertas?estado=atendidas&tipo=INTENTOS_FALLIDOS&severidad=MEDIA&limite=50');
    assert.equal(atendidas.status, 200, atendidas.texto);
    assert.ok(atendidas.json.items.some((a: { id: number }) => a.id === Number(alerta!.id)));
    assert.ok(atendidas.json.items.every((a: { atencion: unknown }) => a.atencion !== null));
    const c = atendidas.json.contadores;
    assert.equal(c.pendientes + c.atendidas, c.todas);
    assert.equal(atendidas.json.paginacion.total, c.atendidas);
    // Orden: «antiguas» invierte el de «recientes».
    const recientes = await como(admin, 'GET', '/api/admin/alertas?estado=todas&limite=50');
    const antiguas = await como(admin, 'GET', '/api/admin/alertas?estado=todas&orden=antiguas&limite=50');
    const fechas = (r: typeof recientes) => r.json.items.map((a: { detectadaEn: string }) => a.detectadaEn);
    assert.deepEqual([...fechas(recientes)].sort(), [...fechas(antiguas)].sort());
    assert.ok(fechas(antiguas)[0] <= fechas(antiguas).at(-1));
    assert.equal((await como(admin, 'GET', '/api/admin/alertas?orden=raro')).status, 400);

    const auditoria = await f.query<{ actor: number; columnas: string[] }>(
      `SELECT id_persona_actor AS actor, columnas_cambiadas AS columnas FROM auditoria_cambio
        WHERE tabla = 'alerta_seguridad' AND operacion = 'UPDATE' AND (despues ->> 'id_alerta')::bigint = $1`, [alerta!.id]);
    assert.equal(auditoria.rows.length, 1);
    assert.equal(auditoria.rows[0]!.actor, admin.idPersona);
    assert.ok(auditoria.rows[0]!.columnas.includes('nota'));
  });

  it('la aplicación solo puede leer y marcar como atendida: ni crear, ni borrar, ni cambiar la severidad', async () => {
    const { rows: [p] } = await f.query<Record<string, boolean>>(
      `SELECT has_table_privilege('learnity_app', 'alerta_seguridad', 'INSERT') AS insertar,
              has_table_privilege('learnity_app', 'alerta_seguridad', 'DELETE') AS borrar,
              has_column_privilege('learnity_app', 'alerta_seguridad', 'severidad', 'UPDATE') AS severidad,
              has_column_privilege('learnity_app', 'alerta_seguridad', 'nota', 'UPDATE') AS nota`);
    assert.deepEqual(p, { insertar: false, borrar: false, severidad: false, nota: true });
  });
});
