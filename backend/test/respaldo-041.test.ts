import './ayudas/guardia-bd.js';
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { enTransaccion, pool } from '../src/shared/database/pool.js';
import { con041, reiniciarDeteccion041, tieneMigracion041 } from '../src/shared/database/respaldo-041.js';

describe('Respaldo de la migración 041', () => {
  after(() => reiniciarDeteccion041());

  it('detecta la 041 completa solo si learnity_app puede usar sus tablas y función', async () => {
    reiniciarDeteccion041();
    assert.equal(await tieneMigracion041(pool), true);
  });

  it('un fallo de esquema dentro de la transacción vuelve al respaldo sin dejarla abortada (25P02)', async () => {
    reiniciarDeteccion041(true);
    const resultado = await enTransaccion(async (cliente) => {
      const valor = await con041(
        cliente,
        async () => {
          await cliente.query('SELECT 1 FROM tabla_041_inexistente');
          return 'tablas';
        },
        async () => 'respaldo',
        { transaccion: true },
      );
      // Con la transacción abortada esta consulta fallaría con 25P02.
      const { rows } = await cliente.query<{ uno: number }>('SELECT 1 AS uno');
      return { valor, uno: rows[0]!.uno };
    });
    assert.deepEqual(resultado, { valor: 'respaldo', uno: 1 });
    assert.equal(await tieneMigracion041(pool), false, 'tras el fallo, la 041 queda marcada como no disponible');
    reiniciarDeteccion041();
  });

  it('un error de datos (no de esquema) se propaga y no activa el respaldo', async () => {
    reiniciarDeteccion041(true);
    await assert.rejects(
      enTransaccion(async (cliente) =>
        con041(
          cliente,
          async () => {
            await cliente.query('SELECT 1 / 0');
            return 'tablas';
          },
          async () => 'respaldo',
          { transaccion: true },
        ),
      ),
      { code: '22012' },
    );
    assert.equal(await tieneMigracion041(pool), true);
    reiniciarDeteccion041();
  });
});
