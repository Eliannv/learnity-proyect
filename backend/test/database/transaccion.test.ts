import '../ayudas/guardia-bd.js';

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { after, before, describe, it } from 'node:test';

import { verificarBaseConectada } from '../ayudas/guardia-bd.js';

const { pool, enTransaccion } = await import('../../src/shared/database/pool.js');

interface ClienteFalso extends EventEmitter {
  consultas: string[];
  liberadoCon: unknown;
  liberado: boolean;
  query(sql: string): Promise<unknown>;
  release(error?: unknown): void;
}

/** Cliente que falla en las sentencias indicadas, para simular una conexión rota. */
function clienteFalso(fallan: string[]): ClienteFalso {
  const cliente = Object.assign(new EventEmitter(), {
    consultas: [] as string[],
    liberadoCon: undefined as unknown,
    liberado: false,
    async query(sql: string) {
      cliente.consultas.push(sql);
      if (fallan.includes(sql)) throw new Error(`fallo simulado en ${sql}`);
      return { rows: [], rowCount: 0 };
    },
    release(error?: unknown) {
      cliente.liberado = true;
      cliente.liberadoCon = error;
    },
  }) as ClienteFalso;
  return cliente;
}

async function conClienteFalso<T>(cliente: ClienteFalso, prueba: () => Promise<T>): Promise<T> {
  const original = pool.connect;
  (pool as unknown as { connect: () => Promise<ClienteFalso> }).connect = async () => cliente;
  try {
    return await prueba();
  } finally {
    pool.connect = original;
  }
}

describe('enTransaccion', () => {
  before(async () => {
    await verificarBaseConectada(pool);
  });

  after(async () => {
    await pool.end();
  });

  it('confirma y libera el cliente sin error', async () => {
    const cliente = clienteFalso([]);
    const valor = await conClienteFalso(cliente, () => enTransaccion(async () => 42));
    assert.equal(valor, 42);
    assert.deepEqual(cliente.consultas, ['BEGIN', 'COMMIT']);
    assert.equal(cliente.liberado, true);
    assert.equal(cliente.liberadoCon, undefined);
  });

  it('si el trabajo falla, hace ROLLBACK, relanza el error original y libera sin error', async () => {
    const cliente = clienteFalso([]);
    const original = new Error('fallo del trabajo');
    await assert.rejects(
      conClienteFalso(cliente, () =>
        enTransaccion(async () => {
          throw original;
        }),
      ),
      (error) => error === original,
    );
    assert.deepEqual(cliente.consultas, ['BEGIN', 'ROLLBACK']);
    assert.equal(cliente.liberadoCon, undefined);
  });

  it('si el ROLLBACK también falla, no oculta el error original y libera el cliente roto', async () => {
    const cliente = clienteFalso(['ROLLBACK']);
    const original = new Error('conexión perdida durante el trabajo');
    await assert.rejects(
      conClienteFalso(cliente, () =>
        enTransaccion(async () => {
          throw original;
        }),
      ),
      (error) => error === original,
    );
    assert.equal(cliente.liberado, true);
    assert.ok(cliente.liberadoCon instanceof Error, 'release debe recibir el error para que el pool descarte el cliente');
    assert.match((cliente.liberadoCon as Error).message, /ROLLBACK/);
  });

  it('si el COMMIT falla, deshace, relanza el error del COMMIT y libera el cliente', async () => {
    const cliente = clienteFalso(['COMMIT', 'ROLLBACK']);
    await assert.rejects(
      conClienteFalso(cliente, () => enTransaccion(async () => 1)),
      /fallo simulado en COMMIT/,
    );
    assert.deepEqual(cliente.consultas, ['BEGIN', 'COMMIT', 'ROLLBACK']);
    assert.ok(cliente.liberadoCon instanceof Error);
  });

  it('escucha el error del cliente prestado: sin listener sería una excepción no capturada', async () => {
    const cliente = clienteFalso([]);
    const corte = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });
    const original = new Error('la consulta falló por el corte');
    await assert.rejects(
      conClienteFalso(cliente, () =>
        enTransaccion(async () => {
          assert.equal(cliente.listenerCount('error'), 1, 'debe haber un listener mientras dura el préstamo');
          cliente.emit('error', corte); // EventEmitter lanzaría aquí si nadie escuchara
          throw original;
        }),
      ),
      (error) => error === original,
    );
    assert.equal(cliente.liberadoCon, corte, 'release debe recibir el error de la conexión');
    assert.equal(cliente.listenerCount('error'), 0, 'el listener se quita antes de liberar');
  });

  it('quita el listener también cuando todo sale bien', async () => {
    const cliente = clienteFalso([]);
    await conClienteFalso(cliente, () => enTransaccion(async () => 1));
    assert.equal(cliente.listenerCount('error'), 0);
  });

  it('fija el actor con set_config parametrizado, antes del trabajo', async () => {
    const cliente = clienteFalso([]);
    const consultas: Array<[string, unknown[]]> = [];
    const query = cliente.query;
    cliente.query = async (sql: string, ...resto: unknown[]) => {
      consultas.push([sql, (resto[0] as unknown[]) ?? []]);
      return query.call(cliente, sql);
    };
    await conClienteFalso(cliente, () => enTransaccion(async () => 0, { actor: 7 }));
    assert.deepEqual(cliente.consultas.slice(0, 3), [
      'BEGIN',
      "SELECT set_config('learnity.id_persona', $1, true)",
      'COMMIT',
    ]);
    assert.deepEqual(consultas[1], ["SELECT set_config('learnity.id_persona', $1, true)", ['7']]);
  });

  it('rechaza un actor que no es un entero positivo, sin ejecutar el trabajo', async () => {
    for (const actor of [0, -3, 1.5, Number.NaN]) {
      const cliente = clienteFalso([]);
      let ejecutado = false;
      await assert.rejects(
        conClienteFalso(cliente, () =>
          enTransaccion(async () => {
            ejecutado = true;
          }, { actor }),
        ),
        TypeError,
      );
      assert.equal(ejecutado, false);
      assert.equal(cliente.consultas.includes('ROLLBACK'), true);
    }
  });

  it('con la base real, el actor vale solo dentro de la transacción', async () => {
    const dentro = await enTransaccion(
      async (cliente) => (await cliente.query("SELECT current_setting('learnity.id_persona', true) AS actor")).rows[0].actor,
      { actor: 12345 },
    );
    assert.equal(dentro, '12345');

    const despues = await enTransaccion(
      async (cliente) => (await cliente.query("SELECT current_setting('learnity.id_persona', true) AS actor")).rows[0].actor,
    );
    assert.ok(despues === null || despues === '', `el actor no debe persistir (valor: ${JSON.stringify(despues)})`);
  });
});
