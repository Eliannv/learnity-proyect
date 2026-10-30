import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { CONTRASENA_PRUEBA, crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

// Lote 7 del panel de administración (migración 037): visor de auditoría, estado de la base y sesiones abiertas.

const marca = crearMarca('s4_aud');
let f: Fixtures;
let srv: Servidor;
let admin: Cuenta;
let otroAdmin: Cuenta;
let estudiante: Cuenta;
let reiniciar: () => void;
let idCategoria = 0;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  ({ reiniciarLimites: reiniciar } = await import('../src/shared/http/limite-peticiones.js'));
  const cuentas = fabricaCuentas(f, srv, marca);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  otroAdmin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  estudiante = await cuentas.crearCuenta(['ESTUDIANTE']);
});

beforeEach(() => reiniciar());

after(async () => {
  await srv?.cerrar();
  if (f) {
    await f.query('DELETE FROM categoria WHERE nombre LIKE $1', [`${marca}%`]);
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
});

const como = (token: string | null, metodo: string, ruta: string, cuerpo?: unknown) =>
  srv.pedir(ruta, { token, metodo, cuerpo });

/** El id de la sesión es su familia, que va en el access token como `sid`. */
const sid = (token: string) => JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()).sid as string;

async function entrar(correo: string, agente: string): Promise<string> {
  const r = await srv.pedir('/api/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena: CONTRASENA_PRUEBA }, headers: { 'user-agent': agente } });
  assert.equal(r.status, 200, r.texto);
  return r.json.accessToken as string;
}

describe('Lote 7 · visor de auditoría', () => {
  it('solo el administrador lo consulta; lista el alta con su clave, su actor y el rol de la base', async () => {
    assert.equal((await como(null, 'GET', '/api/admin/auditoria')).status, 401);
    assert.equal((await como(estudiante.token, 'GET', '/api/admin/auditoria')).status, 403);

    const creada = await como(admin.token, 'POST', '/api/admin/categorias', { nombre: `${marca} Auditada` });
    assert.equal(creada.status, 201, creada.texto);
    idCategoria = creada.json.id;

    const r = await como(admin.token, 'GET', `/api/admin/auditoria?tabla=categoria&operacion=INSERT&actor=${admin.idPersona}`);
    assert.equal(r.status, 200, r.texto);
    const fila = r.json.items[0];
    assert.equal(fila.registro, String(idCategoria));
    assert.equal(fila.actor.id, admin.idPersona);
    assert.equal(fila.actor.correo, admin.correo);
    assert.equal(fila.usuarioBd, 'learnity_app');
    assert.equal(fila.columnasCambiadas, null);
    assert.ok(r.json.paginacion.total >= 1);
  });

  it('el detalle trae la transacción y el antes y después de las columnas que cambiaron', async () => {
    const editada = await como(admin.token, 'PUT', `/api/admin/categorias/${idCategoria}`, {
      nombre: `${marca} Renombrada`, descripcion: 'Con descripción', activa: true,
    });
    assert.equal(editada.status, 200, editada.texto);
    const lista = await como(admin.token, 'GET', `/api/admin/auditoria?tabla=categoria&operacion=UPDATE&actor=${admin.idPersona}&limite=1`);
    const resumen = lista.json.items[0];
    assert.ok(resumen.columnasCambiadas.includes('nombre') && resumen.columnasCambiadas.includes('descripcion'));

    const d = await como(admin.token, 'GET', `/api/admin/auditoria/${resumen.id}`);
    assert.equal(d.status, 200, d.texto);
    assert.equal(d.json.antes.nombre, `${marca} Auditada`);
    assert.equal(d.json.despues.nombre, `${marca} Renombrada`);
    assert.equal(typeof d.json.idTransaccion, 'number');
    assert.equal(d.json.registro, String(idCategoria));

    assert.equal((await como(admin.token, 'GET', '/api/admin/auditoria/999999999999')).status, 404);
    assert.equal((await como(admin.token, 'GET', '/api/admin/auditoria/abc')).status, 400);
  });

  it('nunca muestra datos sensibles ni más de 100 filas, y valida los filtros', async () => {
    // La 020 guarda que la contraseña cambió (columnasCambiadas), pero nunca su valor.
    const usuarios = await como(admin.token, 'GET', '/api/admin/auditoria?tabla=usuario&limite=5');
    assert.equal(usuarios.status, 200, usuarios.texto);
    assert.ok(usuarios.json.items.length > 0);
    for (const fila of usuarios.json.items) {
      const d = await como(admin.token, 'GET', `/api/admin/auditoria/${fila.id}`);
      assert.ok(!('contrasena_hash' in (d.json.antes ?? {})) && !('contrasena_hash' in (d.json.despues ?? {})),
        'sin el hash de la contraseña');
    }
    assert.equal((await como(admin.token, 'GET', '/api/admin/auditoria?limite=101')).status, 400);
    assert.equal((await como(admin.token, 'GET', '/api/admin/auditoria?tabla=Robert%27);DROP')).status, 400);
    assert.equal((await como(admin.token, 'GET', '/api/admin/auditoria?operacion=TRUNCATE')).status, 400);
    assert.equal((await como(admin.token, 'GET', '/api/admin/auditoria?desde=ayer')).status, 400);
    const alReves = await como(admin.token, 'GET',
      `/api/admin/auditoria?desde=${encodeURIComponent('2026-10-02T00:00:00-05:00')}&hasta=${encodeURIComponent('2026-10-01T00:00:00-05:00')}`);
    assert.equal(alReves.status, 400);

    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    const vacio = await como(admin.token, 'GET', `/api/admin/auditoria?desde=${encodeURIComponent(futuro)}`);
    assert.deepEqual(vacio.json, { items: [], paginacion: { total: 0, pagina: 1, limite: 25, totalPaginas: 0 } });

    const hoy = new Date(Date.now() - 3_600_000).toISOString();
    const reciente = await como(admin.token, 'GET',
      `/api/admin/auditoria?tabla=categoria&actor=${admin.idPersona}&desde=${encodeURIComponent(hoy)}&hasta=${encodeURIComponent(futuro)}`);
    assert.ok(reciente.json.items.some((x: { registro: string }) => x.registro === String(idCategoria)));
  });

  it('ofrece tablas, roles de base de datos y actores para los desplegables', async () => {
    const r = await como(admin.token, 'GET', '/api/admin/auditoria/opciones');
    assert.equal(r.status, 200, r.texto);
    assert.ok(r.json.tablas.includes('categoria'));
    assert.ok(r.json.usuariosBd.includes('learnity_app'));
    assert.ok(r.json.actores.some((a: { id: number }) => a.id === admin.idPersona));
    assert.equal((await como(estudiante.token, 'GET', '/api/admin/auditoria/opciones')).status, 403);
  });

  it('la aplicación sigue sin poder leer la tabla de auditoría', async () => {
    const { rows } = await f.query<{ puede: boolean }>(
      "SELECT has_table_privilege('learnity_app', 'auditoria_cambio', 'SELECT') AS puede");
    assert.equal(rows[0]!.puede, false);
  });
});

describe('Lote 7 · estado de la base de datos', () => {
  it('devuelve versión, tamaño, conexiones, arranque y última migración', async () => {
    assert.equal((await como(estudiante.token, 'GET', '/api/admin/base-datos')).status, 403);
    const r = await como(admin.token, 'GET', '/api/admin/base-datos');
    assert.equal(r.status, 200, r.texto);
    assert.match(r.json.version, /^\d+(\.\d+)?/);
    assert.ok(r.json.tamanoBytes > 0);
    assert.ok(r.json.conexiones >= 1);
    assert.ok(Date.parse(r.json.iniciadaEn) < Date.now());
    assert.match(r.json.ultimaMigracion.version, /^0\d\d_/);
    assert.ok(r.json.ultimaMigracion.version >= '037');
  });
});

describe('Lote 7 · sesiones abiertas', () => {
  it('lista las sesiones con cuenta, roles y navegador; marca la propia', async () => {
    await entrar(estudiante.correo, 'NavegadorUno/1.0');
    const lista = await como(admin.token, 'GET', `/api/admin/sesiones?q=${encodeURIComponent(estudiante.correo)}`);
    assert.equal(lista.status, 200, lista.texto);
    assert.equal(lista.json.paginacion.total, 2, 'la de fabricaCuentas y la nueva');
    const s = lista.json.items[0];
    assert.equal(s.usuario.id, estudiante.idUsuario);
    assert.deepEqual(s.usuario.roles, ['ESTUDIANTE']);
    assert.equal(s.agente, 'NavegadorUno/1.0');
    assert.equal(s.actual, false);
    assert.ok(Date.parse(s.expiraEn) > Date.now());

    const propias = await como(admin.token, 'GET', `/api/admin/sesiones?q=${encodeURIComponent(admin.correo)}`);
    assert.ok(propias.json.items.some((x: { id: string; actual: boolean }) => x.id === sid(admin.token) && x.actual));
    assert.equal((await como(estudiante.token, 'GET', '/api/admin/sesiones')).status, 403);
  });

  it('revoca una sesión ajena con el motivo ADMIN: su token deja de valer al momento', async () => {
    const token = await entrar(estudiante.correo, 'NavegadorDos/1.0');
    assert.equal((await como(token, 'GET', '/api/perfil')).status, 200);
    assert.equal((await como(admin.token, 'DELETE', '/api/admin/sesiones/no-es-uuid')).status, 400);
    assert.equal((await como(estudiante.token, 'DELETE', `/api/admin/sesiones/${sid(token)}`)).status, 403);

    assert.equal((await como(admin.token, 'DELETE', `/api/admin/sesiones/${sid(token)}`)).status, 204);
    assert.equal((await como(token, 'GET', '/api/perfil')).status, 401);
    assert.equal((await como(estudiante.token, 'GET', '/api/perfil')).status, 200, 'las demás sesiones siguen abiertas');
    assert.equal((await como(admin.token, 'DELETE', `/api/admin/sesiones/${sid(token)}`)).status, 404);

    const { rows } = await f.query<{ motivo: string }>(
      'SELECT DISTINCT motivo_revocacion AS motivo FROM sesion WHERE familia = $1', [sid(token)]);
    assert.deepEqual(rows.map((x) => x.motivo), ['ADMIN']);
  });

  it('cerrar la propia sesión exige confirmarlo', async () => {
    const ruta = `/api/admin/sesiones/${sid(otroAdmin.token)}`;
    const sinConfirmar = await como(otroAdmin.token, 'DELETE', ruta);
    assert.equal(sinConfirmar.status, 409);
    assert.equal(sinConfirmar.json.error.codigo, 'SESION_PROPIA');
    assert.equal((await como(otroAdmin.token, 'GET', '/api/perfil')).status, 200, 'sigue abierta');

    assert.equal((await como(otroAdmin.token, 'DELETE', `${ruta}?confirmoPropia=true`)).status, 204);
    assert.equal((await como(otroAdmin.token, 'GET', '/api/perfil')).status, 401);
  });
});
