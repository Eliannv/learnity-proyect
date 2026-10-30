// Panel de administración · Lote 5: ícono de la categoría (migración 035) y reasignación de cursos al desactivarla.
import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { crearFixtures, type Fixtures } from './ayudas/bd-fixtures.js';
import { crearMarca } from './ayudas/datos.js';
import { iniciarServidor, type Servidor } from './ayudas/servidor.js';
import { fabricaCuentas, limpiarMarca, type Cuenta } from './ayudas/sesiones.js';

const marca = crearMarca('s4_icono');
let f: Fixtures;
let srv: Servidor;
let admin: Cuenta;
let docente: Cuenta;
let alumna: Cuenta;

const crear = (cuerpo: object, token = admin.token) => srv.pedir('/api/admin/categorias', { metodo: 'POST', token, cuerpo });
const editar = (id: number, cuerpo: object, token = admin.token) =>
  srv.pedir(`/api/admin/categorias/${id}`, { metodo: 'PUT', token, cuerpo });

async function curso(idCategoria: number, titulo: string, publicado: boolean): Promise<number> {
  const { rows: [c] } = await f.query<{ id: number }>(
    publicado
      ? `INSERT INTO curso (id_docente, id_categoria, titulo, estado, revisado_por, publicado_en)
         VALUES ($1, $2, $3, 'PUBLICADO', $4, now()) RETURNING id_curso AS id`
      : 'INSERT INTO curso (id_docente, id_categoria, titulo) VALUES ($1, $2, $3) RETURNING id_curso AS id',
    publicado ? [docente.idDocente, idCategoria, titulo, admin.idPersona] : [docente.idDocente, idCategoria, titulo]);
  return c!.id;
}

before(async () => {
  f = await crearFixtures();
  srv = await iniciarServidor();
  const fab = fabricaCuentas(f, srv, marca);
  admin = await fab.crearCuenta(['ESTUDIANTE', 'ADMIN']);
  docente = await fab.crearCuenta(['ESTUDIANTE', 'DOCENTE']);
  alumna = await fab.crearCuenta(['ESTUDIANTE']);
});

after(async () => {
  await srv?.cerrar();
  if (f) {
    await limpiarMarca(f, marca);
    await f.cerrar();
  }
});

describe('Ícono de la categoría', () => {
  it('se elige al crear; sin él queda el genérico; uno fuera de la lista se rechaza', async () => {
    const conIcono = await crear({ nombre: `${marca} Arte`, icono: 'palette' });
    assert.equal(conIcono.status, 201, conIcono.texto);
    assert.equal(conIcono.json.icono, 'palette');
    const sinIcono = await crear({ nombre: `${marca} Varios` });
    assert.equal(sinIcono.json.icono, 'tags');

    const malo = await crear({ nombre: `${marca} Malo`, icono: 'no-existe' });
    assert.equal(malo.status, 400);
    assert.ok(malo.json.error.detalles.some((d: { campo: string }) => d.campo === 'icono'));
    // Un nombre de Lucide válido pero no ofrecido para categorías (p. ej. una flecha) tampoco se acepta.
    assert.equal((await crear({ nombre: `${marca} Flecha`, icono: 'arrow-left' })).status, 400);
  });

  it('al editar, sin icono conserva el que tenía y con icono lo cambia', async () => {
    const { json: cat } = await crear({ nombre: `${marca} Música`, icono: 'music' });
    const sinCambio = await editar(cat.id, { nombre: `${marca} Música`, descripcion: 'Teoría', activa: true });
    assert.equal(sinCambio.json.icono, 'music');
    const cambio = await editar(cat.id, { nombre: `${marca} Música`, activa: true, icono: 'globe' });
    assert.equal(cambio.json.icono, 'globe');
  });

  it('el catálogo y Mi aprendizaje devuelven el ícono de la categoría', async () => {
    const { json: cat } = await crear({ nombre: `${marca} Ciencia`, icono: 'flask-conical' });
    const id = await curso(cat.id, `${marca} Química`, true);
    await f.query('INSERT INTO inscripcion (id_persona, id_curso) VALUES ($1, $2)', [alumna.idPersona, id]);

    const categorias = await srv.pedir('/api/categorias');
    assert.equal(categorias.json.find((c: { id: number }) => c.id === cat.id)?.icono, 'flask-conical');
    const lista = await srv.pedir(`/api/cursos?q=${encodeURIComponent(`${marca} Química`)}`);
    assert.deepEqual(lista.json.items[0].categoria, { id: cat.id, nombre: `${marca} Ciencia`, icono: 'flask-conical' });
    assert.equal((await srv.pedir(`/api/cursos/${id}`)).json.categoria.icono, 'flask-conical');
    const mio = await srv.pedir('/api/mi-aprendizaje', { token: alumna.token });
    assert.equal(mio.json.items.find((x: { curso: { id: number } }) => x.curso.id === id).curso.categoria.icono, 'flask-conical');
  });
});

describe('Desactivar una categoría reasignando sus cursos', () => {
  it('rechaza un destino inválido sin cambiar nada (ni la categoría ni sus cursos)', async () => {
    const { json: origen } = await crear({ nombre: `${marca} Origen inválido` });
    const { json: inactiva } = await crear({ nombre: `${marca} Inactiva` });
    await editar(inactiva.id, { nombre: inactiva.nombre, activa: false });
    await curso(origen.id, `${marca} Curso A`, true);

    for (const destino of [origen.id, inactiva.id, 2147483647]) {
      const r = await editar(origen.id, { nombre: origen.nombre, activa: false, reasignarA: destino });
      assert.equal(r.status, 400, `destino ${destino}`);
      assert.ok(r.json.error.detalles.some((d: { campo: string }) => d.campo === 'reasignarA'));
    }
    const lista = await srv.pedir('/api/admin/categorias', { token: admin.token });
    const actual = lista.json.find((c: { id: number }) => c.id === origen.id);
    assert.equal(actual.activa, true, 'la transacción se deshizo: sigue activa');
    assert.equal(actual.cursos, 1);
  });

  it('desactiva y mueve todos sus cursos (de cualquier estado) a otra activa, con el administrador en la auditoría', async () => {
    const { json: origen } = await crear({ nombre: `${marca} Origen` });
    const { json: destino } = await crear({ nombre: `${marca} Destino`, icono: 'book-open' });
    const publicado = await curso(origen.id, `${marca} Publicado`, true);
    const borrador = await curso(origen.id, `${marca} Borrador`, false);
    const antes = (await srv.pedir('/api/admin/categorias', { token: admin.token })).json
      .find((c: { id: number }) => c.id === origen.id);
    assert.deepEqual([antes.cursos, antes.cursosPublicados], [2, 1], 'el panel conoce cuántos tiene para avisar');

    assert.equal((await editar(origen.id, { nombre: origen.nombre, activa: false, reasignarA: destino.id }, alumna.token)).status, 403);
    const r = await editar(origen.id, { nombre: origen.nombre, activa: false, reasignarA: destino.id });
    assert.equal(r.status, 200, r.texto);
    assert.deepEqual([r.json.activa, r.json.cursos, r.json.cursosPublicados], [false, 0, 0]);

    const lista = await srv.pedir('/api/admin/categorias', { token: admin.token });
    const nuevo = lista.json.find((c: { id: number }) => c.id === destino.id);
    assert.deepEqual([nuevo.cursos, nuevo.cursosPublicados], [2, 1]);
    assert.equal((await srv.pedir(`/api/cursos/${publicado}`)).json.categoria.icono, 'book-open', 'el catálogo ya lo muestra en la nueva');

    const { rows } = await f.query<{ id: number; actor: number }>(
      `SELECT (despues ->> 'id_curso')::int AS id, id_persona_actor AS actor FROM auditoria_cambio
        WHERE tabla = 'curso' AND operacion = 'UPDATE' AND 'id_categoria' = ANY (columnas_cambiadas)
          AND (despues ->> 'id_curso')::int = ANY ($1::int[])
        ORDER BY 1`, [[publicado, borrador]]);
    assert.deepEqual(rows, [{ id: Math.min(publicado, borrador), actor: admin.idPersona }, { id: Math.max(publicado, borrador), actor: admin.idPersona }]);
  });
});
