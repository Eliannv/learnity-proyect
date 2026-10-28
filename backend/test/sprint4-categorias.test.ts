import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { fabricaCursos } from './ayudas/cursos-http.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s4_cat');
let f: Fixtures;
let srv: Servidor;
let admin: Cuenta;
let docente: Cuenta;
let estudiante: Cuenta;
let idCategoria = 0;

const como = (c: Cuenta | null, metodo: string, ruta: string, cuerpo?: unknown) =>
  srv.pedir(ruta, { token: c?.token, metodo, cuerpo });

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const cuentas = fabricaCuentas(f, srv, marca);
  admin = await cuentas.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  docente = await cuentas.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  estudiante = await cuentas.crearCuenta(['ESTUDIANTE']);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
});

describe('Sprint 4 · CRUD de categorías del administrador (ADR-012)', () => {
  it('exige sesión y rol ADMIN', async () => {
    assert.equal((await como(null, 'GET', '/api/admin/categorias')).status, 401);
    for (const quien of [estudiante, docente]) {
      assert.equal((await como(quien, 'GET', '/api/admin/categorias')).status, 403);
      assert.equal((await como(quien, 'POST', '/api/admin/categorias', { nombre: `${marca} X` })).status, 403);
    }
  });

  it('crea una categoría activa, normaliza el texto y rechaza duplicados sin distinguir mayúsculas', async () => {
    const creada = await como(admin, 'POST', '/api/admin/categorias', {
      nombre: `  ${marca} Diseño  `, descripcion: '   ',
    });
    assert.equal(creada.status, 201, creada.texto);
    idCategoria = creada.json.id;
    assert.deepEqual(creada.json, {
      id: idCategoria, nombre: `${marca} Diseño`, descripcion: null, activa: true, cursos: 0, cursosPublicados: 0,
    });

    const repetida = await como(admin, 'POST', '/api/admin/categorias', { nombre: `${marca} DISEÑO` });
    assert.equal(repetida.status, 409, repetida.texto);
    assert.equal(repetida.json.error.codigo, 'CATEGORIA_DUPLICADA');

    for (const malo of [{ nombre: '' }, { nombre: 'x'.repeat(81) }, { nombre: 'a\u0000b' }, { nombre: 'ok', extra: 1 }]) {
      assert.equal((await como(admin, 'POST', '/api/admin/categorias', malo)).status, 400, JSON.stringify(malo));
    }
    assert.equal((await como(admin, 'GET', '/api/admin/categorias?x=1')).status, 400);
  });

  it('lista activas e inactivas con sus cursos; desactivar la retira del selector público', async () => {
    const c = fabricaCursos(srv, marca, () => idCategoria);
    await c.crearCurso(docente);

    const lista = await como(admin, 'GET', '/api/admin/categorias');
    assert.equal(lista.status, 200);
    const fila = lista.json.find((x: { id: number }) => x.id === idCategoria);
    assert.equal(fila.cursos, 1);
    assert.equal(fila.cursosPublicados, 0);

    const editada = await como(admin, 'PUT', `/api/admin/categorias/${idCategoria}`, {
      nombre: `${marca} Diseño UX`, descripcion: 'Interfaces', activa: false,
    });
    assert.equal(editada.status, 200, editada.texto);
    assert.equal(editada.json.activa, false);
    assert.equal(editada.json.descripcion, 'Interfaces');

    const publicas = await srv.pedir('/api/categorias');
    assert.ok(!publicas.json.some((x: { id: number }) => x.id === idCategoria));
    const sigueEnAdmin = await como(admin, 'GET', '/api/admin/categorias');
    assert.ok(sigueEnAdmin.json.some((x: { id: number; activa: boolean }) => x.id === idCategoria && !x.activa));

    // Un curso nuevo no puede usar una categoría inactiva.
    const curso = await como(docente, 'POST', '/api/cursos', c.datosCurso('inactiva'));
    assert.equal(curso.status, 400, curso.texto);

    const reactivada = await como(admin, 'PUT', `/api/admin/categorias/${idCategoria}`, {
      nombre: `${marca} Diseño UX`, activa: true,
    });
    assert.equal(reactivada.status, 200);
    assert.equal(reactivada.json.descripcion, null);
  });

  it('renombrar a un nombre ocupado da 409 y un id inexistente da 404', async () => {
    const otra = await como(admin, 'POST', '/api/admin/categorias', { nombre: `${marca} Datos` });
    assert.equal(otra.status, 201);
    const choque = await como(admin, 'PUT', `/api/admin/categorias/${otra.json.id}`, {
      nombre: `${marca} diseño ux`, activa: true,
    });
    assert.equal(choque.status, 409);
    assert.equal((await como(admin, 'PUT', '/api/admin/categorias/2000000000', {
      nombre: `${marca} Nada`, activa: true,
    })).status, 404);
    assert.equal((await como(admin, 'PUT', '/api/admin/categorias/007', { nombre: 'x', activa: true })).status, 400);
  });
});
