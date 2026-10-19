import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { comprobarEntorno, verificarBaseConectada } from './guardia-entorno.js';

const ok = { NODE_ENV: 'test', DB_NAME: 'learnity_test' };
const falsoPool = (base: string) => ({ query: async () => ({ rows: [{ base }] }) });

describe('guardia de BD (GUA-01..05)', () => {
  it('GUA-00 entorno apto', () => assert.equal(comprobarEntorno(ok), null));
  it('GUA-01 NODE_ENV distinto de test', () => {
    assert.match(comprobarEntorno({ ...ok, NODE_ENV: 'development' })!, /NODE_ENV/);
    assert.match(comprobarEntorno({ DB_NAME: 'learnity_test' })!, /NODE_ENV/);
  });
  it('GUA-02 DB_NAME learnity, Learnity u otra', () => {
    for (const DB_NAME of ['learnity', 'Learnity', 'otra', 'LEARNITY', 'learnity_test_x', '_test']) {
      assert.match(comprobarEntorno({ ...ok, DB_NAME })!, /DB_NAME/, DB_NAME);
    }
  });
  it('GUA-03 LEARNITY_PRUEBA_LOCAL no abre excepción', () => {
    assert.match(comprobarEntorno({ ...ok, DB_NAME: 'Learnity', LEARNITY_PRUEBA_LOCAL: 'true' })!, /DB_NAME/);
  });
  it('GUA-04 DB_NAME ausente', () => {
    assert.match(comprobarEntorno({ NODE_ENV: 'test' })!, /DB_NAME/);
  });
  it('GUA-05 verificarBaseConectada', async () => {
    await assert.rejects(verificarBaseConectada(falsoPool('Learnity')), /Learnity/);
    await assert.rejects(verificarBaseConectada(falsoPool('learnity')), /learnity/);
    assert.equal(await verificarBaseConectada(falsoPool('learnity_test')), 'learnity_test');
  });
});
