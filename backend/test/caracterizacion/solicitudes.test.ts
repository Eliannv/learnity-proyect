// Caracterización de las solicitudes para ser docente (CAR-SOL-01..13).
// Los límites por IP viven en memoria del proceso de la app: se reinician con reiniciarLimites() entre grupos.
import '../ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { crearFixtures, type Fixtures } from '../ayudas/bd-fixtures.js';
import { errorIdInvalido, forma, ID_DEMASIADO_GRANDE, ID_NO_DECIMAL, IDS_NO_DECIMALES } from '../ayudas/contrato.js';
import { crearMarca } from '../ayudas/datos.js';
import { iniciarServidor, type Servidor } from '../ayudas/servidor.js';
import { fabricaCuentas, iniciarSesion, limpiarMarca, type Cuenta } from '../ayudas/sesiones.js';

const marca = crearMarca('car_sol');
const MOTIVO = 'Quiero compartir mi experiencia enseñando programación a estudiantes nuevos cada semana.';

let f: Fixtures;
let srv: Servidor;
let fab: ReturnType<typeof fabricaCuentas>;
let admin: Cuenta;
let reiniciar: () => void;
const FORMA_SOLICITUD = {
  id: 'number', estado: 'string', especialidad: 'string', motivo: 'string', observacion: 'null', enviadaEn: 'string', revisadaEn: 'null',
  solicitante: { nombres: 'string', apellidos: 'string', correo: 'string', estudianteDesde: 'string', cursosCompletados: 'number' },
};

const como = (c: Cuenta, metodo: string, ruta: string, cuerpo?: unknown) => srv.pedir(ruta, { token: c.token, metodo, cuerpo });
const solicitar = (c: Cuenta, extra: Record<string, unknown> = {}) =>
  como(c, 'POST', '/api/solicitudes-docente', { especialidad: 'Programación', motivo: MOTIVO, ...extra });
const estudiante = () => fab.crearCuenta(['ESTUDIANTE']);

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  ({ reiniciarLimites: reiniciar } = await import('../../src/shared/http/limite-peticiones.js'));
  fab = fabricaCuentas(f, srv, marca);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
});

describe('AUT de solicitudes', () => {
  it('sin token 401; /mia sin autorizar por rol; POST solo ESTUDIANTE; admin solo ADMIN', async () => {
    for (const [m, r] of [['GET', '/api/solicitudes-docente/mia'], ['POST', '/api/solicitudes-docente'], ['GET', '/api/admin/solicitudes'], ['PUT', '/api/admin/solicitudes/1']]) {
      const x = await srv.pedir(r!, { metodo: m!, cuerpo: m === 'GET' ? undefined : {} });
      assert.equal(x.status, 401, r);
      assert.equal(x.json.error.codigo, 'NO_AUTENTICADO');
    }
    const est = await estudiante();
    for (const [m, r] of [['GET', '/api/admin/solicitudes'], ['PUT', '/api/admin/solicitudes/1']]) {
      const x = await como(est, m!, r!, m === 'GET' ? undefined : {});
      assert.equal(x.status, 403, r);
      assert.equal(x.json.error.codigo, 'SIN_PERMISO');
    }
  });
});

describe('GET /mia y POST (CAR-SOL-01..06, 13)', () => {
  it('CAR-SOL-01 y 02: sin solicitudes y con una pendiente; DOCENTE y ADMIN también reciben 200', async () => {
    const est = await estudiante();
    const vacia = await como(est, 'GET', '/api/solicitudes-docente/mia');
    assert.equal(vacia.status, 200);
    assert.deepEqual(vacia.json, { solicitud: null });
    const creada = await solicitar(est);
    assert.equal(creada.status, 201, creada.texto);
    assert.deepEqual(forma(creada.json), FORMA_SOLICITUD);
    assert.equal(creada.json.estado, 'PENDIENTE');
    const mia = await como(est, 'GET', '/api/solicitudes-docente/mia');
    assert.equal(mia.status, 200);
    assert.deepEqual(forma(mia.json), { solicitud: FORMA_SOLICITUD });
    const doc = await fab.crearCuenta(['DOCENTE']);
    assert.equal((await como(doc, 'GET', '/api/solicitudes-docente/mia')).status, 200);
    assert.equal((await como(admin, 'GET', '/api/solicitudes-docente/mia')).status, 200);
  });

  it('CAR-SOL-04: pendiente repetida y ya docente', async () => {
    const est = await estudiante();
    assert.equal((await solicitar(est)).status, 201);
    const otra = await solicitar(est);
    assert.equal(otra.status, 409);
    assert.equal(otra.json.error.codigo, 'SOLICITUD_PENDIENTE');
    assert.equal(otra.json.error.mensaje, 'Ya tienes una solicitud pendiente de revisión.');
    const docEst = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
    const ya = await solicitar(docEst);
    assert.equal(ya.status, 409);
    assert.equal(ya.json.error.codigo, 'YA_ES_DOCENTE');
  });

  it('CAR-SOL-13 (C-03): DOCENTE sin ESTUDIANTE y ADMIN sin ESTUDIANTE -> 403 SIN_PERMISO', async () => {
    const soloDoc = await fab.crearCuenta(['DOCENTE']);
    const soloAdmin = await fab.crearCuenta(['ADMIN']);
    for (const c of [soloDoc, soloAdmin]) {
      const r = await solicitar(c);
      assert.equal(r.status, 403);
      assert.equal(r.json.error.codigo, 'SIN_PERMISO');
    }
  });

  it('CAR-SOL-05: límites de especialidad y motivo', async () => {
    reiniciar();
    const est = await estudiante();
    const malos: Array<Record<string, unknown>> = [
      { especialidad: 'ab' }, { especialidad: 'x'.repeat(101) }, { motivo: 'x'.repeat(49) }, { motivo: 'x'.repeat(2001) }, { extra: 1 },
    ];
    for (const m of malos) {
      const r = await solicitar(est, m);
      assert.equal(r.status, 400, JSON.stringify(m).slice(0, 40));
      assert.equal(r.json.error.codigo, 'SOLICITUD_INVALIDA');
    }
    const limites = await solicitar(est, { especialidad: 'abc', motivo: 'x'.repeat(50) });
    assert.equal(limites.status, 201);
    const est2 = await estudiante();
    assert.equal((await solicitar(est2, { especialidad: 'x'.repeat(100), motivo: 'x'.repeat(2000) })).status, 201);
  });

  it('CAR-SOL-06: dos envíos simultáneos dejan una sola pendiente; el 11.º envío -> 429', async () => {
    reiniciar();
    const est = await estudiante();
    const [a, b] = await Promise.all([solicitar(est), solicitar(est)]);
    assert.deepEqual([a.status, b.status].sort(), [201, 409]);
    assert.equal((a.status === 409 ? a : b).json.error.codigo, 'SOLICITUD_PENDIENTE');
    const { rows } = await f.query("SELECT count(*)::int AS n FROM solicitud_docente WHERE id_persona = $1 AND estado = 'PENDIENTE'", [est.idPersona]);
    assert.equal(rows[0]!.n, 1);
    reiniciar();
    const otro = await estudiante();
    let ultimo = 0;
    let cuerpo: any;
    for (let i = 0; i < 11; i++) {
      const r = await solicitar(otro);
      ultimo = r.status;
      cuerpo = r;
    }
    assert.equal(ultimo, 429);
    assert.equal(cuerpo.json.error.codigo, 'DEMASIADAS_PETICIONES');
    assert.ok(Number(cuerpo.headers.get('retry-after')) > 0);
    reiniciar();
  });
});

describe('Administración de solicitudes (CAR-SOL-07..12)', () => {
  it('CAR-SOL-07 y 08: lista y filtro', async () => {
    reiniciar();
    const est = await estudiante();
    await solicitar(est);
    const r = await como(admin, 'GET', '/api/admin/solicitudes');
    assert.equal(r.status, 200);
    assert.deepEqual(forma(r.json), [FORMA_SOLICITUD]);
    for (const estado of ['APROBADA', 'RECHAZADA', 'PENDIENTE']) {
      assert.equal((await como(admin, 'GET', `/api/admin/solicitudes?estado=${estado}`)).status, 200, estado);
    }
    for (const qs of ['?estado=OTRO', '?extra=1']) {
      const x = await como(admin, 'GET', `/api/admin/solicitudes${qs}`);
      assert.equal(x.status, 400, qs);
      assert.equal(x.json.error.codigo, 'SOLICITUD_INVALIDA');
      assert.equal(x.json.error.mensaje, 'Revisa los datos enviados.');
    }
    const e = await como(admin, 'GET', '/api/admin/solicitudes?estado=OTRO');
    assert.equal(e.json.error.detalles[0].campo, 'estado');
  });

  async function pendiente(): Promise<{ est: Cuenta; id: number }> {
    reiniciar();
    const est = await estudiante();
    const r = await solicitar(est);
    assert.equal(r.status, 201, r.texto);
    const { rows } = await f.query<{ id: number }>("SELECT id_solicitud AS id FROM solicitud_docente WHERE id_persona = $1 AND estado = 'PENDIENTE'", [est.idPersona]);
    return { est, id: rows[0]!.id };
  }

  it('CAR-SOL-09 y 12 (ADR-011, 11.10): APROBAR asigna DOCENTE y crea perfil; el rol aplica de inmediato en la sesión vigente', async () => {
    const { est, id } = await pendiente();
    const r = await como(admin, 'PUT', `/api/admin/solicitudes/${id}`, { decision: 'APROBAR' });
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual(Object.keys(r.json), Object.keys(FORMA_SOLICITUD));
    assert.equal(r.json.estado, 'APROBADA');
    const roles = await f.query("SELECT r.nombre FROM usuario_rol ur JOIN rol r USING (id_rol) WHERE ur.id_usuario = $1 ORDER BY 1", [est.idUsuario]);
    assert.deepEqual(roles.rows.map((x) => x.nombre), ['DOCENTE', 'ESTUDIANTE']);
    const docente = await f.query('SELECT count(*)::int AS n FROM docente WHERE id_persona = $1', [est.idPersona]);
    assert.equal(docente.rows[0]!.n, 1);
    const viejo = await como(est, 'GET', '/api/docente/cursos');
    assert.equal(viejo.status, 200, 'ADR-011 11.10: el token vigente lee el nuevo rol DOCENTE desde la sesión');
    const nuevo = await iniciarSesion(srv, est.correo);
    assert.equal((await srv.pedir('/api/docente/cursos', { token: nuevo })).status, 200);
  });

  it('CAR-SOL-10: RECHAZAR exige observación de 1 a 300 caracteres', async () => {
    const { id } = await pendiente();
    const ruta = `/api/admin/solicitudes/${id}`;
    for (const cuerpo of [{ decision: 'RECHAZAR' }, { decision: 'RECHAZAR', observacion: '   ' }, { decision: 'RECHAZAR', observacion: 'x'.repeat(301) }, { decision: 'APROBAR', extra: 1 }, { decision: 'OTRA' }]) {
      assert.equal((await como(admin, 'PUT', ruta, cuerpo)).status, 400, JSON.stringify(cuerpo).slice(0, 50));
    }
    assert.equal((await como(admin, 'PUT', ruta, { decision: 'RECHAZAR', observacion: 'x'.repeat(300) })).status, 200);
  });

  it('CAR-SOL-11: ya revisada, la propia, inexistente y dos administradores a la vez', async () => {
    const { id } = await pendiente();
    const ruta = `/api/admin/solicitudes/${id}`;
    const [a, b] = await Promise.all([
      como(admin, 'PUT', ruta, { decision: 'RECHAZAR', observacion: 'No cumple' }),
      como(admin, 'PUT', ruta, { decision: 'RECHAZAR', observacion: 'No cumple' }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const perdedora = a.status === 409 ? a : b;
    assert.equal(perdedora.json.error.codigo, 'SOLICITUD_YA_REVISADA');
    assert.equal(perdedora.json.error.mensaje, 'Esta solicitud ya fue revisada. Actualiza la lista.');
    const inex = await como(admin, 'PUT', '/api/admin/solicitudes/2147483647', { decision: 'APROBAR' });
    assert.equal(inex.status, 404);
    assert.equal(inex.json.error.mensaje, 'La solicitud no existe.');
    // La suya propia: un administrador con ESTUDIANTE que solicita
    reiniciar();
    const propia = await solicitar(admin);
    assert.equal(propia.status, 201, 'un ADMIN con rol ESTUDIANTE puede solicitar');
    {
      const { rows } = await f.query<{ id: number }>("SELECT id_solicitud AS id FROM solicitud_docente WHERE id_persona = $1 AND estado = 'PENDIENTE'", [admin.idPersona]);
      const r = await como(admin, 'PUT', `/api/admin/solicitudes/${rows[0]!.id}`, { decision: 'APROBAR' });
      assert.equal(r.status, 403);
      assert.equal(r.json.error.mensaje, 'No puedes decidir tu propia solicitud.');
    }
  });

  it('ID-1, ID-2 e ID-4 (ADR-011, 11.11): id inválido -> 400 con detalle del campo id', async () => {
    for (const v of IDS_NO_DECIMALES) {
      const x = await como(admin, 'PUT', `/api/admin/solicitudes/${v}`, { decision: 'APROBAR' });
      assert.equal(x.status, 400, v);
      assert.deepEqual(x.json, errorIdInvalido(ID_NO_DECIMAL), v);
    }
    const grande = await como(admin, 'PUT', '/api/admin/solicitudes/2147483648', { decision: 'APROBAR' });
    assert.equal(grande.status, 400);
    assert.deepEqual(grande.json, errorIdInvalido(ID_DEMASIADO_GRANDE));
  });
});
