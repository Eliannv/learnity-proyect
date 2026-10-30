// Panel de administración · Lote 1: registro de accesos (migración 032), cuentas bloqueadas y desbloqueo.
import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { CONTRASENA_PRUEBA, crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s4_acc');
let f: Fixtures;
let srv: Servidor;
let fab: ReturnType<typeof fabricaCuentas>;
let admin: Cuenta;
let estudiante: Cuenta;
let reiniciar: () => void;

interface FilaEvento { paso: string; exito: boolean; motivo: string; id_usuario: number | null; correo: string | null; agente: string | null }

/** Eventos registrados para una cuenta (por id) o para un correo escrito, en orden de llegada. */
async function eventos(filtro: { idUsuario?: number; correo?: string }): Promise<FilaEvento[]> {
  const { rows } = await f.query<FilaEvento>(
    `SELECT paso, exito, motivo, id_usuario, correo, agente FROM evento_acceso
      WHERE id_usuario = $1 OR correo = $2 ORDER BY id_evento`,
    [filtro.idUsuario ?? null, filtro.correo ?? null]);
  return rows;
}

const login = (correo: string, contrasena = CONTRASENA_PRUEBA, agente = 'NavegadorDePrueba/1.0') =>
  srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena }, headers: { 'user-agent': agente } });

function sesionNavegador(r: { headers: Headers }) {
  const c = Object.fromEntries(r.headers.getSetCookie().map((x) => [x.split('=')[0]!, x]));
  const rt = c['learnity_rt']!.split(';')[0]!;
  const xsrf = c['XSRF-TOKEN']!.split(';')[0]!;
  return { rt, xsrf, csrf: decodeURIComponent(xsrf.split('=')[1]!) };
}

const refrescar = (s: { rt: string; xsrf: string; csrf: string }) =>
  srv.pedir('/api/auth/refresh', { metodo: 'POST', headers: { cookie: `${s.rt}; ${s.xsrf}`, 'x-xsrf-token': s.csrf } });

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
});

describe('Registro de accesos: paso CLAVE', () => {
  it('registra el éxito con el navegador, y un correo que no existe sin cuenta asociada', async () => {
    const cuenta = await fab.crearCuenta(['ESTUDIANTE'], { sinSesion: true });
    assert.equal((await login(cuenta.correo)).status, 200);
    const desconocido = fab.correo('nadie');
    assert.equal((await login(desconocido)).status, 401);

    const [ok] = await eventos({ idUsuario: cuenta.idUsuario });
    assert.deepEqual(
      { paso: ok!.paso, exito: ok!.exito, motivo: ok!.motivo, correo: ok!.correo, agente: ok!.agente },
      { paso: 'CLAVE', exito: true, motivo: 'OK', correo: cuenta.correo, agente: 'NavegadorDePrueba/1.0' });
    const [fallo] = await eventos({ correo: desconocido });
    assert.equal(fallo!.id_usuario, null);
    assert.equal(fallo!.motivo, 'CORREO_DESCONOCIDO');
    assert.equal(fallo!.exito, false);
  });

  it('cinco contraseñas erróneas bloquean la cuenta: CLAVE_INCORRECTA y después CUENTA_BLOQUEADA', async () => {
    const cuenta = await fab.crearCuenta(['ESTUDIANTE'], { sinSesion: true });
    for (let i = 0; i < 5; i++) assert.equal((await login(cuenta.correo, 'otra-clave-equivocada')).status, 401);
    assert.equal((await login(cuenta.correo)).status, 401, 'bloqueada aunque la contraseña sea correcta');

    const motivos = (await eventos({ idUsuario: cuenta.idUsuario })).map((e) => e.motivo);
    assert.deepEqual(motivos, [...Array(5).fill('CLAVE_INCORRECTA'), 'CUENTA_BLOQUEADA']);
  });

  it('una cuenta desactivada con la contraseña correcta queda como CUENTA_INACTIVA', async () => {
    const cuenta = await fab.crearCuenta(['ESTUDIANTE'], { activo: false });
    assert.equal((await login(cuenta.correo)).status, 403);
    const [e] = await eventos({ idUsuario: cuenta.idUsuario });
    assert.equal(e!.motivo, 'CUENTA_INACTIVA');
  });
});

describe('Registro de accesos: pasos REFRESH y RECUPERACION', () => {
  it('REFRESH: una renovación correcta no se registra; reutilizar el token anterior sí (TOKEN_REUTILIZADO)', async () => {
    const cuenta = await fab.crearCuenta(['ESTUDIANTE'], { sinSesion: true });
    const s1 = sesionNavegador(await login(cuenta.correo));
    assert.equal((await refrescar(s1)).status, 200);
    assert.deepEqual((await eventos({ idUsuario: cuenta.idUsuario })).map((e) => e.paso), ['CLAVE'], 'solo el inicio de sesión');

    // Pasado el margen de pestañas simultáneas, volver a presentar el token rotado es una reutilización.
    await f.query("UPDATE sesion SET reemplazado_en = now() - interval '1 minute' WHERE id_usuario = $1 AND reemplazado_en IS NOT NULL",
      [cuenta.idUsuario]);
    assert.equal((await refrescar(s1)).status, 401);
    const refresh = (await eventos({ idUsuario: cuenta.idUsuario })).filter((e) => e.paso === 'REFRESH');
    assert.deepEqual(refresh.map((e) => [e.exito, e.motivo]), [[false, 'TOKEN_REUTILIZADO']]);
  });

  it('REFRESH sin cookie no se registra (cualquier visitante anónimo)', async () => {
    const agente = `Anonimo/${marca}`;
    const r = await srv.pedir('/api/auth/refresh', { metodo: 'POST', headers: { 'user-agent': agente } });
    assert.notEqual(r.status, 200);
    const { rows: [registrados] } = await f.query<{ n: number }>('SELECT count(*)::int AS n FROM evento_acceso WHERE agente = $1', [agente]);
    assert.equal(registrados!.n, 0);
  });

  it('RECUPERACION: un enlace inválido queda como TOKEN_INVALIDO y uno válido como OK', async () => {
    const { generarTokenOpaco, hashToken } = await import('../src/shared/auth/tokens.js');
    const cuenta = await fab.crearCuenta(['ESTUDIANTE'], { sinSesion: true });
    const invalido = generarTokenOpaco();
    const agente = `Recuperacion/${marca}`;
    const r1 = await srv.pedir('/api/auth/restablecer', {
      metodo: 'POST', cuerpo: { token: invalido, contrasena: 'una frase nueva bastante larga 2026' }, headers: { 'user-agent': agente } });
    assert.equal(r1.status, 400);
    const { rows: invalidos } = await f.query<FilaEvento>(
      'SELECT paso, exito, motivo, id_usuario FROM evento_acceso WHERE agente = $1', [agente]);
    assert.deepEqual(invalidos.map((e) => [e.paso, e.motivo, e.id_usuario]), [['RECUPERACION', 'TOKEN_INVALIDO', null]]);
    await f.query('DELETE FROM evento_acceso WHERE agente = $1', [agente]); // sin cuenta ni correo: la marca no lo limpia

    const token = generarTokenOpaco();
    await f.query("INSERT INTO token_recuperacion (id_usuario, token_hash, expira_en) VALUES ($1, $2, now() + interval '10 minutes')",
      [cuenta.idUsuario, hashToken(token)]);
    const r2 = await srv.pedir('/api/auth/restablecer', { metodo: 'POST', cuerpo: { token, contrasena: 'una frase nueva bastante larga 2026' } });
    assert.equal(r2.status, 200, r2.texto);
    const propios = await eventos({ idUsuario: cuenta.idUsuario });
    assert.deepEqual(propios.map((e) => [e.paso, e.exito, e.motivo]), [['RECUPERACION', true, 'OK']]);
  });
});

describe('Administración: GET /admin/accesos y cuentas bloqueadas', () => {
  it('solo un administrador puede consultarlos (403 para un estudiante, 401 sin sesión)', async () => {
    assert.equal((await srv.pedir('/api/admin/accesos', { token: estudiante.token })).status, 403);
    assert.equal((await srv.pedir('/api/admin/accesos/bloqueadas', { token: estudiante.token })).status, 403);
    assert.equal((await srv.pedir('/api/admin/accesos')).status, 401);
    assert.equal((await srv.pedir(`/api/admin/usuarios/${estudiante.idUsuario}/bloqueo`, { metodo: 'DELETE', token: estudiante.token })).status, 403);
  });

  it('lista los accesos más recientes primero, filtra por texto y por "fallidos", con paginación', async () => {
    const cuenta = await fab.crearCuenta(['ESTUDIANTE'], { sinSesion: true });
    await login(cuenta.correo, 'clave-equivocada');
    await login(cuenta.correo);

    const todos = await srv.pedir(`/api/admin/accesos?q=${encodeURIComponent(cuenta.correo)}`, { token: admin.token });
    assert.equal(todos.status, 200);
    assert.deepEqual(todos.json.items.map((e: { motivo: string }) => e.motivo), ['OK', 'CLAVE_INCORRECTA']);
    const [primero] = todos.json.items;
    assert.deepEqual(Object.keys(primero).sort(), ['agente', 'correo', 'exito', 'fecha', 'id', 'motivo', 'paso', 'usuario']);
    assert.deepEqual(primero.usuario, { id: cuenta.idUsuario, nombre: `${marca} estudiante` });
    assert.deepEqual(todos.json.paginacion, { total: 2, pagina: 1, limite: 20, totalPaginas: 1 });

    const fallidos = await srv.pedir(`/api/admin/accesos?resultado=fallidos&q=${encodeURIComponent(cuenta.correo)}`, { token: admin.token });
    assert.deepEqual(fallidos.json.items.map((e: { exito: boolean }) => e.exito), [false]);

    const pagina2 = await srv.pedir(`/api/admin/accesos?q=${encodeURIComponent(cuenta.correo)}&limite=1&pagina=2`, { token: admin.token });
    assert.deepEqual(pagina2.json.items.map((e: { motivo: string }) => e.motivo), ['CLAVE_INCORRECTA']);
    assert.equal(pagina2.json.paginacion.totalPaginas, 2);
  });

  it('el texto buscado se toma literalmente: "%" no lo encuentra todo', async () => {
    const r = await srv.pedir('/api/admin/accesos?q=%25', { token: admin.token });
    assert.equal(r.status, 200);
    assert.equal(r.json.items.length, 0);
  });

  it('rechaza filtros desconocidos o fuera de rango (400)', async () => {
    assert.equal((await srv.pedir('/api/admin/accesos?resultado=exitosos', { token: admin.token })).status, 400);
    assert.equal((await srv.pedir('/api/admin/accesos?limite=101', { token: admin.token })).status, 400);
    assert.equal((await srv.pedir('/api/admin/accesos?ip=1.2.3.4', { token: admin.token })).status, 400);
  });

  it('una cuenta bloqueada aparece en la lista; al desbloquearla sale, entra de nuevo y la auditoría guarda al administrador', async () => {
    const cuenta = await fab.crearCuenta(['ESTUDIANTE'], { sinSesion: true });
    for (let i = 0; i < 5; i++) await login(cuenta.correo, 'otra-clave-equivocada');

    const lista = await srv.pedir('/api/admin/accesos/bloqueadas', { token: admin.token });
    assert.equal(lista.status, 200);
    const fila = lista.json.items.find((c: { idUsuario: number }) => c.idUsuario === cuenta.idUsuario);
    assert.ok(fila, 'la cuenta bloqueada está en la lista');
    assert.equal(fila.intentosFallidos, 5);
    assert.ok(new Date(fila.bloqueadoHasta) > new Date());

    const r = await srv.pedir(`/api/admin/usuarios/${cuenta.idUsuario}/bloqueo`, { metodo: 'DELETE', token: admin.token });
    assert.equal(r.status, 204);
    const despues = await srv.pedir('/api/admin/accesos/bloqueadas', { token: admin.token });
    assert.ok(!despues.json.items.some((c: { idUsuario: number }) => c.idUsuario === cuenta.idUsuario));
    assert.equal((await login(cuenta.correo)).status, 200, 'entra con su contraseña');

    const { rows: [audit] } = await f.query<{ actor: number; columnas: string[] }>(
      `SELECT id_persona_actor AS actor, columnas_cambiadas AS columnas FROM auditoria_cambio
        WHERE tabla = 'usuario' AND operacion = 'UPDATE' AND (despues ->> 'id_usuario')::int = $1
          AND despues ->> 'bloqueado_hasta' IS NULL AND antes ->> 'bloqueado_hasta' IS NOT NULL
        ORDER BY id_auditoria LIMIT 1`, [cuenta.idUsuario]);
    assert.equal(audit?.actor, admin.idPersona);
    assert.ok(audit.columnas.includes('bloqueado_hasta') && audit.columnas.includes('intentos_fallidos'));
  });

  it('desbloquear una cuenta que no existe responde 404; una que no estaba bloqueada, 204', async () => {
    assert.equal((await srv.pedir('/api/admin/usuarios/2147483647/bloqueo', { metodo: 'DELETE', token: admin.token })).status, 404);
    assert.equal((await srv.pedir(`/api/admin/usuarios/${estudiante.idUsuario}/bloqueo`, { metodo: 'DELETE', token: admin.token })).status, 204);
  });
});
