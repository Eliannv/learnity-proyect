import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { CONTRASENA_PRUEBA, crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s4_usr');
let f: Fixtures;
let srv: Servidor;
let admin: Cuenta;
let estudiante: Cuenta;
let docente: Cuenta;

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  estudiante = await cuentas.crearCuenta(['ESTUDIANTE']);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
});

after(async () => {
  try {
    await limpiarMarca(f, marca);
    await srv?.cerrar();
    await f?.cerrar();
  } catch {
    // Limpieza de prueba
  }
});

describe('Sprint 4 · Gestión administrativa de usuarios (RF-21)', () => {
  it('un estudiante no puede acceder a las rutas de gestión de usuarios (403)', async () => {
    const rListar = await srv.pedir('/api/admin/usuarios', {
      token: estudiante.token,
    });
    assert.equal(rListar.status, 403);

    const rEstado = await srv.pedir(`/api/admin/usuarios/${estudiante.idUsuario}/estado`, {
      metodo: 'PUT',
      token: estudiante.token,
      cuerpo: { estado: 'INACTIVO' },
    });
    assert.equal(rEstado.status, 403);

    const rRoles = await srv.pedir(`/api/admin/usuarios/${estudiante.idUsuario}/roles`, {
      metodo: 'PUT',
      token: estudiante.token,
      cuerpo: { roles: ['ESTUDIANTE', 'ADMIN'] },
    });
    assert.equal(rRoles.status, 403);
  });

  it('un administrador lista usuarios con conteos y paginación real', async () => {
    const res = await srv.pedir('/api/admin/usuarios', {
      token: admin.token,
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.json.items));
    assert.ok(res.json.items.length >= 3);

    // Comprobar paginación
    assert.ok(res.json.paginacion);
    assert.equal(typeof res.json.paginacion.total, 'number');
    assert.equal(res.json.paginacion.pagina, 1);
    assert.equal(res.json.paginacion.limite, 20);

    // Comprobar conteos
    assert.ok(res.json.conteos);
    assert.ok(res.json.conteos.total >= 3);
    assert.ok(res.json.conteos.estudiantes >= 3);
    assert.ok(res.json.conteos.administradores >= 1);
    assert.ok(res.json.conteos.docentes >= 1);
  });

  it('filtra usuarios por rol', async () => {
    const resDocentes = await srv.pedir('/api/admin/usuarios?rol=DOCENTE', {
      token: admin.token,
    });
    assert.equal(resDocentes.status, 200);
    const docentes = resDocentes.json.items;
    assert.ok(docentes.every((u: any) => u.roles.includes('DOCENTE')));
    assert.ok(docentes.some((u: any) => u.id === docente.idUsuario));
  });

  it('filtra usuarios por búsqueda de texto (q)', async () => {
    const correoEst = estudiante.correo;
    const res = await srv.pedir(`/api/admin/usuarios?q=${encodeURIComponent(correoEst)}`, {
      token: admin.token,
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.items.length, 1);
    assert.equal(res.json.items[0].id, estudiante.idUsuario);
  });

  it('un administrador desactiva y reactiva una cuenta de usuario', async () => {
    // Desactivar estudiante
    const resDesactivar = await srv.pedir(`/api/admin/usuarios/${estudiante.idUsuario}/estado`, {
      metodo: 'PUT',
      token: admin.token,
      cuerpo: { estado: 'INACTIVO' },
    });
    assert.equal(resDesactivar.status, 200);
    assert.equal(resDesactivar.json.estado, 'INACTIVO');
    assert.equal(resDesactivar.json.activo, false);

    // Intentar login con la cuenta inactiva (debe dar 403 CUENTA_INACTIVA)
    const resLogin = await srv.pedir('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: estudiante.correo, contrasena: CONTRASENA_PRUEBA },
    });
    assert.equal(resLogin.status, 403);
    assert.equal(resLogin.json.error.codigo, 'CUENTA_INACTIVA');

    // Reactivar estudiante
    const resReactivar = await srv.pedir(`/api/admin/usuarios/${estudiante.idUsuario}/estado`, {
      metodo: 'PUT',
      token: admin.token,
      cuerpo: { activo: true },
    });
    assert.equal(resReactivar.status, 200);
    assert.equal(resReactivar.json.estado, 'ACTIVO');
    assert.equal(resReactivar.json.activo, true);

    // Login funciona de nuevo
    const resLogin2 = await srv.pedir('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: estudiante.correo, contrasena: CONTRASENA_PRUEBA },
    });
    assert.equal(resLogin2.status, 200);
  });

  it('un administrador no puede desactivarse a sí mismo (400)', async () => {
    const res = await srv.pedir(`/api/admin/usuarios/${admin.idUsuario}/estado`, {
      metodo: 'PUT',
      token: admin.token,
      cuerpo: { estado: 'INACTIVO' },
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error.mensaje, /propia cuenta/i);
  });

  it('un administrador asigna y retira el rol DOCENTE a un estudiante', async () => {
    // Asignar rol DOCENTE
    const resAgregar = await srv.pedir(`/api/admin/usuarios/${estudiante.idUsuario}/roles`, {
      metodo: 'PUT',
      token: admin.token,
      cuerpo: { roles: ['ESTUDIANTE', 'DOCENTE'] },
    });
    assert.equal(resAgregar.status, 200);
    assert.ok(resAgregar.json.roles.includes('DOCENTE'));
    assert.ok(resAgregar.json.roles.includes('ESTUDIANTE'));

    // Verificar en base de datos que se haya activado en tabla docente
    const { rows: docenteRows } = await f.query<{ estado: string }>(
      'SELECT estado FROM docente WHERE id_persona = $1',
      [estudiante.idPersona],
    );
    assert.equal(docenteRows[0]?.estado, 'ACTIVO');

    // Retirar rol DOCENTE
    const resQuitar = await srv.pedir(`/api/admin/usuarios/${estudiante.idUsuario}/roles`, {
      metodo: 'PUT',
      token: admin.token,
      cuerpo: { roles: ['ESTUDIANTE'] },
    });
    assert.equal(resQuitar.status, 200);
    assert.equal(resQuitar.json.roles.includes('DOCENTE'), false);
    assert.ok(resQuitar.json.roles.includes('ESTUDIANTE'));
  });

  it('un administrador no puede quitarse el rol ADMIN a sí mismo (400)', async () => {
    const res = await srv.pedir(`/api/admin/usuarios/${admin.idUsuario}/roles`, {
      metodo: 'PUT',
      token: admin.token,
      cuerpo: { roles: ['ESTUDIANTE'] },
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error.mensaje, /Administrador a ti mismo/i);
  });
});
