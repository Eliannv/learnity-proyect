import './guardia-bd.js';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { crearFixtures, ROL_PRUEBAS, type Fixtures } from './bd-fixtures.js';
import { crearMarca } from './datos.js';

describe('pool de fixtures (BD-019b)', () => {
  let f: Fixtures;
  const marca = crearMarca('fix');
  before(async () => { f = await crearFixtures(); });
  after(async () => {
    await f.query('DELETE FROM persona WHERE nombres = $1', [marca]);
    await f.cerrar();
  });

  it('usa SET ROLE solo si el rol existe y deja la sesión limpia', async () => {
    const { rows: [rol] } = await f.query<{ existe: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS existe', [ROL_PRUEBAS]);
    assert.equal(f.conRol, rol!.existe);
    const { rows: [sesion] } = await f.query<{ actual: string }>('SELECT current_user AS actual');
    assert.equal(sesion!.actual === ROL_PRUEBAS, f.conRol);
  });

  it('inserta y borra datos propios (transacción con rollback incluida)', async () => {
    const { rows } = await f.query<{ id_persona: number }>('INSERT INTO persona (nombres, apellidos) VALUES ($1, $2) RETURNING id_persona', [marca, 'x']);
    assert.ok(rows[0]!.id_persona > 0);
    await assert.rejects(f.transaccion(async (c) => {
      await c.query('INSERT INTO persona (nombres, apellidos) VALUES ($1, $2)', [marca, 'rollback']);
      throw new Error('fallo');
    }), /fallo/);
    const { rows: [n] } = await f.query<{ n: string }>('SELECT count(*) AS n FROM persona WHERE nombres = $1', [marca]);
    assert.equal(n!.n, '1');
  });
});
