import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crearMarca, generadorCorreos } from './datos.js';

describe('datos de prueba (GUA-06)', () => {
  it('los correos llevan la marca y nunca son @pruebas.test', () => {
    const marca = crearMarca('car');
    const correo = generadorCorreos(marca);
    const lista = Array.from({ length: 20 }, () => correo());
    for (const c of lista) {
      assert.ok(c.includes(marca.toLowerCase()), c);
      assert.ok(!c.endsWith('@pruebas.test'), c);
    }
    assert.equal(new Set(lista).size, 20);
  });
});
